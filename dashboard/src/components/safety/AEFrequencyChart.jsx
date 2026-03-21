import React, { useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { BarChart3 } from 'lucide-react';
import Card from '../common/Card';
import FhirJsonDrawer from '../common/FhirJsonDrawer';
import { groupBy, ARM_COLORS } from '../../utils/fhirHelpers';

export default function AEFrequencyChart({ adverseEvents, patientArms, filters }) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const chartData = useMemo(() => {
    let events = adverseEvents || [];

    // Apply filters
    if (filters.arm !== 'All') {
      const armPatientIds = new Set(
        Object.entries(patientArms)
          .filter(([, arm]) => arm === filters.arm)
          .map(([id]) => id)
      );
      events = events.filter((e) => armPatientIds.has(e.patientId));
    }
    if (filters.grade === 'Grade 1-2') {
      events = events.filter((e) => e.grade >= 1 && e.grade <= 2);
    } else if (filters.grade === 'Grade 3+') {
      events = events.filter((e) => e.grade >= 3);
    }
    if (filters.soc !== 'All') {
      events = events.filter((e) => e.soc === filters.soc);
    }

    // Group by SOC and arm
    const socGroups = groupBy(events, (e) => e.soc || 'Unknown');
    const data = Object.entries(socGroups).map(([soc, socEvents]) => {
      const pembroCount = socEvents.filter(
        (e) => patientArms[e.patientId] === 'PEMBRO'
      ).length;
      const chemoCount = socEvents.filter(
        (e) => patientArms[e.patientId] === 'CHEMO'
      ).length;
      return {
        soc,
        PEMBRO: pembroCount,
        CHEMO: chemoCount,
        total: pembroCount + chemoCount,
      };
    });

    // Sort and take top 15
    data.sort((a, b) => b.total - a.total);
    return data.slice(0, 15);
  }, [adverseEvents, patientArms, filters]);

  const fhirData = useMemo(() => {
    return (adverseEvents || []).slice(0, 50).map((e) => e._raw).filter(Boolean);
  }, [adverseEvents]);

  return (
    <>
      <Card
        title="AE Frequency by System Organ Class"
        icon={<BarChart3 size={18} />}
        onShowFhir={() => setDrawerOpen(true)}
      >
        {chartData.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-gray-400">
            No adverse events match the current filters
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(400, chartData.length * 32)}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 180, right: 30, top: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" />
              <YAxis
                type="category"
                dataKey="soc"
                width={170}
                tick={{ fontSize: 12 }}
              />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }}
              />
              <Legend />
              <Bar
                dataKey="PEMBRO"
                stackId="a"
                fill={ARM_COLORS.PEMBRO || '#3B82F6'}
                radius={[0, 0, 0, 0]}
              />
              <Bar
                dataKey="CHEMO"
                stackId="a"
                fill={ARM_COLORS.CHEMO || '#8B5CF6'}
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>
      <FhirJsonDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="AE Frequency — FHIR Resources"
        data={fhirData}
      />
    </>
  );
}
