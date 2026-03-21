import React, { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import { TrendingUp, ChevronDown } from 'lucide-react';
import Card from '../common/Card';
import FhirJsonDrawer from '../common/FhirJsonDrawer';
import { groupBy, ARM_COLORS } from '../../utils/fhirHelpers';

const LAB_TESTS = [
  { key: 'ALT', label: 'ALT (U/L)', uln: 40, lln: 7 },
  { key: 'AST', label: 'AST (U/L)', uln: 40, lln: 8 },
  { key: 'HGB', label: 'Hemoglobin (g/dL)', uln: 17.5, lln: 12.0 },
  { key: 'ANC', label: 'ANC (10^9/L)', uln: 7.0, lln: 1.5 },
  { key: 'PLT', label: 'Platelets (10^9/L)', uln: 400, lln: 150 },
  { key: 'CREAT', label: 'Creatinine (mg/dL)', uln: 1.2, lln: 0.6 },
  { key: 'TBILI', label: 'Total Bilirubin (mg/dL)', uln: 1.2, lln: 0.1 },
];

export default function LabTrendChart({ observations, patientArms }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedLab, setSelectedLab] = useState('ALT');

  const labConfig = LAB_TESTS.find((t) => t.key === selectedLab) || LAB_TESTS[0];

  const chartData = useMemo(() => {
    const obs = observations || [];

    // Filter to selected lab
    const labObs = obs.filter((o) => {
      const code = (o.code || o.testName || '').toUpperCase();
      return code.includes(selectedLab);
    });

    if (labObs.length === 0) return [];

    // Assign visit numbers based on date ordering per patient
    const byPatient = groupBy(labObs, (o) => o.patientId);
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
      const [visit, arm] = [parseInt(key.split('-')[0]), key.split('-').slice(1).join('-')];
      const values = group.map((d) => d.value).filter((v) => v != null);
      if (values.length === 0) return;
      const mean = values.reduce((s, v) => s + v, 0) / values.length;

      if (!visitMeans[visit]) {
        visitMeans[visit] = { visit: `Visit ${visit}` };
      }
      visitMeans[visit][arm] = parseFloat(mean.toFixed(2));
      visitMeans[visit][`${arm}_n`] = values.length;
    });

    return Object.values(visitMeans).sort(
      (a, b) => parseInt(a.visit.replace('Visit ', '')) - parseInt(b.visit.replace('Visit ', ''))
    );
  }, [observations, patientArms, selectedLab]);

  const fhirData = useMemo(() => {
    return (observations || []).slice(0, 50).map((o) => o._raw).filter(Boolean);
  }, [observations]);

  return (
    <>
      <Card
        title="Lab Values Trend Over Time"
        icon={<TrendingUp size={18} />}
        onShowFhir={() => setDrawerOpen(true)}
      >
        {/* Lab selector */}
        <div className="flex items-center gap-3 mb-4">
          <span className="text-sm text-gray-500">Lab Test:</span>
          <div className="relative">
            <select
              value={selectedLab}
              onChange={(e) => setSelectedLab(e.target.value)}
              className="appearance-none bg-white border border-gray-200 rounded-lg px-3 py-1.5 pr-8 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {LAB_TESTS.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </select>
            <ChevronDown
              size={14}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
            />
          </div>
        </div>

        {chartData.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-gray-400">
            No lab data available for {labConfig.label}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={chartData} margin={{ top: 10, right: 30, bottom: 10, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="visit" tick={{ fontSize: 12 }} />
              <YAxis
                label={{
                  value: labConfig.label,
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
              <ReferenceLine
                y={labConfig.uln}
                stroke="#EF4444"
                strokeDasharray="5 5"
                label={{ value: 'ULN', position: 'right', fill: '#EF4444', fontSize: 11 }}
              />
              <ReferenceLine
                y={labConfig.lln}
                stroke="#F59E0B"
                strokeDasharray="5 5"
                label={{ value: 'LLN', position: 'right', fill: '#F59E0B', fontSize: 11 }}
              />
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
        title="Lab Trend — FHIR Resources"
        data={fhirData}
      />
    </>
  );
}
