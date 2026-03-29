import React, { useState, useMemo } from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { FlaskConical, ChevronDown } from 'lucide-react';
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

function CustomTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-medium text-gray-700">Patient: {d.patientId?.slice(-8)}</p>
      <p className="text-gray-600">Arm: {d.arm}</p>
      <p className="text-gray-600">Baseline: {d.baseline?.toFixed(2)}</p>
      <p className="text-gray-600">Worst Post-BL: {d.worst?.toFixed(2)}</p>
    </div>
  );
}

export default function LabShiftPlot({ observations, patientArms }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedLab, setSelectedLab] = useState('ALT');

  const labConfig = LAB_TESTS.find((t) => t.key === selectedLab) || LAB_TESTS[0];

  const { pembroData, chemoData } = useMemo(() => {
    const obs = observations || [];

    // Filter observations matching selected lab test (match against display name, not LOINC code)
    const labObs = obs.filter((o) => {
      const label = (o.display || o.testName || '').toUpperCase();
      return label.includes(selectedLab);
    });

    // Group by patient
    const byPatient = groupBy(labObs, (o) => o.patientId);

    const pembro = [];
    const chemo = [];

    Object.entries(byPatient).forEach(([patientId, patientObs]) => {
      // Sort by date
      const sorted = [...patientObs].sort(
        (a, b) => new Date(a.effectiveDate || 0) - new Date(b.effectiveDate || 0)
      );

      if (sorted.length < 2) return;

      const baseline = sorted[0].value;
      const postBaseline = sorted.slice(1).map((o) => o.value).filter((v) => v != null);
      if (baseline == null || postBaseline.length === 0) return;

      // Determine worst post-baseline (highest for liver enzymes, lowest for blood counts)
      const isHighWorst = ['ALT', 'AST', 'CREAT', 'TBILI'].includes(selectedLab);
      const worst = isHighWorst
        ? Math.max(...postBaseline)
        : Math.min(...postBaseline);

      const point = { patientId, baseline, worst, arm: patientArms[patientId] || 'Unknown' };

      if (patientArms[patientId] === 'PEMBRO') {
        pembro.push(point);
      } else if (patientArms[patientId] === 'CHEMO') {
        chemo.push(point);
      }
    });

    return { pembroData: pembro, chemoData: chemo };
  }, [observations, patientArms, selectedLab]);

  const fhirData = useMemo(() => {
    return (observations || []).slice(0, 50).map((o) => o._raw).filter(Boolean);
  }, [observations]);

  const allPoints = [...pembroData, ...chemoData];
  const allVals = allPoints.flatMap((p) => [p.baseline, p.worst]).filter((v) => v != null);
  const minVal = allVals.length > 0 ? Math.min(...allVals) * 0.8 : 0;
  const maxVal = allVals.length > 0 ? Math.max(...allVals) * 1.2 : labConfig.uln * 2;

  return (
    <>
      <Card
        title="Lab Shift Plot (Baseline vs. Worst Post-Baseline)"
        icon={<FlaskConical size={18} />}
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

        {allPoints.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-gray-400">
            No lab data available for {labConfig.label}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={400}>
            <ScatterChart margin={{ top: 10, right: 30, bottom: 40, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                type="number"
                dataKey="baseline"
                name="Baseline"
                domain={[minVal, maxVal]}
                label={{ value: `Baseline ${labConfig.label}`, position: 'bottom', offset: 20 }}
              />
              <YAxis
                type="number"
                dataKey="worst"
                name="Worst Post-BL"
                domain={[minVal, maxVal]}
                label={{ value: `Worst Post-BL ${labConfig.label}`, angle: -90, position: 'insideLeft', offset: -5 }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend verticalAlign="top" />
              {/* Reference lines for ULN/LLN */}
              <ReferenceLine x={labConfig.uln} stroke="#EF4444" strokeDasharray="5 5" label={{ value: 'ULN', position: 'top', fill: '#EF4444', fontSize: 11 }} />
              <ReferenceLine y={labConfig.uln} stroke="#EF4444" strokeDasharray="5 5" />
              <ReferenceLine x={labConfig.lln} stroke="#F59E0B" strokeDasharray="5 5" label={{ value: 'LLN', position: 'top', fill: '#F59E0B', fontSize: 11 }} />
              <ReferenceLine y={labConfig.lln} stroke="#F59E0B" strokeDasharray="5 5" />
              {/* Identity line (y=x) — approximated with a reference line from min to max */}
              <Scatter
                name="PEMBRO"
                data={pembroData}
                fill={ARM_COLORS.PEMBRO || '#3B82F6'}
                opacity={0.7}
                r={4}
              />
              <Scatter
                name="CHEMO"
                data={chemoData}
                fill={ARM_COLORS.CHEMO || '#8B5CF6'}
                opacity={0.7}
                r={4}
              />
            </ScatterChart>
          </ResponsiveContainer>
        )}

        <div className="text-xs text-gray-400 mt-2 text-center">
          Red dashed lines = ULN ({labConfig.uln}), Yellow dashed lines = LLN ({labConfig.lln})
        </div>
      </Card>
      <FhirJsonDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Lab Shift Plot — FHIR Resources"
        data={fhirData}
      />
    </>
  );
}
