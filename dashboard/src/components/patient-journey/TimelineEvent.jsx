import React from 'react';
import { Pill, AlertTriangle, FlaskConical, Heart, Flag } from 'lucide-react';

const TYPE_ICONS = {
  medication: Pill,
  ae: AlertTriangle,
  lab: FlaskConical,
  vital: Heart,
  disposition: Flag,
};

export default function TimelineEvent({ event }) {
  if (!event) return null;

  const Icon = TYPE_ICONS[event.type] || Flag;

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-3 min-w-[200px] max-w-xs text-sm z-50">
      <div className="flex items-center gap-2 mb-1.5">
        <span
          className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: event.color || '#6B7280' }}
        >
          <Icon className="w-3 h-3 text-white" />
        </span>
        <span className="font-semibold text-gray-800 truncate">
          {event.label}
        </span>
      </div>
      <p className="text-xs text-gray-500 mb-1">{event.date}</p>
      {event.details && (
        <p className="text-xs text-gray-600 leading-relaxed">{event.details}</p>
      )}
    </div>
  );
}
