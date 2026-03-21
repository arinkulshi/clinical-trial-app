import { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from 'recharts';
import { BarChart3 } from 'lucide-react';
import Card from '../common/Card';
import FhirJsonDrawer from '../common/FhirJsonDrawer';

const STATUS_MAP = {
  candidate: 'Screened',
  'enrolled': 'Randomized',
  active: 'Active',
  completed: 'Completed',
  'off-study': 'Completed',
  withdrawn: 'Discontinued',
};

function deriveWaterfallData(researchSubjects) {
  const total = researchSubjects.length;

  // Count by mapped status
  const counts = { Screened: 0, Randomized: 0, Active: 0, Completed: 0, Discontinued: 0 };
  for (const rs of researchSubjects) {
    const mapped = STATUS_MAP[rs.status] || 'Active';
    counts[mapped]++;
  }

  // Waterfall logic: each step is cumulative through the funnel
  // Screened = total (everyone was screened)
  // Randomized = total - candidates still screening
  // Active = those currently active + completed + discontinued (all were active at some point)
  // Completed = those who completed
  // Discontinued = those who withdrew
  const screened = total;
  const randomized = total - counts.Screened;
  const active = counts.Active + counts.Completed + counts.Discontinued;
  const completed = counts.Completed;
  const discontinued = counts.Discontinued;

  return [
    { step: 'Screened', value: screened, color: '#3B82F6' },
    { step: 'Randomized', value: randomized, color: '#2563EB' },
    { step: 'Active', value: active, color: '#10B981' },
    { step: 'Completed', value: completed, color: '#059669' },
    { step: 'Discontinued', value: discontinued, color: '#EF4444' },
  ];
}

export default function EnrollmentWaterfall({ researchSubjects }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const data = deriveWaterfallData(researchSubjects);

  return (
    <>
      <Card
        title="Enrollment Waterfall"
        icon={BarChart3}
        onShowFhir={() => setDrawerOpen(true)}
      >
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} layout="vertical" margin={{ top: 5, right: 40, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 12 }} />
            <YAxis
              type="category"
              dataKey="step"
              width={100}
              tick={{ fontSize: 12, fontWeight: 500 }}
            />
            <Tooltip
              formatter={(value) => [value, 'Patients']}
              contentStyle={{ borderRadius: '8px', fontSize: '13px' }}
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={32}>
              {data.map((entry, idx) => (
                <Cell key={idx} fill={entry.color} />
              ))}
              <LabelList dataKey="value" position="right" style={{ fontSize: 12, fontWeight: 600 }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <FhirJsonDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Enrollment Waterfall - FHIR Data"
        data={researchSubjects}
      />
    </>
  );
}
