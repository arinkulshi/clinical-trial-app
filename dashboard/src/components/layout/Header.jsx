import { useStudy } from '../../hooks/useStudy';
import { ChevronDown, RefreshCw } from 'lucide-react';

export default function Header() {
  const { studies, selectedStudy, setSelectedStudyId, loading } = useStudy();

  return (
    <header className="h-14 border-b border-gray-200 bg-white flex items-center justify-between px-6 shrink-0">
      <div className="flex items-center gap-3">
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Study</label>
        <div className="relative">
          <select
            value={selectedStudy?.id || ''}
            onChange={(e) => setSelectedStudyId(e.target.value)}
            disabled={loading || !studies.length}
            className="appearance-none bg-gray-50 border border-gray-200 rounded-lg pl-3 pr-8 py-1.5 text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {!studies.length && <option value="">No studies loaded</option>}
            {studies.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title || s.identifier?.[0]?.value || s.id}
              </option>
            ))}
          </select>
          <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs text-gray-500">
        {selectedStudy && (
          <>
            <span>Phase: <strong className="text-gray-700">{selectedStudy.phase?.coding?.[0]?.code || 'III'}</strong></span>
            <span>Status: <strong className="text-gray-700">{selectedStudy.status || 'active'}</strong></span>
          </>
        )}
      </div>
    </header>
  );
}
