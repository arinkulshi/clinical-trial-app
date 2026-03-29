import React, { useState, useMemo, useCallback } from 'react';
import { ShieldAlert } from 'lucide-react';
import { useStudy } from '../hooks/useStudy';
import { useFhirQuery } from '../hooks/useFhirQuery';
import { fhirApi } from '../api/fhir';
import {
  extractEntries,
  getPatientArms,
  parseAdverseEvent,
  parseObservation,
  groupBy,
} from '../utils/fhirHelpers';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorMessage from '../components/common/ErrorMessage';
import SafetyFilters from '../components/safety/SafetyFilters';
import AEFrequencyChart from '../components/safety/AEFrequencyChart';
import AEButterflyPlot from '../components/safety/AEButterflyPlot';
import AEGradeHeatmap from '../components/safety/AEGradeHeatmap';
import LabShiftPlot from '../components/safety/LabShiftPlot';
import LabTrendChart from '../components/safety/LabTrendChart';
import VitalSignsTrend from '../components/safety/VitalSignsTrend';

const DEFAULT_FILTERS = { arm: 'All', grade: 'All', soc: 'All' };

export default function SafetyDashboard() {
  const { selectedStudyId, loading: studyLoading } = useStudy();
  const [filters, setFilters] = useState(DEFAULT_FILTERS);

  // Fetch patients (ResearchSubject) for arm assignment
  const {
    data: patientsBundle,
    loading: patientsLoading,
    error: patientsError,
    refetch: refetchPatients,
  } = useFhirQuery(
    useCallback(
      () => selectedStudyId ? fhirApi.getStudyPatients(selectedStudyId) : Promise.resolve(null),
      [selectedStudyId]
    ),
    [selectedStudyId]
  );

  // Fetch adverse events
  const {
    data: aeBundle,
    loading: aeLoading,
    error: aeError,
    refetch: refetchAE,
  } = useFhirQuery(
    useCallback(
      () => selectedStudyId ? fhirApi.getStudyAdverseEvents(selectedStudyId) : Promise.resolve(null),
      [selectedStudyId]
    ),
    [selectedStudyId]
  );

  // Fetch lab observations
  const {
    data: labBundle,
    loading: labLoading,
    error: labError,
    refetch: refetchLab,
  } = useFhirQuery(
    useCallback(
      () => selectedStudyId ? fhirApi.getStudyObservations(selectedStudyId, 'laboratory', 5000) : Promise.resolve(null),
      [selectedStudyId]
    ),
    [selectedStudyId]
  );

  // Fetch vital sign observations
  const {
    data: vitalsBundle,
    loading: vitalsLoading,
    error: vitalsError,
    refetch: refetchVitals,
  } = useFhirQuery(
    useCallback(
      () => selectedStudyId ? fhirApi.getStudyObservations(selectedStudyId, 'vital-signs', 5000) : Promise.resolve(null),
      [selectedStudyId]
    ),
    [selectedStudyId]
  );

  // Parse patient arms
  const patientArms = useMemo(() => {
    if (!patientsBundle) return {};
    const entries = extractEntries(patientsBundle);
    return getPatientArms(entries);
  }, [patientsBundle]);

  // Count patients per arm
  const patientCounts = useMemo(() => {
    const counts = { PEMBRO: 0, CHEMO: 0 };
    Object.values(patientArms).forEach((arm) => {
      if (counts[arm] !== undefined) counts[arm]++;
    });
    return counts;
  }, [patientArms]);

  // Parse adverse events
  const adverseEvents = useMemo(() => {
    if (!aeBundle) return [];
    const entries = extractEntries(aeBundle);
    return entries.map(parseAdverseEvent).filter(Boolean);
  }, [aeBundle]);

  // Parse lab observations
  const labObservations = useMemo(() => {
    if (!labBundle) return [];
    const entries = extractEntries(labBundle);
    return entries.map(parseObservation).filter(Boolean);
  }, [labBundle]);

  // Parse vital sign observations
  const vitalObservations = useMemo(() => {
    if (!vitalsBundle) return [];
    const entries = extractEntries(vitalsBundle);
    return entries.map(parseObservation).filter(Boolean);
  }, [vitalsBundle]);

  // Extract unique SOC values for filter dropdown
  const socOptions = useMemo(() => {
    const socs = new Set(adverseEvents.map((e) => e.soc).filter(Boolean));
    return [...socs].sort();
  }, [adverseEvents]);

  // Filter adverse events based on arm filter (grade and soc filters handled by child components)
  const filteredAE = useMemo(() => {
    let events = adverseEvents;
    if (filters.arm !== 'All') {
      const armPatientIds = new Set(
        Object.entries(patientArms)
          .filter(([, arm]) => arm === filters.arm)
          .map(([id]) => id)
      );
      events = events.filter((e) => armPatientIds.has(e.patientId));
    }
    return events;
  }, [adverseEvents, patientArms, filters.arm]);

  const isLoading = patientsLoading || aeLoading || labLoading || vitalsLoading;
  const hasError = patientsError || aeError || labError || vitalsError;
  const errorMessage = [patientsError, aeError, labError, vitalsError]
    .filter(Boolean)
    .join('; ');

  const handleRetry = () => {
    if (patientsError) refetchPatients();
    if (aeError) refetchAE();
    if (labError) refetchLab();
    if (vitalsError) refetchVitals();
  };

  if (studyLoading || isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <LoadingSpinner />
      </div>
    );
  }

  if (!selectedStudyId) {
    return (
      <div className="p-6">
        <ErrorMessage message="No study found. Please load data into the FHIR server first." />
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="p-6">
        <ErrorMessage message={errorMessage} onRetry={handleRetry} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-3">
          <ShieldAlert size={24} className="text-red-500" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Safety Dashboard</h1>
            <p className="text-sm text-gray-500">
              Adverse events, lab values, and vital signs analysis
              {patientCounts.PEMBRO + patientCounts.CHEMO > 0 && (
                <span className="ml-2">
                  — {patientCounts.PEMBRO} PEMBRO, {patientCounts.CHEMO} CHEMO patients
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Sticky filters */}
      <SafetyFilters
        filters={filters}
        onFilterChange={setFilters}
        socOptions={socOptions}
      />

      {/* Dashboard content */}
      <div className="p-6 space-y-6">
        {/* Row 1: AE Frequency (full width) */}
        <AEFrequencyChart
          adverseEvents={adverseEvents}
          patientArms={patientArms}
          filters={filters}
        />

        {/* Row 2: Butterfly Plot + Grade Heatmap */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <AEButterflyPlot
            adverseEvents={adverseEvents}
            patientArms={patientArms}
            patientCounts={patientCounts}
            filters={filters}
          />
          <AEGradeHeatmap
            adverseEvents={adverseEvents}
            patientArms={patientArms}
            filters={filters}
          />
        </div>

        {/* Row 3: Lab Shift Plot + Lab Trend */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <LabShiftPlot
            observations={labObservations}
            patientArms={patientArms}
          />
          <LabTrendChart
            observations={labObservations}
            patientArms={patientArms}
          />
        </div>

        {/* Row 4: Vital Signs Trend (full width) */}
        <VitalSignsTrend
          observations={vitalObservations}
          patientArms={patientArms}
        />
      </div>
    </div>
  );
}
