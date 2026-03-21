import { useCallback } from 'react';
import { useStudy } from '../hooks/useStudy';
import { useFhirQuery } from '../hooks/useFhirQuery';
import { fhirApi } from '../api/fhir';
import { extractEntries } from '../utils/fhirHelpers';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorMessage from '../components/common/ErrorMessage';
import StudySummaryCards from '../components/study-overview/StudySummaryCards';
import EnrollmentTimeline from '../components/study-overview/EnrollmentTimeline';
import ArmDistribution from '../components/study-overview/ArmDistribution';
import EnrollmentWaterfall from '../components/study-overview/EnrollmentWaterfall';
import SiteEnrollmentTable from '../components/study-overview/SiteEnrollmentTable';

export default function StudyOverview() {
  const { selectedStudyId } = useStudy();

  const {
    data: patientBundle,
    loading: patientsLoading,
    error: patientsError,
    refetch: refetchPatients,
  } = useFhirQuery(
    useCallback(() => fhirApi.getStudyPatients(selectedStudyId), [selectedStudyId]),
    [selectedStudyId]
  );

  const {
    data: aeBundle,
    loading: aeLoading,
    error: aeError,
    refetch: refetchAE,
  } = useFhirQuery(
    useCallback(() => fhirApi.getStudyAdverseEvents(selectedStudyId), [selectedStudyId]),
    [selectedStudyId]
  );

  if (!selectedStudyId) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
        Select a study to view the overview.
      </div>
    );
  }

  const loading = patientsLoading || aeLoading;
  const error = patientsError || aeError;

  if (loading) return <LoadingSpinner message="Loading study overview..." />;
  if (error) return <ErrorMessage message={error} onRetry={() => { refetchPatients(); refetchAE(); }} />;

  // Parse bundle entries
  const allEntries = extractEntries(patientBundle);
  const researchSubjects = allEntries.filter((e) => e.resourceType === 'ResearchSubject');
  const patients = allEntries.filter((e) => e.resourceType === 'Patient');
  const adverseEvents = extractEntries(aeBundle).filter((e) => e.resourceType === 'AdverseEvent');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Study Overview</h1>
        <p className="text-sm text-gray-500 mt-1">
          Enrollment summary, arm distribution, and site-level metrics
        </p>
      </div>

      {/* Row 1: KPI Cards */}
      <StudySummaryCards
        researchSubjects={researchSubjects}
        patients={patients}
        adverseEvents={adverseEvents}
      />

      {/* Row 2: Timeline + Arm Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <EnrollmentTimeline researchSubjects={researchSubjects} />
        </div>
        <div className="lg:col-span-1">
          <ArmDistribution researchSubjects={researchSubjects} />
        </div>
      </div>

      {/* Row 3: Waterfall */}
      <EnrollmentWaterfall researchSubjects={researchSubjects} />

      {/* Row 4: Site Table */}
      <SiteEnrollmentTable
        researchSubjects={researchSubjects}
        patients={patients}
      />
    </div>
  );
}
