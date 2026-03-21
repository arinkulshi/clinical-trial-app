import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, User } from 'lucide-react';
import { ARM_COLORS } from '../../utils/fhirHelpers';

export default function PatientSelector({ patients = [], selectedId, onSelect }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = patients.filter((p) => {
    const q = query.toLowerCase();
    return (
      (p.name || '').toLowerCase().includes(q) ||
      (p.identifier || '').toLowerCase().includes(q) ||
      (p.id || '').toLowerCase().includes(q) ||
      (p.arm || '').toLowerCase().includes(q)
    );
  });

  const selected = patients.find((p) => p.id === selectedId);

  return (
    <div ref={wrapperRef} className="relative w-full max-w-md">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Select Patient
      </label>
      <div
        className="flex items-center border border-gray-300 rounded-lg bg-white px-3 py-2 cursor-pointer shadow-sm hover:border-blue-400 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <Search className="w-4 h-4 text-gray-400 mr-2 flex-shrink-0" />
        {open ? (
          <input
            autoFocus
            className="flex-1 outline-none text-sm bg-transparent"
            placeholder="Search by name, ID, or arm..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="flex-1 text-sm truncate">
            {selected
              ? `${selected.name} (${selected.identifier || selected.id})`
              : 'Search and select a patient...'}
          </span>
        )}
        <ChevronDown
          className={`w-4 h-4 text-gray-400 ml-2 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </div>

      {open && (
        <ul className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {filtered.length === 0 ? (
            <li className="px-4 py-3 text-sm text-gray-500">No patients found</li>
          ) : (
            filtered.map((p) => (
              <li
                key={p.id}
                className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer text-sm hover:bg-blue-50 transition-colors ${
                  p.id === selectedId ? 'bg-blue-50 font-medium' : ''
                }`}
                onClick={() => {
                  onSelect(p.id);
                  setOpen(false);
                  setQuery('');
                }}
              >
                <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className="flex-1 truncate">
                  {p.name}{' '}
                  <span className="text-gray-400">
                    ({p.identifier || p.id})
                  </span>
                </span>
                {p.arm && (
                  <span
                    className="text-xs font-medium px-2 py-0.5 rounded-full text-white flex-shrink-0"
                    style={{
                      backgroundColor: ARM_COLORS[p.arm] || '#6B7280',
                    }}
                  >
                    {p.arm}
                  </span>
                )}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
