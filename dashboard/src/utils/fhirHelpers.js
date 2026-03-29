/** Extract entries from a FHIR Bundle response */
export function extractEntries(bundle) {
  if (!bundle?.entry) return [];
  return bundle.entry.map((e) => e.resource).filter(Boolean);
}

/** Get patient arm from ResearchSubject resources */
export function getPatientArms(researchSubjects) {
  const map = {};
  for (const rs of researchSubjects) {
    const patRef = rs.individual?.reference || rs.subject?.reference;
    if (patRef) {
      map[patRef] = rs.assignedArm || rs.actualArm || 'Unknown';
    }
  }
  return map;
}

/** Parse FHIR Patient into a simpler object */
export function parsePatient(patient) {
  return {
    id: patient.id,
    name: patient.name?.[0]
      ? `${patient.name[0].given?.join(' ') || ''} ${patient.name[0].family || ''}`.trim()
      : patient.id,
    gender: patient.gender || 'unknown',
    birthDate: patient.birthDate,
    identifier: patient.identifier?.[0]?.value || patient.id,
    managingOrg: patient.managingOrganization?.reference,
  };
}

/** Parse AdverseEvent */
export function parseAdverseEvent(ae) {
  const event = ae.event?.coding?.[0] || {};
  return {
    id: ae.id,
    term: event.display || 'Unknown',
    code: event.code,
    system: ae.event?.coding?.find(c => c.system?.includes('meddra'))?.code,
    seriousness: ae.seriousness?.coding?.[0]?.code,
    severity: ae.severity?.coding?.[0]?.display || ae.severity?.coding?.[0]?.code,
    grade: ae.extension?.find(e => e.url?.includes('ctcae-grade'))?.valueInteger
      || ae.severity?.coding?.[0]?.code,
    outcome: ae.outcome?.coding?.[0]?.display,
    subject: ae.subject?.reference,
    patientId: ae.subject?.reference,
    date: ae.date || ae.detected,
    startDate: ae.extension?.find(e => e.url?.includes('start-date'))?.valueDateTime || ae.date,
    endDate: ae.extension?.find(e => e.url?.includes('end-date'))?.valueDateTime,
    bodySite: ae.event?.coding?.find(c => c.system?.includes('soc'))?.display,
    soc: ae.extension?.find(e => e.url?.includes('body-system'))?.valueString
      || ae.event?.text || '',
    _raw: ae,
  };
}

/** Parse Observation */
export function parseObservation(obs) {
  const coding = obs.code?.coding?.[0] || {};
  const value = obs.valueQuantity?.value ?? obs.valueString;
  const unit = obs.valueQuantity?.unit || obs.valueQuantity?.code || '';
  const refLow = obs.referenceRange?.[0]?.low?.value;
  const refHigh = obs.referenceRange?.[0]?.high?.value;
  const displayName = coding.display || obs.code?.text || coding.code;
  return {
    id: obs.id,
    code: coding.code,
    name: displayName,
    display: displayName,
    value,
    unit,
    date: obs.effectiveDateTime || obs.issued,
    subject: obs.subject?.reference,
    patientId: obs.subject?.reference,
    category: obs.category?.[0]?.coding?.[0]?.code,
    testName: displayName,
    effectiveDate: obs.effectiveDateTime || obs.issued,
    refLow,
    refHigh,
    isAbnormal: value != null && ((refHigh != null && value > refHigh) || (refLow != null && value < refLow)),
    visitNumber: obs.extension?.find(e => e.url?.includes('visit'))?.valueInteger,
    _raw: obs,
  };
}

/** Parse MedicationAdministration */
export function parseMedication(med) {
  const coding = med.medicationCodeableConcept?.coding?.[0] || {};
  return {
    id: med.id,
    name: coding.display || med.medicationCodeableConcept?.text || 'Unknown',
    code: coding.code,
    date: med.effectiveDateTime || med.effectivePeriod?.start,
    endDate: med.effectivePeriod?.end,
    dose: med.dosage?.dose?.value,
    doseUnit: med.dosage?.dose?.unit,
    route: med.dosage?.route?.coding?.[0]?.display,
    subject: med.subject?.reference,
    patientId: med.subject?.reference,
    _raw: med,
  };
}

/** Group items by a key function */
export function groupBy(items, keyFn) {
  return items.reduce((acc, item) => {
    const key = keyFn(item);
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});
}

/** Calculate percentage */
export function pct(num, denom) {
  if (!denom) return 0;
  return Math.round((num / denom) * 1000) / 10;
}

/** ARM color mapping */
export const ARM_COLORS = {
  PEMBRO: '#3B82F6',
  CHEMO: '#8B5CF6',
};

/** Grade color mapping */
export const GRADE_COLORS = {
  1: '#FEF3C7',
  2: '#FDE68A',
  3: '#F59E0B',
  4: '#DC2626',
  5: '#1F2937',
};
