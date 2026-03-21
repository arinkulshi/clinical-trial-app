import { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import Card from '../common/Card';
import FhirJsonDrawer from '../common/FhirJsonDrawer';
import { ARM_COLORS, getPatientArms } from '../../utils/fhirHelpers';

function buildTimelineData(researchSubjects) {
  const armMap = getPatientArms(researchSubjects);

  // Collect enrollment dates per arm
  const events = [];
  for (const rs of researchSubjects) {
    const date = rs.period?.start;
    if (!date) continue;
    const patRef = rs.individual?.reference || rs.subject?.reference;
    const arm = patRef ? (armMap[patRef] || 'Unknown') : 'Unknown';
    events.push({ date: date.slice(0, 10), arm });
  }

  // Sort by date
  events.sort((a, b) => a.date.localeCompare(b.date));

  // Build cumulative counts per date
  const dateMap = {};
  const cumulative = { PEMBRO: 0, CHEMO: 0 };

  for (const e of events) {
    const armKey = e.arm.toUpperCase().includes('PEMBRO') ? 'PEMBRO' : 'CHEMO';
    cumulative[armKey]++;
    dateMap[e.date] = { ...cumulative };
  }

  return Object.entries(dateMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, counts]) => ({
      date,
      PEMBRO: counts.PEMBRO,
      CHEMO: counts.CHEMO,
    }));
}

export default function EnrollmentTimeline({ researchSubjects }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const data = useMemo(() => buildTimelineData(researchSubjects), [researchSubjects]);

  return (
    <>
      <Card
        title="Enrollment Timeline"
        icon={TrendingUp}
        onShowFhir={() => setDrawerOpen(true)}
      >
        {data.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No enrollment date data available</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11 }}
                tickFormatter={(d) => {
                  const parts = d.split('-');
                  return `${parts[1]}/${parts[2]}`;
                }}
              />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                labelFormatter={(d) => `Date: ${d}`}
                contentStyle={{ borderRadius: '8px', fontSize: '13px' }}
              />
              <Legend wrapperStyle={{ fontSize: '13px' }} />
              <Line
                type="monotone"
                dataKey="PEMBRO"
                stroke={ARM_COLORS.PEMBRO}
                strokeWidth={2}
                dot={{ r: 2 }}
                activeDot={{ r: 5 }}
              />
              <Line
                type="monotone"
                dataKey="CHEMO"
                stroke={ARM_COLORS.CHEMO}
                strokeWidth={2}
                dot={{ r: 2 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Card>

      <FhirJsonDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Enrollment Timeline - FHIR Data"
        data={researchSubjects}
      />
    </>
  );
}
