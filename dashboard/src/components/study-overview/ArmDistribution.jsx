import { useState, useMemo } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { PieChart as PieIcon } from 'lucide-react';
import Card from '../common/Card';
import FhirJsonDrawer from '../common/FhirJsonDrawer';
import { ARM_COLORS, getPatientArms, pct } from '../../utils/fhirHelpers';

function buildArmData(researchSubjects) {
  const armMap = getPatientArms(researchSubjects);
  const counts = { PEMBRO: 0, CHEMO: 0 };

  for (const arm of Object.values(armMap)) {
    const key = arm.toUpperCase().includes('PEMBRO') ? 'PEMBRO' : 'CHEMO';
    counts[key]++;
  }

  const total = counts.PEMBRO + counts.CHEMO;
  return [
    { name: 'PEMBRO', value: counts.PEMBRO, pct: pct(counts.PEMBRO, total) },
    { name: 'CHEMO', value: counts.CHEMO, pct: pct(counts.CHEMO, total) },
  ];
}

const RADIAN = Math.PI / 180;
const renderCenterLabel = ({ cx, cy }, total) => (
  <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central">
    <tspan x={cx} dy="-0.4em" className="text-2xl font-bold" fill="#1F2937">{total}</tspan>
    <tspan x={cx} dy="1.4em" className="text-xs" fill="#6B7280">Patients</tspan>
  </text>
);

export default function ArmDistribution({ researchSubjects }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const data = useMemo(() => buildArmData(researchSubjects), [researchSubjects]);
  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <>
      <Card
        title="Arm Distribution"
        icon={PieIcon}
        onShowFhir={() => setDrawerOpen(true)}
      >
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={70}
              outerRadius={100}
              paddingAngle={3}
              dataKey="value"
              nameKey="name"
              label={({ name, pct: p }) => `${name}: ${p}%`}
              labelLine={false}
            >
              {data.map((entry) => (
                <Cell
                  key={entry.name}
                  fill={ARM_COLORS[entry.name] || '#94A3B8'}
                  stroke="none"
                />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, name) => [`${value} patients`, name]}
              contentStyle={{ borderRadius: '8px', fontSize: '13px' }}
            />
            <Legend
              wrapperStyle={{ fontSize: '13px' }}
              formatter={(value, entry) => {
                const item = data.find((d) => d.name === value);
                return `${value} (${item?.value || 0})`;
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </Card>

      <FhirJsonDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Arm Distribution - FHIR Data"
        data={researchSubjects}
      />
    </>
  );
}
