import { X, Copy, Check } from 'lucide-react';
import { useState } from 'react';

export default function FhirJsonDrawer({ open, onClose, title = 'FHIR JSON', data }) {
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  const json = JSON.stringify(data, null, 2);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(json);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-white shadow-2xl flex flex-col animate-slide-in">
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50">
          <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="p-1.5 rounded-md hover:bg-gray-200 text-gray-500 transition-colors"
              title="Copy JSON"
            >
              {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md hover:bg-gray-200 text-gray-500 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <pre className="flex-1 overflow-auto p-6 text-xs font-mono text-gray-700 bg-gray-900 text-green-400 leading-relaxed">
          {json}
        </pre>
      </div>
    </div>
  );
}
