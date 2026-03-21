import React, { useState } from 'react';
import { X, AlertTriangle, Pill, FlaskConical, Heart, Flag, Code } from 'lucide-react';

const TYPE_CONFIG = {
  ae: {
    icon: AlertTriangle,
    label: 'Adverse Event',
    color: '#EF4444',
  },
  medication: {
    icon: Pill,
    label: 'Medication Administration',
    color: '#2563EB',
  },
  observation: {
    icon: FlaskConical,
    label: 'Observation',
    color: '#8B5CF6',
  },
  vital: {
    icon: Heart,
    label: 'Vital Sign',
    color: '#F59E0B',
  },
  disposition: {
    icon: Flag,
    label: 'Disposition',
    color: '#10B981',
  },
};

function formatAeSummary(event) {
  const raw = event._raw || event;
  const term =
    raw.event?.coding?.[0]?.display ||
    event.term ||
    event.event ||
    'Unknown Event';
  const grade = event.grade || 'N/A';
  const serious = event.serious ? 'Yes' : 'No';
  const onset = event.startDate || event.date || 'Unknown';
  const resolved = event.endDate || 'Ongoing';
  const outcome = event.outcome || 'N/A';

  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
      <dt className="text-gray-500">Term</dt>
      <dd className="font-medium">{term}</dd>
      <dt className="text-gray-500">CTCAE Grade</dt>
      <dd className="font-medium">{grade}</dd>
      <dt className="text-gray-500">Serious</dt>
      <dd className="font-medium">{serious}</dd>
      <dt className="text-gray-500">Onset</dt>
      <dd className="font-medium">{onset}</dd>
      <dt className="text-gray-500">Resolved</dt>
      <dd className="font-medium">{resolved}</dd>
      <dt className="text-gray-500">Outcome</dt>
      <dd className="font-medium">{outcome}</dd>
    </dl>
  );
}

function formatMedSummary(event) {
  const name = event.name || event.medication || 'Unknown Medication';
  const dose = event.dose || 'N/A';
  const date = event.date || event.authoredOn || 'Unknown';
  const status = event.status || 'N/A';

  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
      <dt className="text-gray-500">Medication</dt>
      <dd className="font-medium">{name}</dd>
      <dt className="text-gray-500">Dose</dt>
      <dd className="font-medium">{dose}</dd>
      <dt className="text-gray-500">Date</dt>
      <dd className="font-medium">{date}</dd>
      <dt className="text-gray-500">Status</dt>
      <dd className="font-medium">{status}</dd>
    </dl>
  );
}

function formatObsSummary(event) {
  const name = event.name || event.code || 'Unknown Observation';
  const value = event.value != null ? `${event.value} ${event.unit || ''}` : 'N/A';
  const date = event.date || event.effectiveDateTime || 'Unknown';
  const refRange = event.referenceRange || (event.referenceLow != null && event.referenceHigh != null
    ? `${event.referenceLow} - ${event.referenceHigh}`
    : 'N/A');

  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
      <dt className="text-gray-500">Test</dt>
      <dd className="font-medium">{name}</dd>
      <dt className="text-gray-500">Value</dt>
      <dd className="font-medium">{value}</dd>
      <dt className="text-gray-500">Date</dt>
      <dd className="font-medium">{date}</dd>
      <dt className="text-gray-500">Reference Range</dt>
      <dd className="font-medium">{refRange}</dd>
    </dl>
  );
}

function formatDispositionSummary(event) {
  const status = event.status || event.type || 'Unknown';
  const date = event.date || event.effectiveDateTime || 'Unknown';
  const reason = event.reason || 'N/A';

  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
      <dt className="text-gray-500">Status</dt>
      <dd className="font-medium">{status}</dd>
      <dt className="text-gray-500">Date</dt>
      <dd className="font-medium">{date}</dd>
      <dt className="text-gray-500">Reason</dt>
      <dd className="font-medium">{reason}</dd>
    </dl>
  );
}

export default function EventDetailModal({ event, type = 'ae', open, onClose }) {
  const [showJson, setShowJson] = useState(false);

  if (!open || !event) return null;

  const config = TYPE_CONFIG[type] || TYPE_CONFIG.ae;
  const Icon = config.icon;

  const summaryRenderers = {
    ae: formatAeSummary,
    medication: formatMedSummary,
    observation: formatObsSummary,
    vital: formatObsSummary,
    disposition: formatDispositionSummary,
  };

  const renderSummary = summaryRenderers[type] || summaryRenderers.ae;
  const rawData = event._raw || event;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div
          className="flex items-center gap-3 px-6 py-4 border-b rounded-t-xl"
          style={{ borderBottomColor: config.color + '33' }}
        >
          <span
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: config.color + '1A' }}
          >
            <Icon className="w-4 h-4" style={{ color: config.color }} />
          </span>
          <h2 className="text-lg font-semibold text-gray-800 flex-1">
            {config.label} Details
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {renderSummary(event)}

          {/* Toggle FHIR JSON */}
          <button
            onClick={() => setShowJson(!showJson)}
            className="flex items-center gap-2 text-xs text-blue-600 hover:text-blue-800 font-medium mt-2"
          >
            <Code className="w-3.5 h-3.5" />
            {showJson ? 'Hide' : 'Show'} FHIR JSON
          </button>

          {showJson && (
            <pre className="bg-gray-900 text-green-400 text-xs p-4 rounded-lg overflow-x-auto max-h-64">
              {JSON.stringify(rawData, null, 2)}
            </pre>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t bg-gray-50 rounded-b-xl flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
