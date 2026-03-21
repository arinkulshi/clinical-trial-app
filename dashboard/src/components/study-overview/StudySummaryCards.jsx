import { Users, Building2, CheckCircle, AlertTriangle } from 'lucide-react';
import Card from '../common/Card';
import { pct } from '../../utils/fhirHelpers';

const KpiCard = ({ icon: Icon, iconColor, value, label }) => (
  <Card className="flex-1 min-w-0">
    <div className="flex items-center gap-4">
      <div className={`p-3 rounded-lg ${iconColor}`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-sm text-gray-500">{label}</p>
      </div>
    </div>
  </Card>
);

export default function StudySummaryCards({ researchSubjects, patients, adverseEvents }) {
  const totalEnrolled = researchSubjects.length;

  // Count distinct organizations from patients
  const orgRefs = new Set();
  for (const p of patients) {
    if (p.managingOrganization?.reference) {
      orgRefs.add(p.managingOrganization.reference);
    }
  }
  const activeSites = orgRefs.size;

  // Completion rate from ResearchSubject status
  const completed = researchSubjects.filter(
    (rs) => rs.status === 'completed' || rs.status === 'off-study'
  ).length;
  const completionRate = pct(completed, totalEnrolled);

  // AE rate: patients with at least 1 AE
  const patientsWithAE = new Set();
  for (const ae of adverseEvents) {
    const subjectRef = ae.subject?.reference;
    if (subjectRef) patientsWithAE.add(subjectRef);
  }
  const aeRate = pct(patientsWithAE.size, totalEnrolled);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard
        icon={Users}
        iconColor="bg-blue-600"
        value={totalEnrolled}
        label="Total Enrolled"
      />
      <KpiCard
        icon={Building2}
        iconColor="bg-emerald-600"
        value={activeSites}
        label="Active Sites"
      />
      <KpiCard
        icon={CheckCircle}
        iconColor="bg-green-600"
        value={`${completionRate}%`}
        label="Completion Rate"
      />
      <KpiCard
        icon={AlertTriangle}
        iconColor="bg-amber-500"
        value={`${aeRate}%`}
        label="Overall AE Rate"
      />
    </div>
  );
}
