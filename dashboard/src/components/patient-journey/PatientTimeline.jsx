import React, { useState, useMemo, useCallback } from 'react';
import TimelineEvent from './TimelineEvent';
import { GRADE_COLORS } from '../../utils/fhirHelpers';

const LANE_CONFIG = [
  { key: 'medications', label: 'Study Drug' },
  { key: 'adverseEvents', label: 'Adverse Events' },
  { key: 'labAlerts', label: 'Lab Alerts' },
  { key: 'vitalAlerts', label: 'Vital Alerts' },
  { key: 'dispositions', label: 'Disposition' },
];

const LANE_HEIGHT = 48;
const LANE_GAP = 4;
const LABEL_WIDTH = 110;
const MARGIN = { top: 30, right: 20, bottom: 40, left: LABEL_WIDTH + 10 };

const AE_GRADE_COLORS = {
  1: '#FEF3C7',
  2: '#FB923C',
  3: '#EF4444',
  4: '#991B1B',
  5: '#000000',
};

function dateToMs(d) {
  if (!d) return null;
  const ms = new Date(d).getTime();
  return isNaN(ms) ? null : ms;
}

export default function PatientTimeline({
  medications = [],
  adverseEvents = [],
  labAlerts = [],
  vitalAlerts = [],
  dispositions = [],
  startDate,
  endDate,
  onEventClick,
}) {
  const [tooltip, setTooltip] = useState(null);

  const tStart = dateToMs(startDate);
  const tEnd = dateToMs(endDate);

  const totalHeight = MARGIN.top + LANE_CONFIG.length * (LANE_HEIGHT + LANE_GAP) + MARGIN.bottom;
  const svgWidth = '100%';
  const viewBoxWidth = 900;
  const plotWidth = viewBoxWidth - MARGIN.left - MARGIN.right;

  const scaleX = useCallback(
    (date) => {
      const ms = dateToMs(date);
      if (ms == null || !tStart || !tEnd || tEnd === tStart) return 0;
      const ratio = (ms - tStart) / (tEnd - tStart);
      return Math.max(0, Math.min(plotWidth, ratio * plotWidth));
    },
    [tStart, tEnd, plotWidth]
  );

  const ticks = useMemo(() => {
    if (!tStart || !tEnd) return [];
    const result = [];
    const step = (tEnd - tStart) / 6;
    for (let i = 0; i <= 6; i++) {
      const ms = tStart + step * i;
      result.push({
        x: (i / 6) * plotWidth,
        label: new Date(ms).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        }),
      });
    }
    return result;
  }, [tStart, tEnd, plotWidth]);

  const laneY = (index) => MARGIN.top + index * (LANE_HEIGHT + LANE_GAP);

  const showTooltip = (evt, eventData) => {
    const svg = evt.currentTarget.closest('svg');
    const pt = svg.createSVGPoint();
    pt.x = evt.clientX;
    pt.y = evt.clientY;
    const svgPt = pt.matrixTransform(svg.getScreenCTM().inverse());
    setTooltip({ x: svgPt.x, y: svgPt.y - 10, event: eventData });
  };

  const hideTooltip = () => setTooltip(null);

  if (!tStart || !tEnd) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-gray-400">
        No timeline data available
      </div>
    );
  }

  return (
    <div className="relative w-full">
      <svg
        width={svgWidth}
        viewBox={`0 0 ${viewBoxWidth} ${totalHeight}`}
        className="select-none"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Lane backgrounds and labels */}
        {LANE_CONFIG.map((lane, i) => {
          const y = laneY(i);
          return (
            <g key={lane.key}>
              <rect
                x={MARGIN.left}
                y={y}
                width={plotWidth}
                height={LANE_HEIGHT}
                rx={4}
                fill={i % 2 === 0 ? '#F9FAFB' : '#F3F4F6'}
              />
              <text
                x={MARGIN.left - 8}
                y={y + LANE_HEIGHT / 2}
                textAnchor="end"
                dominantBaseline="middle"
                className="text-[10px] fill-gray-500 font-medium"
              >
                {lane.label}
              </text>
            </g>
          );
        })}

        {/* X-axis ticks */}
        {ticks.map((t, i) => (
          <g key={i}>
            <line
              x1={MARGIN.left + t.x}
              y1={MARGIN.top - 4}
              x2={MARGIN.left + t.x}
              y2={MARGIN.top + LANE_CONFIG.length * (LANE_HEIGHT + LANE_GAP)}
              stroke="#E5E7EB"
              strokeDasharray="4,3"
            />
            <text
              x={MARGIN.left + t.x}
              y={totalHeight - 10}
              textAnchor="middle"
              className="text-[9px] fill-gray-400"
            >
              {t.label}
            </text>
          </g>
        ))}

        {/* Lane 0: Medications - dots */}
        {medications.map((med, i) => {
          const x = scaleX(med.date || med.authoredOn);
          const y0 = laneY(0);
          return (
            <circle
              key={`med-${i}`}
              cx={MARGIN.left + x}
              cy={y0 + LANE_HEIGHT / 2}
              r={5}
              fill="#2563EB"
              stroke="#fff"
              strokeWidth={1.5}
              className="cursor-pointer hover:opacity-80"
              onMouseEnter={(e) =>
                showTooltip(e, {
                  type: 'medication',
                  label: med.name || 'Study Drug',
                  date: med.date || med.authoredOn,
                  details: med.dose || '',
                  color: '#2563EB',
                })
              }
              onMouseLeave={hideTooltip}
              onClick={() => onEventClick && onEventClick(med, 'medication')}
            />
          );
        })}

        {/* Lane 1: Adverse Events - bars */}
        {adverseEvents.map((ae, i) => {
          const x1 = scaleX(ae.startDate || ae.date);
          const x2 = ae.endDate ? scaleX(ae.endDate) : x1 + 8;
          const y0 = laneY(1);
          const barWidth = Math.max(4, x2 - x1);
          const grade = ae.grade || 1;
          const color = AE_GRADE_COLORS[grade] || AE_GRADE_COLORS[1];
          const barY = y0 + 8 + (i % 3) * 10;
          return (
            <rect
              key={`ae-${i}`}
              x={MARGIN.left + x1}
              y={barY}
              width={barWidth}
              height={8}
              rx={2}
              fill={color}
              stroke={grade <= 1 ? '#D97706' : 'none'}
              strokeWidth={grade <= 1 ? 0.5 : 0}
              className="cursor-pointer hover:opacity-80"
              onMouseEnter={(e) =>
                showTooltip(e, {
                  type: 'ae',
                  label: ae.term || ae.event || 'Adverse Event',
                  date: ae.startDate || ae.date,
                  details: `Grade ${grade}${ae.serious ? ' (Serious)' : ''}${ae.outcome ? ` - ${ae.outcome}` : ''}`,
                  color,
                })
              }
              onMouseLeave={hideTooltip}
              onClick={() => onEventClick && onEventClick(ae, 'ae')}
            />
          );
        })}

        {/* Lane 2: Lab Alerts - triangles */}
        {labAlerts.map((lab, i) => {
          const x = scaleX(lab.date || lab.effectiveDateTime);
          const y0 = laneY(2) + LANE_HEIGHT / 2;
          const cx = MARGIN.left + x;
          return (
            <polygon
              key={`lab-${i}`}
              points={`${cx},${y0 - 7} ${cx - 6},${y0 + 5} ${cx + 6},${y0 + 5}`}
              fill="#EF4444"
              stroke="#fff"
              strokeWidth={1}
              className="cursor-pointer hover:opacity-80"
              onMouseEnter={(e) =>
                showTooltip(e, {
                  type: 'lab',
                  label: lab.name || lab.code || 'Lab Alert',
                  date: lab.date || lab.effectiveDateTime,
                  details: `Value: ${lab.value}${lab.unit ? ' ' + lab.unit : ''} (Range: ${lab.referenceRange || 'N/A'})`,
                  color: '#EF4444',
                })
              }
              onMouseLeave={hideTooltip}
              onClick={() => onEventClick && onEventClick(lab, 'observation')}
            />
          );
        })}

        {/* Lane 3: Vital Alerts - triangles */}
        {vitalAlerts.map((vital, i) => {
          const x = scaleX(vital.date || vital.effectiveDateTime);
          const y0 = laneY(3) + LANE_HEIGHT / 2;
          const cx = MARGIN.left + x;
          return (
            <polygon
              key={`vital-${i}`}
              points={`${cx},${y0 - 7} ${cx - 6},${y0 + 5} ${cx + 6},${y0 + 5}`}
              fill="#F59E0B"
              stroke="#fff"
              strokeWidth={1}
              className="cursor-pointer hover:opacity-80"
              onMouseEnter={(e) =>
                showTooltip(e, {
                  type: 'vital',
                  label: vital.name || vital.code || 'Vital Alert',
                  date: vital.date || vital.effectiveDateTime,
                  details: `Value: ${vital.value}${vital.unit ? ' ' + vital.unit : ''}`,
                  color: '#F59E0B',
                })
              }
              onMouseLeave={hideTooltip}
              onClick={() => onEventClick && onEventClick(vital, 'observation')}
            />
          );
        })}

        {/* Lane 4: Disposition - milestone dots */}
        {dispositions.map((disp, i) => {
          const x = scaleX(disp.date || disp.effectiveDateTime);
          const y0 = laneY(4) + LANE_HEIGHT / 2;
          return (
            <g key={`disp-${i}`}>
              <circle
                cx={MARGIN.left + x}
                cy={y0}
                r={7}
                fill="#10B981"
                stroke="#fff"
                strokeWidth={2}
                className="cursor-pointer hover:opacity-80"
                onMouseEnter={(e) =>
                  showTooltip(e, {
                    type: 'disposition',
                    label: disp.status || disp.type || 'Disposition',
                    date: disp.date || disp.effectiveDateTime,
                    details: disp.reason || '',
                    color: '#10B981',
                  })
                }
                onMouseLeave={hideTooltip}
                onClick={() => onEventClick && onEventClick(disp, 'disposition')}
              />
              <line
                x1={MARGIN.left + x}
                y1={y0 - 12}
                x2={MARGIN.left + x}
                y2={y0 - 7}
                stroke="#10B981"
                strokeWidth={2}
              />
            </g>
          );
        })}

        {/* Tooltip overlay */}
        {tooltip && (
          <foreignObject
            x={Math.min(tooltip.x, viewBoxWidth - 220)}
            y={Math.max(0, tooltip.y - 80)}
            width={220}
            height={100}
            className="pointer-events-none overflow-visible"
          >
            <TimelineEvent event={tooltip.event} />
          </foreignObject>
        )}
      </svg>

      {/* Grade legend */}
      <div className="flex items-center gap-4 mt-2 px-2 text-xs text-gray-500">
        <span className="font-medium">AE Grade:</span>
        {Object.entries(AE_GRADE_COLORS).map(([grade, color]) => (
          <span key={grade} className="flex items-center gap-1">
            <span
              className="inline-block w-3 h-3 rounded-sm border border-gray-300"
              style={{ backgroundColor: color }}
            />
            {grade}
          </span>
        ))}
      </div>
    </div>
  );
}
