import React, { useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { ArrowLeftRight } from 'lucide-react';
import Card from '../common/Card';
import FhirJsonDrawer from '../common/FhirJsonDrawer';
import { groupBy, ARM_COLORS } from '../../utils/fhirHelpers';

const PEMBRO_LIGHT = '#93C5FD';
const PEMBRO_DARK = '#1D4ED8';
const CHEMO_LIGHT = '#C4B5FD';
const CHEMO_DARK = '#6D28D9';

function getBarColor(gradeHighPct, arm) {
  // Interpolate between light and dark based on grade 3+ proportion
  if (arm === 'PEMBRO') {
    return gradeHighPct > 0.5 ? PEMBRO_DARK : gradeHighPct > 0.2 ? ARM_COLORS.PEMBRO || '#3B82F6' : PEMBRO_LIGHT;
  }
  return gradeHighPct > 0.5 ? CHEMO_DARK : gradeHighPct > 0.2 ? ARM_COLORS.CHEMO || '#8B5CF6' : CHEMO_LIGHT;
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0]?.payload;
  if (!data) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-gray-800 mb-1">{data.term}</p>
      <p style={{ color: ARM_COLORS.PEMBRO || '#3B82F6' }}>
        PEMBRO: {data.pembroRate.toFixed(1)}% ({data.pembroCount} events, {(data.pembroGrade3Pct * 100).toFixed(0)}% Grade 3+)
      </p>
      <p style={{ color: ARM_COLORS.CHEMO || '#8B5CF6' }}>
        CHEMO: {data.chemoRate.toFixed(1)}% ({data.chemoCount} events, {(data.chemoGrade3Pct * 100).toFixed(0)}% Grade 3+)
      </p>
    </div>
  );
}

export default function AEButterflyPlot({ adverseEvents, patientArms, patientCounts, filters }) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const chartData = useMemo(() => {
    let events = adverseEvents || [];
    const pembroTotal = patientCounts?.PEMBRO || 1;
    const chemoTotal = patientCounts?.CHEMO || 1;

    // Apply filters
    if (filters.grade === 'Grade 1-2') {
      events = events.filter((e) => e.grade >= 1 && e.grade <= 2);
    } else if (filters.grade === 'Grade 3+') {
      events = events.filter((e) => e.grade >= 3);
    }
    if (filters.soc !== 'All') {
      events = events.filter((e) => e.soc === filters.soc);
    }

    // Group by preferred term
    const termGroups = groupBy(events, (e) => e.preferredTerm || e.term || 'Unknown');

    const data = Object.entries(termGroups).map(([term, termEvents]) => {
      const pembroEvents = termEvents.filter((e) => patientArms[e.patientId] === 'PEMBRO');
      const chemoEvents = termEvents.filter((e) => patientArms[e.patientId] === 'CHEMO');

      // Count unique patients per arm
      const pembroPatients = new Set(pembroEvents.map((e) => e.patientId)).size;
      const chemoPatients = new Set(chemoEvents.map((e) => e.patientId)).size;

      const pembroGrade3 = pembroEvents.filter((e) => e.grade >= 3).length;
      const chemoGrade3 = chemoEvents.filter((e) => e.grade >= 3).length;

      return {
        term,
        pembroCount: pembroEvents.length,
        chemoCount: chemoEvents.length,
        pembroRate: (pembroPatients / pembroTotal) * 100,
        chemoRate: (chemoPatients / chemoTotal) * 100,
        // Negative for left side (PEMBRO)
        PEMBRO: -((pembroPatients / pembroTotal) * 100),
        CHEMO: (chemoPatients / chemoTotal) * 100,
        pembroGrade3Pct: pembroEvents.length > 0 ? pembroGrade3 / pembroEvents.length : 0,
        chemoGrade3Pct: chemoEvents.length > 0 ? chemoGrade3 / chemoEvents.length : 0,
        total: pembroPatients + chemoPatients,
      };
    });

    data.sort((a, b) => b.total - a.total);
    return data.slice(0, 15).reverse(); // Reverse so highest is at top
  }, [adverseEvents, patientArms, patientCounts, filters]);

  // Only show relevant arms
  const showPembro = filters.arm === 'All' || filters.arm === 'PEMBRO';
  const showChemo = filters.arm === 'All' || filters.arm === 'CHEMO';

  const fhirData = useMemo(() => {
    return (adverseEvents || []).slice(0, 50).map((e) => e._raw).filter(Boolean);
  }, [adverseEvents]);

  const maxVal = useMemo(() => {
    if (!chartData.length) return 50;
    const max = Math.max(
      ...chartData.map((d) => Math.max(Math.abs(d.PEMBRO), d.CHEMO))
    );
    return Math.ceil(max / 10) * 10 + 10;
  }, [chartData]);

  return (
    <>
      <Card
        title="AE Butterfly Plot — Incidence by Arm"
        icon={<ArrowLeftRight size={18} />}
        onShowFhir={() => setDrawerOpen(true)}
      >
        {chartData.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-gray-400">
            No adverse events match the current filters
          </div>
        ) : (
          <>
            {/* Legend */}
            <div className="flex justify-center gap-6 mb-2 text-sm">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded" style={{ backgroundColor: ARM_COLORS.PEMBRO || '#3B82F6' }} />
                <span className="text-gray-600">PEMBRO (%)</span>
                <span className="text-gray-400 ml-1">← left</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-gray-400 mr-1">right →</span>
                <span className="w-3 h-3 rounded" style={{ backgroundColor: ARM_COLORS.CHEMO || '#8B5CF6' }} />
                <span className="text-gray-600">CHEMO (%)</span>
              </div>
            </div>

            <ResponsiveContainer width="100%" height={Math.max(400, chartData.length * 32)}>
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ left: 140, right: 30, top: 10, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis
                  type="number"
                  domain={[-maxVal, maxVal]}
                  tickFormatter={(v) => `${Math.abs(v).toFixed(0)}%`}
                />
                <YAxis
                  type="category"
                  dataKey="term"
                  width={130}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine x={0} stroke="#374151" strokeWidth={2} />
                {showPembro && (
                  <Bar dataKey="PEMBRO" name="PEMBRO">
                    {chartData.map((entry, idx) => (
                      <Cell
                        key={idx}
                        fill={getBarColor(entry.pembroGrade3Pct, 'PEMBRO')}
                      />
                    ))}
                  </Bar>
                )}
                {showChemo && (
                  <Bar dataKey="CHEMO" name="CHEMO">
                    {chartData.map((entry, idx) => (
                      <Cell
                        key={idx}
                        fill={getBarColor(entry.chemoGrade3Pct, 'CHEMO')}
                      />
                    ))}
                  </Bar>
                )}
              </BarChart>
            </ResponsiveContainer>

            {/* Grade intensity legend */}
            <div className="flex justify-center gap-4 mt-2 text-xs text-gray-500">
              <span>Lighter = mostly Grade 1-2</span>
              <span>|</span>
              <span>Darker = higher Grade 3+ proportion</span>
            </div>
          </>
        )}
      </Card>
      <FhirJsonDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Butterfly Plot — FHIR Resources"
        data={fhirData}
      />
    </>
  );
}
