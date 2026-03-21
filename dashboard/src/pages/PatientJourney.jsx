import React, { useState, useMemo, useCallback } from 'react';
import { UserSearch } from 'lucide-react';
import { useStudy } from '../hooks/useStudy';
import { useFhirQuery } from '../hooks/useFhirQuery';
import { fhirApi } from '../api/fhir';
import {
  extractEntries,
  getPatientArms,
  parsePatient,
  parseAdverseEvent,
  parseObservation,
  parseMedication,
} from '../utils/fhirHelpers';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorMessage from '../components/common/ErrorMessage';
import PatientSelector from '../components/patient-journey/PatientSelector';
import PatientDemographics from '../components/patient-journey/PatientDemographics';
import PatientTimeline from '../components/patient-journey/PatientTimeline';
import PatientLabChart from '../components/patient-journey/PatientLabChart';
import PatientVitalsChart from '../components/patient-journey/PatientVitalsChart';
import EventDetailModal from '../components/patient-journey/EventDetailModal';

function isLabObservation(obs) {
  const cat = (obs.category || '').toLowerCase();
  const name = (obs.name || obs.code || '').toUpperCase();
  if (cat.includes('laboratory') || cat.includes('lab')) return true;
  const labNames = ['ALT', 'AST', 'HGB', 'ANC', 'PLT', 'CREATININE', 'BILIRUBIN', 'WBC', 'RBC', 'ALBUMIN'];
  return labNames.some((l) => name.includes(l));
}

function isVitalObservation(obs) {
  const cat = (obs.category || '').toLowerCase();
  const name = (obs.name || obs.code || '').toUpperCase();
  if (cat.includes('vital')) return true;
  const vitalNames = ['SYSTOLIC', 'DIASTOLIC', 'SBP', 'DBP', 'HEART RATE', 'HR', 'PULSE', 'WEIGHT', 'TEMP', 'BODY TEMPERATURE', 'BLOOD PRESSURE'];
  return vitalNames.some((v) => name.includes(v));
}

function isOutOfRange(obs) {
  const val = parseFloat(obs.value);
  if (isNaN(val)) return false;
  const low = obs.referenceLow != null ? parseFloat(obs.referenceLow) : null;
  const high = obs.referenceHigh != null ? parseFloat(obs.referenceHigh) : null;
  if (low != null && val < low) return true;
  if (high != null && val > high) return true;
  return false;
}

export default function PatientJourney() {
  const { selectedStudyId } = useStudy();
  const [selectedPatientId, setSelectedPatientId] = useState(null);
  const [modalEvent, setModalEvent] = useState(null);
  const [modalType, setModalType] = useState('ae');
  const [modalOpen, setModalOpen] = useState(false);

  // Fetch patient list
  const {
    data: patientListData,
    loading: patientsLoading,
    error: patientsError,
    refetch: refetchPatients,
  } = useFhirQuery(
    () => (selectedStudyId ? fhirApi.getStudyPatients(selectedStudyId) : null),
    [selectedStudyId]
  );

  // Parse patient list
  const patients = useMemo(() => {
    if (!patientListData) return [];
    const entries = extractEntries(patientListData);
    const arms = getPatientArms(entries);
    return entries
      .filter((e) => e.resource?.resourceType === 'Patient')
      .map((e) => {
        const parsed = parsePatient(e.resource);
        return {
          ...parsed,
          arm: arms[parsed.id] || 'Unknown',
        };
      });
  }, [patientListData]);

  // Fetch timeline for selected patient
  const {
    data: timelineData,
    loading: timelineLoading,
    error: timelineError,
    refetch: refetchTimeline,
  } = useFhirQuery(
    () => (selectedPatientId ? fhirApi.getPatientTimeline(selectedPatientId) : null),
    [selectedPatientId]
  );

  // Parse timeline data
  const { medications, adverseEvents, labObs, vitalObs, labAlerts, vitalAlerts, dispositions, startDate, endDate } =
    useMemo(() => {
      if (!timelineData) {
        return {
          medications: [],
          adverseEvents: [],
          labObs: [],
          vitalObs: [],
          labAlerts: [],
          vitalAlerts: [],
          dispositions: [],
          startDate: null,
          endDate: null,
        };
      }

      const entries = extractEntries(timelineData);
      const meds = [];
      const aes = [];
      const observations = [];
      const disps = [];
      let earliest = null;
      let latest = null;

      function trackDate(d) {
        if (!d) return;
        const ms = new Date(d).getTime();
        if (isNaN(ms)) return;
        if (earliest == null || ms < earliest) earliest = ms;
        if (latest == null || ms > latest) latest = ms;
      }

      for (const entry of entries) {
        const r = entry.resource;
        if (!r) continue;

        switch (r.resourceType) {
          case 'MedicationAdministration':
          case 'MedicationRequest': {
            const parsed = parseMedication(r);
            meds.push(parsed);
            trackDate(parsed.date || parsed.authoredOn);
            break;
          }
          case 'AdverseEvent': {
            const parsed = parseAdverseEvent(r);
            aes.push(parsed);
            trackDate(parsed.startDate || parsed.date);
            trackDate(parsed.endDate);
            break;
          }
          case 'Observation': {
            const parsed = parseObservation(r);
            observations.push(parsed);
            trackDate(parsed.date || parsed.effectiveDateTime);
            break;
          }
          case 'EpisodeOfCare':
          case 'Encounter': {
            const status = r.status || r.type?.[0]?.coding?.[0]?.display || 'Unknown';
            const date = r.period?.start || r.period?.end || r.meta?.lastUpdated;
            disps.push({
              type: 'disposition',
              status,
              date,
              reason: r.type?.[0]?.text || r.reasonCode?.[0]?.text || '',
              _raw: r,
            });
            trackDate(date);
            break;
          }
          default:
            break;
        }
      }

      const labs = observations.filter(isLabObservation);
      const vitals = observations.filter(isVitalObservation);
      const labAl = labs.filter(isOutOfRange);
      const vitalAl = vitals.filter(isOutOfRange);

      return {
        medications: meds,
        adverseEvents: aes,
        labObs: labs,
        vitalObs: vitals,
        labAlerts: labAl,
        vitalAlerts: vitalAl,
        dispositions: disps,
        startDate: earliest ? new Date(earliest) : null,
        endDate: latest ? new Date(latest) : null,
      };
    }, [timelineData]);

  const selectedPatient = patients.find((p) => p.id === selectedPatientId);

  const handleEventClick = useCallback((event, type) => {
    setModalEvent(event);
    setModalType(type);
    setModalOpen(true);
  }, []);

  // Loading state
  if (patientsLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <LoadingSpinner />
      </div>
    );
  }

  // Error state
  if (patientsError) {
    return (
      <ErrorMessage
        message={`Failed to load patients: ${patientsError}`}
        onRetry={refetchPatients}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <UserSearch className="w-6 h-6 text-blue-600" />
        <h1 className="text-2xl font-bold text-gray-800">Patient Journey</h1>
      </div>

      {/* Patient selector */}
      <PatientSelector
        patients={patients}
        selectedId={selectedPatientId}
        onSelect={setSelectedPatientId}
      />

      {/* No patient selected prompt */}
      {!selectedPatientId && (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <UserSearch className="w-12 h-12 mb-3 text-gray-300" />
          <p className="text-lg font-medium">Select a patient to view their journey</p>
          <p className="text-sm mt-1">
            Use the dropdown above to search and select a patient
          </p>
        </div>
      )}

      {/* Timeline loading */}
      {selectedPatientId && timelineLoading && (
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner />
        </div>
      )}

      {/* Timeline error */}
      {selectedPatientId && timelineError && (
        <ErrorMessage
          message={`Failed to load patient timeline: ${timelineError}`}
          onRetry={refetchTimeline}
        />
      )}

      {/* Patient data */}
      {selectedPatient && !timelineLoading && !timelineError && (
        <>
          {/* Demographics */}
          <PatientDemographics
            patient={selectedPatient}
            arm={selectedPatient.arm}
            studyPeriod={
              startDate && endDate
                ? { start: startDate.toISOString(), end: endDate.toISOString() }
                : null
            }
          />

          {/* Timeline */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">
              Patient Timeline
            </h2>
            <div style={{ minHeight: 300 }}>
              <PatientTimeline
                medications={medications}
                adverseEvents={adverseEvents}
                labAlerts={labAlerts}
                vitalAlerts={vitalAlerts}
                dispositions={dispositions}
                startDate={startDate}
                endDate={endDate}
                onEventClick={handleEventClick}
              />
            </div>
          </div>

          {/* Lab and Vital charts side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <PatientLabChart observations={labObs} />
            <PatientVitalsChart observations={vitalObs} />
          </div>
        </>
      )}

      {/* Event detail modal */}
      <EventDetailModal
        event={modalEvent}
        type={modalType}
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setModalEvent(null);
        }}
      />
    </div>
  );
}
