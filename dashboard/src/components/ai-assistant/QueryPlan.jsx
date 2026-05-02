import { ChevronDown, Database } from 'lucide-react';
import { useState } from 'react';

export default function QueryPlan({ queries }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="w-full rounded-lg border border-blue-100 bg-blue-50">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-xs font-medium text-blue-800"
      >
        <span className="flex items-center gap-2">
          <Database className="w-3.5 h-3.5" />
          Query plan
        </span>
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-2">
          {queries.map((query, index) => (
            <div key={`${query.tool}-${index}`} className="rounded-md bg-white border border-blue-100 p-2">
              <div className="font-mono text-[11px] text-blue-700">{query.tool}</div>
              <div className="mt-1 text-xs text-gray-700">{query.description}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
