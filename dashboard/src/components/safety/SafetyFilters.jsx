import React from 'react';
import { Filter, ChevronDown } from 'lucide-react';

const ARMS = ['All', 'PEMBRO', 'CHEMO'];
const GRADES = ['All', 'Grade 1-2', 'Grade 3+'];

export default function SafetyFilters({ filters, onFilterChange, socOptions = [] }) {
  const handleChange = (key, value) => {
    onFilterChange({ ...filters, [key]: value });
  };

  return (
    <div className="sticky top-0 z-20 bg-white border-b border-gray-200 shadow-sm px-6 py-3 flex flex-wrap items-center gap-6">
      <div className="flex items-center gap-2 text-gray-500">
        <Filter size={16} />
        <span className="text-sm font-medium">Filters</span>
      </div>

      {/* Arm filter */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500 uppercase tracking-wide">Arm</span>
        <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden">
          {ARMS.map((arm) => (
            <button
              key={arm}
              onClick={() => handleChange('arm', arm)}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                filters.arm === arm
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {arm}
            </button>
          ))}
        </div>
      </div>

      {/* Grade filter */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500 uppercase tracking-wide">Grade</span>
        <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden">
          {GRADES.map((grade) => (
            <button
              key={grade}
              onClick={() => handleChange('grade', grade)}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                filters.grade === grade
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {grade}
            </button>
          ))}
        </div>
      </div>

      {/* SOC dropdown */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500 uppercase tracking-wide">SOC</span>
        <div className="relative">
          <select
            value={filters.soc}
            onChange={(e) => handleChange('soc', e.target.value)}
            className="appearance-none bg-white border border-gray-200 rounded-lg px-3 py-1.5 pr-8 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="All">All System Organ Classes</option>
            {socOptions.map((soc) => (
              <option key={soc} value={soc}>
                {soc}
              </option>
            ))}
          </select>
          <ChevronDown
            size={14}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          />
        </div>
      </div>
    </div>
  );
}
