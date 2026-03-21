import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Download, FileText, FileSpreadsheet } from 'lucide-react';

const DOMAINS = [
  { name: 'patients', columns: 'subject_id, arm, site_id, age, sex, race, enrollment_date, status' },
  { name: 'adverse_events', columns: 'ae_id, subject_id, term, severity, serious, onset_date, resolved_date, outcome, relationship' },
  { name: 'observations', columns: 'obs_id, subject_id, visit, date, test_name, value, unit, reference_range' },
  { name: 'medications', columns: 'med_id, subject_id, drug_name, dose, unit, route, start_date, end_date, ongoing' },
  { name: 'disposition', columns: 'subject_id, status, date, reason, protocol_completed' },
];

function downloadCSVTemplates() {
  DOMAINS.forEach((d) => {
    const blob = new Blob([d.columns + '\n'], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${d.name}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  });
}

function downloadExcelInfo() {
  const text = DOMAINS.map(
    (d) => `Sheet: ${d.name}\nColumns: ${d.columns}\n`
  ).join('\n');
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'excel_template_info.txt';
  a.click();
  URL.revokeObjectURL(url);
}

export default function TemplateDownload() {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-gray-200 rounded-lg">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
      >
        <span className="font-medium text-gray-700">Download Templates</span>
        {open ? (
          <ChevronUp size={18} className="text-gray-400" />
        ) : (
          <ChevronDown size={18} className="text-gray-400" />
        )}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4">
          <p className="text-sm text-gray-500">
            Download template files with the expected column headers for each domain.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* CSV templates */}
            <div className="border border-gray-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <FileText size={20} className="text-blue-600" />
                <div>
                  <p className="font-medium text-gray-900 text-sm">CSV Bundle</p>
                  <p className="text-xs text-gray-500">
                    One .csv file per domain
                  </p>
                </div>
              </div>
              <button
                onClick={downloadCSVTemplates}
                className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-sm font-medium text-blue-600 border border-blue-200 hover:bg-blue-50 transition-colors"
              >
                <Download size={14} />
                Download CSVs
              </button>
            </div>

            {/* Excel info */}
            <div className="border border-gray-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet size={20} className="text-green-600" />
                <div>
                  <p className="font-medium text-gray-900 text-sm">Excel Workbook</p>
                  <p className="text-xs text-gray-500">
                    One sheet per domain
                  </p>
                </div>
              </div>
              <button
                onClick={downloadExcelInfo}
                className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-sm font-medium text-green-600 border border-green-200 hover:bg-green-50 transition-colors"
              >
                <Download size={14} />
                Download Template Info
              </button>
            </div>
          </div>

          {/* Domain reference */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              Expected domains
            </p>
            {DOMAINS.map((d) => (
              <div key={d.name} className="text-xs text-gray-600">
                <span className="font-medium capitalize">{d.name}:</span>{' '}
                <span className="text-gray-400">{d.columns}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
