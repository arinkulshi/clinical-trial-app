import React from 'react';
import { X, ExternalLink, CheckCircle, AlertTriangle, XCircle, Loader2 } from 'lucide-react';

const STATUS_CONFIG = {
  VALIDATING: { icon: Loader2, color: 'text-blue-600', label: 'Validating', spin: true },
  VALID: { icon: CheckCircle, color: 'text-green-600', label: 'Valid' },
  VALID_WITH_WARNINGS: { icon: AlertTriangle, color: 'text-yellow-600', label: 'Warnings' },
  INVALID: { icon: XCircle, color: 'text-red-600', label: 'Invalid' },
  LOADING: { icon: Loader2, color: 'text-blue-600', label: 'Loading to FHIR', spin: true },
  LOADED: { icon: CheckCircle, color: 'text-blue-600', label: 'Loaded' },
  ERROR: { icon: XCircle, color: 'text-red-600', label: 'Error' },
};

export default function DatasetDetailDrawer({ dataset, open, onClose }) {
  if (!open || !dataset) return null;

  const cfg = STATUS_CONFIG[dataset.status] || STATUS_CONFIG.ERROR;
  const Icon = cfg.icon;
  const domains = dataset.validation_report?.domains || dataset.domains || {};

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-xl z-50 flex flex-col animate-slide-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Dataset Details</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Metadata */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">
              Metadata
            </h3>
            <dl className="space-y-2">
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">Study Name</dt>
                <dd className="text-sm font-medium text-gray-900">
                  {dataset.study_name || dataset.name || '-'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">Upload Date</dt>
                <dd className="text-sm text-gray-900">
                  {dataset.upload_date
                    ? new Date(dataset.upload_date).toLocaleString()
                    : '-'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">Format</dt>
                <dd className="text-sm text-gray-900 uppercase">{dataset.format || '-'}</dd>
              </div>
              <div className="flex justify-between items-center">
                <dt className="text-sm text-gray-500">Status</dt>
                <dd className="flex items-center gap-1.5">
                  <Icon
                    size={16}
                    className={`${cfg.color} ${cfg.spin ? 'animate-spin' : ''}`}
                  />
                  <span className={`text-sm font-medium ${cfg.color}`}>{cfg.label}</span>
                </dd>
              </div>
            </dl>
          </div>

          {/* Validation summary */}
          {dataset.validation_report && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">
                Validation Summary
              </h3>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-sm text-gray-700">
                  Overall:{' '}
                  <span className="font-medium">
                    {dataset.validation_report.overall_status}
                  </span>
                </p>
                {dataset.validation_report.total_rows != null && (
                  <p className="text-sm text-gray-500 mt-1">
                    {dataset.validation_report.total_rows.toLocaleString()} total rows
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Domain row counts */}
          {Object.keys(domains).length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">
                Row Counts per Domain
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(domains).map(([name, info]) => (
                  <div
                    key={name}
                    className="bg-gray-50 rounded-lg p-3 flex flex-col"
                  >
                    <span className="text-xs text-gray-500 capitalize">{name}</span>
                    <span className="text-lg font-semibold text-gray-900">
                      {(info.row_count ?? 0).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Dashboard link for loaded datasets */}
          {dataset.status === 'LOADED' && (
            <div className="pt-2">
              <a
                href="/"
                className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-lg font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors"
              >
                <ExternalLink size={16} />
                View in Dashboard
              </a>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
