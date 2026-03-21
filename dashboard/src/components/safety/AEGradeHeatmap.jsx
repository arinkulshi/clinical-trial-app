import React, { useState, useMemo } from 'react';
import { Grid3X3 } from 'lucide-react';
import Card from '../common/Card';
import FhirJsonDrawer from '../common/FhirJsonDrawer';
import { groupBy, ARM_COLORS } from '../../utils/fhirHelpers';

const GRADES = [1, 2, 3, 4, 5];

function getCellColor(count, maxCount) {
  if (count === 0 || !maxCount) return 'bg-gray-50';
  const ratio = count / maxCount;
  if (ratio > 0.75) return 'bg-red-500 text-white';
  if (ratio > 0.5) return 'bg-orange-400 text-white';
  if (ratio > 0.25) return 'bg-yellow-400 text-gray-900';
  return 'bg-yellow-200 text-gray-900';
}

function HeatmapTable({ title, color, data, maxCount }) {
  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 mb-2">
        <span
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: color }}
        />
        <h4 className="text-sm font-semibold text-gray-700">{title}</h4>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>
              <th className="text-left py-1.5 px-2 text-gray-500 font-medium border-b border-gray-200 w-40">
                Preferred Term
              </th>
              {GRADES.map((g) => (
                <th
                  key={g}
                  className="text-center py-1.5 px-2 text-gray-500 font-medium border-b border-gray-200 w-14"
                >
                  G{g}
                </th>
              ))}
              <th className="text-center py-1.5 px-2 text-gray-500 font-medium border-b border-gray-200 w-14">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.term} className="hover:bg-gray-50/50">
                <td className="py-1 px-2 text-gray-700 border-b border-gray-100 truncate max-w-[160px]" title={row.term}>
                  {row.term}
                </td>
                {GRADES.map((g) => {
                  const count = row.grades[g] || 0;
                  return (
                    <td key={g} className="py-1 px-1 text-center border-b border-gray-100">
                      <span
                        className={`inline-block w-full rounded px-1 py-0.5 text-xs font-medium ${getCellColor(count, maxCount)}`}
                      >
                        {count > 0 ? count : ''}
                      </span>
                    </td>
                  );
                })}
                <td className="py-1 px-2 text-center font-semibold text-gray-700 border-b border-gray-100">
                  {row.total}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function AEGradeHeatmap({ adverseEvents, patientArms, filters }) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { pembroData, chemoData, maxCount } = useMemo(() => {
    let events = adverseEvents || [];

    // Apply filters
    if (filters.grade === 'Grade 1-2') {
      events = events.filter((e) => e.grade >= 1 && e.grade <= 2);
    } else if (filters.grade === 'Grade 3+') {
      events = events.filter((e) => e.grade >= 3);
    }
    if (filters.soc !== 'All') {
      events = events.filter((e) => e.soc === filters.soc);
    }

    // Split by arm
    const pembroEvents = events.filter((e) => patientArms[e.patientId] === 'PEMBRO');
    const chemoEvents = events.filter((e) => patientArms[e.patientId] === 'CHEMO');

    // Find top 15 terms overall
    const termCounts = {};
    events.forEach((e) => {
      const term = e.preferredTerm || e.term || 'Unknown';
      termCounts[term] = (termCounts[term] || 0) + 1;
    });
    const topTerms = Object.entries(termCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([term]) => term);

    const buildData = (armEvents) => {
      const termGroups = groupBy(armEvents, (e) => e.preferredTerm || e.term || 'Unknown');
      return topTerms.map((term) => {
        const termEvts = termGroups[term] || [];
        const grades = {};
        let total = 0;
        termEvts.forEach((e) => {
          const g = e.grade || 0;
          if (g >= 1 && g <= 5) {
            grades[g] = (grades[g] || 0) + 1;
            total++;
          }
        });
        return { term, grades, total };
      });
    };

    const pData = buildData(pembroEvents);
    const cData = buildData(chemoEvents);

    // Find global max for consistent coloring
    let max = 0;
    [...pData, ...cData].forEach((row) => {
      GRADES.forEach((g) => {
        if ((row.grades[g] || 0) > max) max = row.grades[g];
      });
    });

    return { pembroData: pData, chemoData: cData, maxCount: max };
  }, [adverseEvents, patientArms, filters]);

  const fhirData = useMemo(() => {
    return (adverseEvents || []).slice(0, 50).map((e) => e._raw).filter(Boolean);
  }, [adverseEvents]);

  return (
    <>
      <Card
        title="AE Grade Distribution Heatmap"
        icon={<Grid3X3 size={18} />}
        onShowFhir={() => setDrawerOpen(true)}
      >
        {pembroData.length === 0 && chemoData.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-gray-400">
            No adverse events match the current filters
          </div>
        ) : (
          <div className="flex gap-6 overflow-x-auto">
            {(filters.arm === 'All' || filters.arm === 'PEMBRO') && (
              <HeatmapTable
                title="PEMBRO"
                color={ARM_COLORS.PEMBRO || '#3B82F6'}
                data={pembroData}
                maxCount={maxCount}
              />
            )}
            {(filters.arm === 'All' || filters.arm === 'CHEMO') && (
              <HeatmapTable
                title="CHEMO"
                color={ARM_COLORS.CHEMO || '#8B5CF6'}
                data={chemoData}
                maxCount={maxCount}
              />
            )}
          </div>
        )}

        {/* Color legend */}
        <div className="flex items-center gap-3 mt-4 pt-3 border-t border-gray-100 text-xs text-gray-500">
          <span>Intensity:</span>
          <span className="inline-block w-6 h-4 rounded bg-gray-50 border border-gray-200" />
          <span>0</span>
          <span className="inline-block w-6 h-4 rounded bg-yellow-200" />
          <span>Low</span>
          <span className="inline-block w-6 h-4 rounded bg-yellow-400" />
          <span>Med</span>
          <span className="inline-block w-6 h-4 rounded bg-orange-400" />
          <span>High</span>
          <span className="inline-block w-6 h-4 rounded bg-red-500" />
          <span>Very High</span>
        </div>
      </Card>
      <FhirJsonDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="AE Grade Heatmap — FHIR Resources"
        data={fhirData}
      />
    </>
  );
}
