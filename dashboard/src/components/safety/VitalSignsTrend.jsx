import React, { useState, useMemo } from 'react';
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
import { HeartPulse } from 'lucide-react';
import Card from '../common/Card';
import FhirJsonDrawer from '../common/FhirJsonDrawer';
import { groupBy, ARM_COLORS } from '../../utils/fhirHelpers';

const VITAL_SIGNS = [
  { key: 'SBP', label: 'Systolic BP (mmHg)', codes: ['SBP', 'SYSTOLIC', '8480-6'] },
  { key: 'DBP', label: 'Diastolic BP (mmHg)', codes: ['DBP', 'DIASTOLIC', '8462-4'] },
  { key: 'HR', label: 'Heart Rate (bpm)', codes: ['HR', 'HEART RATE', '8867-4'] },
  { key: 'WEIGHT', label: 'Weight (kg)', codes: ['WEIGHT', '29463-7'] },
  { key: 'TEMP', label: 'Temperature (\u00B0C)', codes: ['TEMP', 'TEMPERATURE', '8310-5'] },
];

export default function VitalSignsTrend({ observations, patientArms }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedVital, setSelectedVital] = useState('SBP');

  const vitalConfig = VITAL_SIGNS.find((v) => v.key === selectedVital) || VITAL_SIGNS[0];

  const chartData = useMemo(() => {
    const obs = observations || [];

    // Filter to selected vital sign
    const vitalObs = obs.filter((o) => {
      const code = (o.code || o.testName || '').toUpperCase();
      return vitalConfig.codes.some((c) => code.includes(c));
    });

    if (vitalObs.length === 0) return [];

    // Group by patient, assign visit numbers
    const byPatient = groupBy(vitalObs, (o) => o.patientId);
    const allVisitData = [];

    Object.entries(byPatient).forEach(([patientId, patientObs]) => {
      const sorted = [...patientObs].sort(
        (a, b) => new Date(a.effectiveDate || 0) - new Date(b.effectiveDate || 0)
      );
      sorted.forEach((o, idx) => {
        allVisitData.push({
          patientId,
          arm: patientArms[patientId] || 'Unknown',
          visit: idx + 1,
          value: o.value,
        });
      });
    });

    // Calculate mean per visit per arm
    const visitArmGroups = groupBy(allVisitData, (d) => `${d.visit}-${d.arm}`);
    const visitMeans = {};

    Object.entries(visitArmGroups).forEach(([key, group]) => {
      const [visit, ...armParts] = key.split('-');
      const arm = armParts.join('-');
      const visitNum = parseInt(visit);
      const values = group.map((d) => d.value).filter((v) => v != null);
      if (values.length === 0) return;
      const mean = values.reduce((s, v) => s + v, 0) / values.length;

      if (!visitMeans[visitNum]) {
        visitMeans[visitNum] = { visit: `Visit ${visitNum}` };
      }
      visitMeans[visitNum][arm] = parseFloat(mean.toFixed(2));
      visitMeans[visitNum][`${arm}_n`] = values.length;
    });

    return Object.values(visitMeans).sort(
      (a, b) =>
        parseInt(a.visit.replace('Visit ', '')) -
        parseInt(b.visit.replace('Visit ', ''))
    );
  }, [observations, patientArms, selectedVital, vitalConfig]);

  const fhirData = useMemo(() => {
    return (observations || []).slice(0, 50).map((o) => o._raw).filter(Boolean);
  }, [observations]);

  return (
    <>
      <Card
        title="Vital Signs Trend Over Time"
        icon={<HeartPulse size={18} />}
        onShowFhir={() => setDrawerOpen(true)}
      >
        {/* Vital sign tab selector */}
        <div className="flex flex-wrap gap-1 mb-4">
          {VITAL_SIGNS.map((vs) => (
            <button
              key={vs.key}
              onClick={() => setSelectedVital(vs.key)}
              className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                selectedVital === vs.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {vs.key}
            </button>
          ))}
        </div>

        {chartData.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-gray-400">
            No vital sign data available for {vitalConfig.label}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={chartData} margin={{ top: 10, right: 30, bottom: 10, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="visit" tick={{ fontSize: 12 }} />
              <YAxis
                label={{
                  value: vitalConfig.label,
                  angle: -90,
                  position: 'insideLeft',
                  offset: -5,
                  style: { fontSize: 12 },
                }}
              />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }}
                formatter={(value, name) => [
                  `${value} (n=${chartData.find((d) => d[name] === value)?.[`${name}_n`] || '?'})`,
                  name,
                ]}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="PEMBRO"
                stroke={ARM_COLORS.PEMBRO || '#3B82F6'}
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="CHEMO"
                stroke={ARM_COLORS.CHEMO || '#8B5CF6'}
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Card>
      <FhirJsonDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Vital Signs — FHIR Resources"
        data={fhirData}
      />
    </>
  );
}
