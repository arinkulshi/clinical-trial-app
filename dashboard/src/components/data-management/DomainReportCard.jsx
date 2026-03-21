import React, { useState } from 'react';
import { CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import ErrorTable from './ErrorTable';

const STATUS_CONFIG = {
  VALID: {
    icon: CheckCircle,
    color: 'text-green-600',
    bg: 'bg-green-50',
    badge: 'bg-green-100 text-green-700',
    label: 'Valid',
  },
  VALID_WITH_WARNINGS: {
    icon: AlertTriangle,
    color: 'text-yellow-600',
    bg: 'bg-yellow-50',
    badge: 'bg-yellow-100 text-yellow-700',
    label: 'Warnings',
  },
  INVALID: {
    icon: XCircle,
    color: 'text-red-600',
    bg: 'bg-red-50',
    badge: 'bg-red-100 text-red-700',
    label: 'Invalid',
  },
};

export default function DomainReportCard({ domain, report }) {
  const [expanded, setExpanded] = useState(false);

  const config = STATUS_CONFIG[report.status] || STATUS_CONFIG.VALID;
  const Icon = config.icon;
  const allIssues = [
    ...(report.errors || []).map((e) => ({ ...e, severity: 'ERROR' })),
    ...(report.warnings || []).map((w) => ({ ...w, severity: 'WARNING' })),
  ];
  const hasIssues = allIssues.length > 0;

  return (
    <div className={`rounded-lg border border-gray-200 ${config.bg}`}>
      <button
        onClick={() => hasIssues && setExpanded((v) => !v)}
        className={`w-full flex items-center justify-between px-4 py-3 text-left ${
          hasIssues ? 'cursor-pointer' : 'cursor-default'
        }`}
      >
        <div className="flex items-center gap-3">
          <Icon size={20} className={config.color} />
          <div>
            <span className="font-medium text-gray-900 capitalize">{domain}</span>
            <span className="text-gray-500 text-sm ml-3">
              {report.row_count?.toLocaleString() ?? 0} rows
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {(report.errors?.length > 0) && (
            <span className="text-xs text-red-600 font-medium">
              {report.errors.length} error{report.errors.length !== 1 ? 's' : ''}
            </span>
          )}
          {(report.warnings?.length > 0) && (
            <span className="text-xs text-yellow-600 font-medium">
              {report.warnings.length} warning{report.warnings.length !== 1 ? 's' : ''}
            </span>
          )}
          <span
            className={`px-2 py-0.5 rounded text-xs font-medium ${config.badge}`}
          >
            {config.label}
          </span>
        </div>
      </button>

      {expanded && hasIssues && (
        <div className="px-4 pb-4">
          <ErrorTable errors={allIssues} maxVisible={3} />
        </div>
      )}
    </div>
  );
}
