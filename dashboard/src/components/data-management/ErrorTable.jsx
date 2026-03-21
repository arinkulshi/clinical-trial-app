import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

const SEVERITY_STYLES = {
  ERROR: 'bg-red-50 text-red-800',
  WARNING: 'bg-yellow-50 text-yellow-800',
};

const SEVERITY_BADGE = {
  ERROR: 'bg-red-100 text-red-700',
  WARNING: 'bg-yellow-100 text-yellow-700',
};

export default function ErrorTable({ errors = [], maxVisible = 3 }) {
  const [expanded, setExpanded] = useState(false);

  if (errors.length === 0) return null;

  const visible = expanded ? errors : errors.slice(0, maxVisible);
  const remaining = errors.length - maxVisible;

  return (
    <div className="mt-2">
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-gray-600 text-left">
              <th className="px-3 py-2 font-medium">Row</th>
              <th className="px-3 py-2 font-medium">Column</th>
              <th className="px-3 py-2 font-medium">Value</th>
              <th className="px-3 py-2 font-medium">Message</th>
              <th className="px-3 py-2 font-medium">Severity</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((err, i) => (
              <tr
                key={i}
                className={`border-t border-gray-100 ${SEVERITY_STYLES[err.severity] || ''}`}
              >
                <td className="px-3 py-2 font-mono">{err.row ?? '-'}</td>
                <td className="px-3 py-2">{err.column ?? '-'}</td>
                <td className="px-3 py-2 font-mono max-w-[150px] truncate">
                  {err.value ?? '-'}
                </td>
                <td className="px-3 py-2">{err.message}</td>
                <td className="px-3 py-2">
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                      SEVERITY_BADGE[err.severity] || 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {err.severity}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {remaining > 0 && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
        >
          {expanded ? (
            <>
              <ChevronUp size={14} /> Show less
            </>
          ) : (
            <>
              <ChevronDown size={14} /> Show {remaining} more...
            </>
          )}
        </button>
      )}
    </div>
  );
}
