import { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Download,
  FileText,
  FileSpreadsheet,
  Info,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';

// ── Authoritative schema: must match backend/app/models/schemas.py ──────

const DOMAINS = [
  {
    key: 'demographics',
    label: 'Demographics',
    filename: 'demographics.csv',
    sheetName: 'Demographics',
    description: 'One row per patient. This is the anchor table — all other domains reference SUBJID from here.',
    columns: [
      { name: 'SUBJID', type: 'string', required: true, pattern: 'SUBJ-###', example: 'SUBJ-001', note: 'Must match pattern SUBJ-NNN' },
      { name: 'SITEID', type: 'string', required: true, pattern: 'SITE-##', example: 'SITE-01', note: 'Must match pattern SITE-NN' },
      { name: 'ARM', type: 'enum', required: true, allowed: ['PEMBRO', 'CHEMO'], example: 'PEMBRO' },
      { name: 'AGE', type: 'integer', required: true, example: '62', note: '18–100' },
      { name: 'SEX', type: 'enum', required: true, allowed: ['M', 'F', 'U'], example: 'F' },
      { name: 'RACE', type: 'enum', required: true, allowed: ['WHITE', 'BLACK OR AFRICAN AMERICAN', 'ASIAN', 'AMERICAN INDIAN OR ALASKA NATIVE', 'NATIVE HAWAIIAN OR OTHER PACIFIC ISLANDER', 'OTHER', 'UNKNOWN'], example: 'WHITE' },
      { name: 'ETHNIC', type: 'enum', required: true, allowed: ['HISPANIC OR LATINO', 'NOT HISPANIC OR LATINO', 'UNKNOWN'], example: 'NOT HISPANIC OR LATINO' },
      { name: 'COUNTRY', type: 'string', required: true, example: 'US' },
      { name: 'RFSTDTC', type: 'date', required: true, example: '2024-01-15', note: 'Enrollment start (YYYY-MM-DD)' },
      { name: 'RFENDTC', type: 'date', required: false, example: '2024-07-15', note: 'Enrollment end' },
      { name: 'DTHFL', type: 'enum', required: false, allowed: ['Y'], example: 'Y', note: 'Death flag, Y or blank' },
    ],
  },
  {
    key: 'adverse_events',
    label: 'Adverse Events',
    filename: 'adverse_events.csv',
    sheetName: 'Adverse Events',
    description: 'One row per adverse event. Multiple AEs per patient allowed.',
    columns: [
      { name: 'SUBJID', type: 'string', required: true, example: 'SUBJ-001', note: 'Must exist in demographics' },
      { name: 'AETERM', type: 'string', required: true, example: 'Nausea', note: 'Reported term' },
      { name: 'AEDECOD', type: 'string', required: true, example: 'Nausea', note: 'Dictionary-coded term' },
      { name: 'AEBODSYS', type: 'string', required: true, example: 'Gastrointestinal disorders', note: 'System Organ Class' },
      { name: 'AESEV', type: 'enum', required: true, allowed: ['MILD', 'MODERATE', 'SEVERE'], example: 'MILD' },
      { name: 'AETOXGR', type: 'integer', required: true, example: '2', note: 'CTCAE grade 1–5' },
      { name: 'AESER', type: 'enum', required: true, allowed: ['Y', 'N'], example: 'N', note: 'Serious?' },
      { name: 'AEREL', type: 'enum', required: true, allowed: ['RELATED', 'NOT RELATED', 'POSSIBLY RELATED'], example: 'RELATED' },
      { name: 'AEACN', type: 'enum', required: true, allowed: ['DOSE NOT CHANGED', 'DOSE REDUCED', 'DRUG WITHDRAWN', 'DRUG INTERRUPTED', 'NOT APPLICABLE'], example: 'DOSE NOT CHANGED' },
      { name: 'AEOUT', type: 'enum', required: true, allowed: ['RECOVERED', 'RECOVERING', 'NOT RECOVERED', 'RECOVERED WITH SEQUELAE', 'FATAL'], example: 'RECOVERED' },
      { name: 'AESTDTC', type: 'date', required: true, example: '2024-02-10', note: 'Must be >= RFSTDTC' },
      { name: 'AEENDTC', type: 'date', required: false, example: '2024-02-20' },
    ],
  },
  {
    key: 'vital_signs',
    label: 'Vital Signs',
    filename: 'vital_signs.csv',
    sheetName: 'Vital Signs',
    description: 'One row per vital sign measurement per visit.',
    columns: [
      { name: 'SUBJID', type: 'string', required: true, example: 'SUBJ-001' },
      { name: 'VSTESTCD', type: 'enum', required: true, allowed: ['SYSBP', 'DIABP', 'HR', 'TEMP', 'WEIGHT', 'HEIGHT'], example: 'SYSBP' },
      { name: 'VSTEST', type: 'string', required: true, example: 'Systolic Blood Pressure', note: 'Full test name' },
      { name: 'VSORRES', type: 'float', required: true, example: '125.0', note: 'Measured value' },
      { name: 'VSORRESU', type: 'string', required: true, example: 'mmHg', note: 'Unit (mmHg, beats/min, C, kg, cm)' },
      { name: 'VSDTC', type: 'date', required: true, example: '2024-01-15' },
      { name: 'VISITNUM', type: 'integer', required: true, example: '1', note: '>= 1' },
      { name: 'VSBLFL', type: 'enum', required: false, allowed: ['Y'], example: 'Y', note: 'Baseline flag' },
    ],
  },
  {
    key: 'lab_results',
    label: 'Lab Results',
    filename: 'lab_results.csv',
    sheetName: 'Labs',
    description: 'One row per lab test result per visit.',
    columns: [
      { name: 'SUBJID', type: 'string', required: true, example: 'SUBJ-001' },
      { name: 'LBTESTCD', type: 'string', required: true, example: 'ALT', note: 'Test code (ALT, AST, BILI, CREAT, WBC, HGB, PLT, etc.)' },
      { name: 'LBTEST', type: 'string', required: true, example: 'Alanine Aminotransferase', note: 'Full test name' },
      { name: 'LBORRES', type: 'float', required: true, example: '35.0' },
      { name: 'LBORRESU', type: 'string', required: true, example: 'U/L' },
      { name: 'LBSTNRLO', type: 'float', required: false, example: '7.0', note: 'Reference range low' },
      { name: 'LBSTNRHI', type: 'float', required: false, example: '56.0', note: 'Reference range high' },
      { name: 'LBDTC', type: 'date', required: true, example: '2024-01-15' },
      { name: 'VISITNUM', type: 'integer', required: true, example: '1', note: '>= 1' },
      { name: 'LBBLFL', type: 'enum', required: false, allowed: ['Y'], example: 'Y', note: 'Baseline flag' },
      { name: 'LBLOINC', type: 'string', required: false, example: '1742-6', note: 'LOINC code (optional)' },
    ],
  },
  {
    key: 'medications',
    label: 'Medications',
    filename: 'medications.csv',
    sheetName: 'Medications',
    description: 'One row per drug administration. Covers both study drug and concomitant medications.',
    columns: [
      { name: 'SUBJID', type: 'string', required: true, example: 'SUBJ-001' },
      { name: 'CMTRT', type: 'string', required: true, example: 'Pembrolizumab', note: 'Drug name' },
      { name: 'CMDOSE', type: 'float', required: true, example: '200.0' },
      { name: 'CMDOSU', type: 'string', required: true, example: 'mg', note: 'Dose unit' },
      { name: 'CMROUTE', type: 'string', required: true, example: 'INTRAVENOUS', note: 'Route of administration' },
      { name: 'CMSTDTC', type: 'date', required: true, example: '2024-01-20' },
      { name: 'CMENDTC', type: 'date', required: false, example: '2024-01-20' },
      { name: 'CMCAT', type: 'enum', required: true, allowed: ['STUDY DRUG', 'CONCOMITANT'], example: 'STUDY DRUG' },
      { name: 'VISITNUM', type: 'integer', required: true, example: '1', note: '>= 1' },
    ],
  },
  {
    key: 'disposition',
    label: 'Disposition',
    filename: 'disposition.csv',
    sheetName: 'Disposition',
    description: 'Tracks study milestones: enrollment, randomization, completion, or discontinuation.',
    columns: [
      { name: 'SUBJID', type: 'string', required: true, example: 'SUBJ-001' },
      { name: 'DSSCAT', type: 'enum', required: true, allowed: ['ENROLLED', 'RANDOMIZED', 'COMPLETED', 'DISCONTINUED'], example: 'ENROLLED' },
      { name: 'DSDECOD', type: 'enum', required: true, allowed: ['COMPLETED', 'ADVERSE EVENT', 'PROGRESSIVE DISEASE', 'DEATH', 'WITHDRAWAL BY SUBJECT', 'PHYSICIAN DECISION'], example: 'COMPLETED' },
      { name: 'DSSTDTC', type: 'date', required: true, example: '2024-01-15' },
    ],
  },
];

// ── Helpers ──────────────────────────────────────────────────────────────

function buildCSVHeader(domain) {
  return domain.columns.map((c) => c.name).join(',');
}

function buildCSVExample(domain) {
  return domain.columns.map((c) => c.example).join(',');
}

function downloadSingleCSV(domain) {
  const header = buildCSVHeader(domain);
  const example = buildCSVExample(domain);
  const blob = new Blob([header + '\n' + example + '\n'], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = domain.filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadAllCSVs() {
  DOMAINS.forEach((d) => downloadSingleCSV(d));
}

// ── Type badge component ────────────────────────────────────────────────

const TYPE_COLORS = {
  string: 'bg-blue-100 text-blue-700',
  integer: 'bg-purple-100 text-purple-700',
  float: 'bg-purple-100 text-purple-700',
  date: 'bg-amber-100 text-amber-700',
  enum: 'bg-teal-100 text-teal-700',
};

function TypeBadge({ type }) {
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${TYPE_COLORS[type] || 'bg-gray-100 text-gray-600'}`}>
      {type}
    </span>
  );
}

// ── Domain schema card ──────────────────────────────────────────────────

function DomainSchemaCard({ domain }) {
  const [expanded, setExpanded] = useState(false);
  const requiredCount = domain.columns.filter((c) => c.required).length;

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <FileText size={16} className="text-blue-500 shrink-0" />
          <div>
            <span className="font-medium text-gray-900 text-sm">{domain.label}</span>
            <span className="text-gray-400 text-xs ml-2">{domain.filename}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">
            {domain.columns.length} cols ({requiredCount} required)
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              downloadSingleCSV(domain);
            }}
            className="p-1 hover:bg-blue-50 rounded text-blue-500"
            title={`Download ${domain.filename}`}
          >
            <Download size={14} />
          </button>
          {expanded ? (
            <ChevronUp size={16} className="text-gray-400" />
          ) : (
            <ChevronDown size={16} className="text-gray-400" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-100">
          <p className="px-4 py-2 text-xs text-gray-500 bg-gray-50">{domain.description}</p>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-left border-t border-gray-100">
                  <th className="px-4 py-2 font-medium">Column</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Req</th>
                  <th className="px-3 py-2 font-medium">Example</th>
                  <th className="px-3 py-2 font-medium">Allowed / Notes</th>
                </tr>
              </thead>
              <tbody>
                {domain.columns.map((col) => (
                  <tr key={col.name} className="border-t border-gray-50 hover:bg-gray-50/50">
                    <td className="px-4 py-1.5 font-mono font-medium text-gray-800">{col.name}</td>
                    <td className="px-3 py-1.5"><TypeBadge type={col.type} /></td>
                    <td className="px-3 py-1.5">
                      {col.required ? (
                        <CheckCircle size={13} className="text-green-500" />
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 font-mono text-gray-600">{col.example}</td>
                    <td className="px-3 py-1.5 text-gray-500 max-w-[280px]">
                      {col.allowed ? (
                        <span className="flex flex-wrap gap-1">
                          {col.allowed.map((v) => (
                            <code key={v} className="bg-gray-100 px-1 py-0.5 rounded text-[10px]">{v}</code>
                          ))}
                        </span>
                      ) : (
                        col.note || ''
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────

export default function TemplateDownload() {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-gray-200 rounded-lg bg-white">
      {/* Header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Info size={20} className="text-blue-500" />
          <div>
            <span className="font-semibold text-gray-800">Upload Schema Reference & Templates</span>
            <p className="text-xs text-gray-500 mt-0.5">
              Column definitions, allowed values, and downloadable CSV templates for all 6 domains
            </p>
          </div>
        </div>
        {open ? (
          <ChevronUp size={18} className="text-gray-400" />
        ) : (
          <ChevronDown size={18} className="text-gray-400" />
        )}
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-4 border-t border-gray-100 pt-4">
          {/* Quick-start guide */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
            <p className="text-sm font-medium text-blue-800">How to upload</p>
            <ul className="text-xs text-blue-700 space-y-1 list-disc pl-4">
              <li><strong>CSV:</strong> Upload 1–6 CSV files. File names must contain a domain keyword (e.g. <code className="bg-blue-100 px-1 rounded">demographics.csv</code>, <code className="bg-blue-100 px-1 rounded">adverse_events.csv</code>).</li>
              <li><strong>Excel:</strong> Upload a single <code className="bg-blue-100 px-1 rounded">.xlsx</code> with sheets named: Demographics, Adverse Events, Vital Signs, Labs, Medications, Disposition.</li>
              <li><strong>FHIR JSON:</strong> Upload a pre-built FHIR Transaction Bundle <code className="bg-blue-100 px-1 rounded">.json</code> file — loaded directly to HAPI FHIR.</li>
            </ul>
            <p className="text-xs text-blue-600 mt-1">
              <strong>Demographics is required.</strong> All other domains are optional but recommended for a complete dashboard.
            </p>
          </div>

          {/* Validation info */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3">
            <AlertCircle size={16} className="text-amber-500 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-800 space-y-1">
              <p className="font-medium">5-stage validation pipeline</p>
              <p>All dates must be <strong>YYYY-MM-DD</strong> format. Every SUBJID in other domains must exist in demographics. AE start dates must be on or after enrollment (RFSTDTC). Values outside physiological ranges generate warnings but won't block upload.</p>
            </div>
          </div>

          {/* Download all button */}
          <div className="flex gap-3">
            <button
              onClick={downloadAllCSVs}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors"
            >
              <Download size={14} />
              Download All CSV Templates
            </button>
          </div>

          {/* Per-domain schema cards */}
          <div className="space-y-2">
            {DOMAINS.map((d) => (
              <DomainSchemaCard key={d.key} domain={d} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
