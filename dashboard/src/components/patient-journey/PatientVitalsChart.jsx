import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  ReferenceArea,
  Tooltip,
} from 'recharts';
import { Heart } from 'lucide-react';
import Card from '../../components/common/Card';
import FhirJsonDrawer from '../../components/common/FhirJsonDrawer';

const VITAL_TESTS = [
  { key: 'SBP', label: 'Systolic BP', color: '#EF4444' },
  { key: 'DBP', label: 'Diastolic BP', color: '#F97316' },
  { key: 'HR', label: 'Heart Rate', color: '#8B5CF6' },
  { key: 'WEIGHT', label: 'Weight', color: '#10B981' },
  { key: 'TEMP', label: 'Temperature', color: '#F59E0B' },
];

function matchesVital(obs, key) {
  const name = (obs.name || obs.code || obs.display || '').toUpperCase();
  switch (key) {
    case 'SBP':
      return name.includes('SYSTOLIC') || name.includes('SBP');
    case 'DBP':
      return name.includes('DIASTOLIC') || name.includes('DBP');
    case 'HR':
      return name.includes('HEART RATE') || name.includes('PULSE') || name === 'HR';
    case 'WEIGHT':
      return name.includes('WEIGHT') || name.includes('BODY MASS');
    case 'TEMP':
      return name.includes('TEMP') || name.includes('BODY TEMPERATURE');
    default:
      return false;
  }
}

function VitalSparkline({ label, data, color }) {
  const chartData = data
    .map((obs) => {
      const val = parseFloat(obs.value);
      if (isNaN(val)) return null;
      const date = obs.date || obs.effectiveDateTime || '';
      return {
        date,
        dateLabel: date
          ? new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          : '',
        value: val,
      };
    })
    .filter(Boolean)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  if (chartData.length === 0) return null;

  const unit = data[0]?.unit || '';
  const allValues = chartData.map((d) => d.value);
  const yMin = Math.min(...allValues) * 0.9;
  const yMax = Math.max(...allValues) * 1.1;

  return (
    <div className="bg-white rounded-lg border border-gray-100 p-2">
      <div className="flex items-center justify-between mb-1 px-1">
        <span className="text-xs font-semibold text-gray-700">{label}</span>
        {unit && <span className="text-[10px] text-gray-400">{unit}</span>}
      </div>
      <div className="h-24">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
            <XAxis dataKey="dateLabel" hide />
            <YAxis domain={[yMin, yMax]} hide />
            <Tooltip
              contentStyle={{ fontSize: 11, borderRadius: 6, padding: '4px 8px' }}
              formatter={(val) => [`${val} ${unit}`, label]}
              labelFormatter={(l) => l}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={1.5}
              dot={{ r: 3, fill: color, stroke: '#fff', strokeWidth: 1 }}
              activeDot={{ r: 5, fill: color }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default function PatientVitalsChart({ observations = [] }) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const vitalGroups = useMemo(() => {
    const groups = {};
    for (const vt of VITAL_TESTS) {
      const matched = observations.filter((obs) => matchesVital(obs, vt.key));
      if (matched.length > 0) {
        groups[vt.key] = { data: matched, label: vt.label, color: vt.color };
      }
    }
    return groups;
  }, [observations]);

  const keys = Object.keys(vitalGroups);

  if (keys.length === 0) {
    return (
      <Card title="Vital Signs" icon={Heart}>
        <p className="text-sm text-gray-400 py-4 text-center">
          No vital signs data available
        </p>
      </Card>
    );
  }

  return (
    <>
      <Card
        title="Vital Signs"
        icon={Heart}
        onShowFhir={() => setDrawerOpen(true)}
      >
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {keys.map((k) => (
            <VitalSparkline
              key={k}
              label={vitalGroups[k].label}
              data={vitalGroups[k].data}
              color={vitalGroups[k].color}
            />
          ))}
        </div>
      </Card>
      <FhirJsonDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Vital Signs FHIR Data"
        data={observations.map((o) => o._raw || o)}
      />
    </>
  );
}
