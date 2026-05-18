import { ClipboardCheck } from 'lucide-react';

export default function EvidenceCard({ evidence }) {
  const items = evidence?.items || [];
  if (!items.length) return null;

  return (
    <div className="w-full rounded-lg border border-emerald-100 bg-emerald-50 p-3 shadow-sm">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-emerald-800">
        <ClipboardCheck className="h-3.5 w-3.5" />
        {evidence.title || 'Evidence'}
      </div>
      <div className="space-y-2">
        {items.map((item, index) => (
          <div key={`${item.label}-${index}`} className="rounded-md border border-emerald-100 bg-white px-2.5 py-2">
            <div className="text-[11px] font-medium uppercase text-gray-500">{item.label}</div>
            <div className="mt-0.5 text-xs font-semibold text-gray-800">{item.value}</div>
            {item.detail && <div className="mt-0.5 text-[11px] text-gray-500">{item.detail}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
