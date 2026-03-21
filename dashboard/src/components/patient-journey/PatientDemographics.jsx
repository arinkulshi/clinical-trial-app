import React, { useState } from 'react';
import { User, Calendar, MapPin, FlaskConical } from 'lucide-react';
import Card from '../../components/common/Card';
import FhirJsonDrawer from '../../components/common/FhirJsonDrawer';
import { ARM_COLORS } from '../../utils/fhirHelpers';

export default function PatientDemographics({ patient, arm, studyPeriod }) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  if (!patient) return null;

  const fields = [
    { label: 'Patient ID', value: patient.identifier || patient.id },
    { label: 'Name', value: patient.name || 'Unknown' },
    { label: 'Gender', value: patient.gender ? patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1) : 'Unknown' },
    { label: 'Birth Date', value: patient.birthDate || 'Unknown' },
  ];

  const enrollStart = studyPeriod?.start
    ? new Date(studyPeriod.start).toLocaleDateString()
    : 'N/A';
  const enrollEnd = studyPeriod?.end
    ? new Date(studyPeriod.end).toLocaleDateString()
    : 'Ongoing';

  return (
    <>
      <Card
        title="Patient Demographics"
        icon={User}
        onShowFhir={() => setDrawerOpen(true)}
      >
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {fields.map((f) => (
            <div key={f.label}>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">
                {f.label}
              </p>
              <p className="text-sm font-semibold text-gray-800 mt-0.5">
                {f.value}
              </p>
            </div>
          ))}

          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">
              Arm
            </p>
            <span
              className="inline-block mt-0.5 text-xs font-bold px-2.5 py-1 rounded-full text-white"
              style={{ backgroundColor: ARM_COLORS[arm] || '#6B7280' }}
            >
              {arm || 'Unknown'}
            </span>
          </div>

          {patient.site && (
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">
                Site
              </p>
              <p className="text-sm font-semibold text-gray-800 mt-0.5 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-gray-400" />
                {patient.site}
              </p>
            </div>
          )}

          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">
              Enrollment
            </p>
            <p className="text-sm font-semibold text-gray-800 mt-0.5 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-gray-400" />
              {enrollStart}
            </p>
          </div>

          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">
              Last Contact
            </p>
            <p className="text-sm font-semibold text-gray-800 mt-0.5 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-gray-400" />
              {enrollEnd}
            </p>
          </div>
        </div>
      </Card>

      <FhirJsonDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Patient FHIR Resource"
        data={patient._raw || patient}
      />
    </>
  );
}
