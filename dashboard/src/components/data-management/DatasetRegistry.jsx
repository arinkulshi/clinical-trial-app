import React from 'react';
import { Eye, Upload, Trash2, Loader2 } from 'lucide-react';

const STATUS_BADGE = {
  VALIDATING: { label: 'Validating', classes: 'bg-blue-50 text-blue-700', spinner: true },
  VALID: { label: 'Valid', classes: 'bg-green-50 text-green-700' },
  VALID_WITH_WARNINGS: { label: 'Warnings', classes: 'bg-yellow-50 text-yellow-700' },
  INVALID: { label: 'Invalid', classes: 'bg-red-50 text-red-700' },
  LOADING: { label: 'Loading', classes: 'bg-blue-50 text-blue-700', spinner: true },
  LOADED: { label: 'Loaded', classes: 'bg-blue-100 text-blue-800' },
  ERROR: { label: 'Error', classes: 'bg-red-50 text-red-700' },
};

function StatusBadge({ status }) {
  const cfg = STATUS_BADGE[status] || STATUS_BADGE.ERROR;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.classes}`}
    >
      {cfg.spinner && <Loader2 size={12} className="animate-spin" />}
      {cfg.label}
    </span>
  );
}

export default function DatasetRegistry({ datasets = [], onView, onLoad, onDelete }) {
  if (datasets.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <Upload size={40} className="mx-auto mb-3" />
        <p className="font-medium text-gray-500">No datasets uploaded yet</p>
        <p className="text-sm mt-1">Upload and validate data to see it here.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="bg-gray-50 text-gray-600 text-left">
            <th className="px-4 py-3 font-medium">Study Name</th>
            <th className="px-4 py-3 font-medium">Upload Date</th>
            <th className="px-4 py-3 font-medium">Format</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium text-right">Patients</th>
            <th className="px-4 py-3 font-medium text-right">AEs</th>
            <th className="px-4 py-3 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {datasets.map((ds) => {
            const canLoad =
              ds.status === 'VALID' || ds.status === 'VALID_WITH_WARNINGS';
            const canDelete =
              ds.status !== 'VALIDATING' && ds.status !== 'LOADING';
            return (
              <tr
                key={ds.id}
                className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer"
                onClick={() => onView(ds)}
              >
                <td className="px-4 py-3 font-medium text-gray-900">
                  {ds.study_name || ds.name || '-'}
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {ds.upload_date
                    ? new Date(ds.upload_date).toLocaleDateString()
                    : '-'}
                </td>
                <td className="px-4 py-3 text-gray-500 uppercase text-xs font-medium">
                  {ds.format || '-'}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={ds.status} />
                </td>
                <td className="px-4 py-3 text-right font-mono text-gray-700">
                  {ds.patient_count?.toLocaleString() ?? '-'}
                </td>
                <td className="px-4 py-3 text-right font-mono text-gray-700">
                  {ds.ae_count?.toLocaleString() ?? '-'}
                </td>
                <td className="px-4 py-3 text-right">
                  <div
                    className="flex items-center justify-end gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => onView(ds)}
                      className="p-1.5 text-gray-400 hover:text-blue-600 rounded-md hover:bg-blue-50"
                      title="View details"
                    >
                      <Eye size={16} />
                    </button>
                    {canLoad && (
                      <button
                        onClick={() => onLoad(ds)}
                        className="p-1.5 text-gray-400 hover:text-green-600 rounded-md hover:bg-green-50"
                        title="Load to FHIR"
                      >
                        <Upload size={16} />
                      </button>
                    )}
                    {canDelete && (
                      <button
                        onClick={() => onDelete(ds)}
                        className="p-1.5 text-gray-400 hover:text-red-600 rounded-md hover:bg-red-50"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
