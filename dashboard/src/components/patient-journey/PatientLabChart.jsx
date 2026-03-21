import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  ReferenceArea,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import { FlaskConical } from 'lucide-react';
import Card from '../../components/common/Card';
import FhirJsonDrawer from '../../components/common/FhirJsonDrawer';

const LAB_TESTS = ['ALT', 'AST', 'HGB', 'ANC', 'PLT', 'Creatinine', 'Bilirubin'];

function extractLabName(obs) {
  const name = obs.name || obs.code || obs.display || '';
  return name.toUpperCase().trim();
}

function matchesLabTest(obs, test) {
  const name = extractLabName(obs);
  return name.includes(test.toUpperCase());
}

function CustomDot({ cx, cy, payload }) {
  const outOfRange = payload && payload.outOfRange;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={outOfRange ? 4 : 3}
      fill={outOfRange ? '#EF4444' : '#2563EB'}
      stroke="#fff"
      strokeWidth={1}
    />
  );
}

function LabSparkline({ testName, data, refLow, refHigh }) {
  const chartData = data
    .map((obs) => {
      const val = parseFloat(obs.value);
      if (isNaN(val)) return null;
      const date = obs.date || obs.effectiveDateTime || '';
      const outOfRange =
        (refLow != null && val < refLow) || (refHigh != null && val > refHigh);
      return {
        date,
        dateLabel: date ? new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '',
        value: val,
        outOfRange,
      };
    })
    .filter(Boolean)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  if (chartData.length === 0) return null;

  const unit = data[0]?.unit || '';
  const allValues = chartData.map((d) => d.value);
  const yMin = Math.min(...allValues, refLow ?? Infinity) * 0.9;
  const yMax = Math.max(...allValues, refHigh ?? -Infinity) * 1.1;

  return (
    <div className="bg-white rounded-lg border border-gray-100 p-2">
      <div className="flex items-center justify-between mb-1 px-1">
        <span className="text-xs font-semibold text-gray-700">{testName}</span>
        {unit && <span className="text-[10px] text-gray-400">{unit}</span>}
      </div>
      <div className="h-24">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
            {refLow != null && refHigh != null && (
              <ReferenceArea
                y1={refLow}
                y2={refHigh}
                fill="#D1FAE5"
                fillOpacity={0.4}
                strokeOpacity={0}
              />
            )}
            <XAxis dataKey="dateLabel" hide />
            <YAxis domain={[yMin, yMax]} hide />
            <Tooltip
              contentStyle={{ fontSize: 11, borderRadius: 6, padding: '4px 8px' }}
              formatter={(val) => [`${val} ${unit}`, testName]}
              labelFormatter={(label) => label}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#2563EB"
              strokeWidth={1.5}
              dot={<CustomDot />}
              activeDot={{ r: 5, fill: '#2563EB' }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {refLow != null && refHigh != null && (
        <p className="text-[10px] text-gray-400 px-1 mt-0.5">
          Ref: {refLow} - {refHigh} {unit}
        </p>
      )}
    </div>
  );
}

export default function PatientLabChart({ observations = [] }) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const labGroups = useMemo(() => {
    const groups = {};
    for (const test of LAB_TESTS) {
      const matched = observations.filter((obs) => matchesLabTest(obs, test));
      if (matched.length > 0) {
        const refLow = matched[0]?.referenceLow != null ? parseFloat(matched[0].referenceLow) : null;
        const refHigh = matched[0]?.referenceHigh != null ? parseFloat(matched[0].referenceHigh) : null;
        groups[test] = { data: matched, refLow, refHigh };
      }
    }
    return groups;
  }, [observations]);

  const testNames = Object.keys(labGroups);

  if (testNames.length === 0) {
    return (
      <Card title="Laboratory Results" icon={FlaskConical}>
        <p className="text-sm text-gray-400 py-4 text-center">
          No laboratory data available
        </p>
      </Card>
    );
  }

  return (
    <>
      <Card
        title="Laboratory Results"
        icon={FlaskConical}
        onShowFhir={() => setDrawerOpen(true)}
      >
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {testNames.map((test) => (
            <LabSparkline
              key={test}
              testName={test}
              data={labGroups[test].data}
              refLow={labGroups[test].refLow}
              refHigh={labGroups[test].refHigh}
            />
          ))}
        </div>
      </Card>
      <FhirJsonDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Lab Observations FHIR Data"
        data={observations.map((o) => o._raw || o)}
      />
    </>
  );
}
