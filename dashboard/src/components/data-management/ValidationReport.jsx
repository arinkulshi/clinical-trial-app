import React, { useState } from 'react';
import { CheckCircle, AlertTriangle, XCircle, Loader2 } from 'lucide-react';
import DomainReportCard from './DomainReportCard';

const OVERALL_STATUS = {
  VALID: {
    icon: CheckCircle,
    bg: 'bg-green-50 border-green-200',
    text: 'text-green-800',
    label: 'All domains passed validation',
  },
  VALID_WITH_WARNINGS: {
    icon: AlertTriangle,
    bg: 'bg-yellow-50 border-yellow-200',
    text: 'text-yellow-800',
    label: 'Validation passed with warnings',
  },
  INVALID: {
    icon: XCircle,
    bg: 'bg-red-50 border-red-200',
    text: 'text-red-800',
    label: 'Validation failed — errors must be fixed',
  },
  LOADED: {
    icon: CheckCircle,
    bg: 'bg-green-50 border-green-200',
    text: 'text-green-800',
    label: 'Data loaded into FHIR server successfully',
  },
  ERROR: {
    icon: XCircle,
    bg: 'bg-red-50 border-red-200',
    text: 'text-red-800',
    label: 'Failed to load into FHIR server',
  },
};

export default function ValidationReport({ report, onLoad, loadingLoad }) {
  const [studyName, setStudyName] = useState('');

  if (!report) return null;

  const status = report.overall_status || 'VALID';
  const config = OVERALL_STATUS[status] || OVERALL_STATUS.VALID;
  const Icon = config.icon;
  const isLoadable = status === 'VALID' || status === 'VALID_WITH_WARNINGS' || status === 'ERROR';
  const isLoaded = status === 'LOADED';
  const isInvalid = status === 'INVALID';
  const domains = report.domains || {};

  return (
    <div className="space-y-4">
      {/* Summary banner */}
      <div className={`flex items-center gap-3 p-4 rounded-lg border ${config.bg}`}>
        <Icon size={24} className={config.text} />
        <div>
          <p className={`font-semibold ${config.text}`}>{config.label}</p>
          <p className="text-sm text-gray-600 mt-0.5">
            {Object.keys(domains).length} domain{Object.keys(domains).length !== 1 ? 's' : ''} checked
            {report.total_rows != null && ` \u00b7 ${report.total_rows.toLocaleString()} total rows`}
          </p>
        </div>
      </div>

      {/* Domain cards */}
      <div className="space-y-2">
        {Object.entries(domains).map(([name, domainReport]) => (
          <DomainReportCard key={name} domain={name} report={domainReport} />
        ))}
      </div>

      {/* Actions */}
      {isLoaded ? (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
          <p className="text-green-700 font-medium">Data successfully loaded into the FHIR server.</p>
        </div>
      ) : isLoadable ? (
        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
          {status === 'ERROR' && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-2">
              <p className="text-red-700 text-sm">
                Load failed. Make sure HAPI FHIR is running at the configured URL, then try again.
              </p>
            </div>
          )}
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Study Name</span>
            <input
              type="text"
              value={studyName}
              onChange={(e) => setStudyName(e.target.value)}
              placeholder="e.g. ONCO-2024-PD1-301"
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </label>
          <button
            onClick={() => onLoad(report.dataset_id, studyName)}
            disabled={!studyName.trim() || loadingLoad}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loadingLoad ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Loading into FHIR Server...
              </>
            ) : (
              status === 'ERROR' ? 'Retry Load into FHIR Server' : 'Load into FHIR Server'
            )}
          </button>
        </div>
      ) : isInvalid ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
          <p className="text-red-700 font-medium">Please fix the errors above and re-upload.</p>
        </div>
      ) : null}
    </div>
  );
}
