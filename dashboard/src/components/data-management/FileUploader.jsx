import React, { useState, useRef, useCallback } from 'react';
import { Upload, X, FileText, FileSpreadsheet, FileJson } from 'lucide-react';

const FORMAT_TABS = [
  { key: 'csv', label: 'CSV Files', icon: FileText, accept: '.csv', multiple: true },
  { key: 'excel', label: 'Excel Workbook', icon: FileSpreadsheet, accept: '.xlsx', multiple: false },
  { key: 'fhir_json', label: 'FHIR Bundle JSON', icon: FileJson, accept: '.json', multiple: false },
];

export default function FileUploader({ onValidate, loading }) {
  const [format, setFormat] = useState('csv');
  const [files, setFiles] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState(0);
  const inputRef = useRef(null);

  const activeTab = FORMAT_TABS.find((t) => t.key === format);

  const addFiles = useCallback(
    (incoming) => {
      const accepted = Array.from(incoming).filter((f) => {
        const ext = '.' + f.name.split('.').pop().toLowerCase();
        return activeTab.accept.split(',').includes(ext);
      });
      if (accepted.length === 0) return;
      if (activeTab.multiple) {
        setFiles((prev) => {
          const names = new Set(prev.map((f) => f.name));
          return [...prev, ...accepted.filter((f) => !names.has(f.name))];
        });
      } else {
        setFiles([accepted[0]]);
      }
    },
    [activeTab]
  );

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      setDragOver(false);
      addFiles(e.dataTransfer.files);
    },
    [addFiles]
  );

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragOver(false);
  };

  const removeFile = (name) => {
    setFiles((prev) => prev.filter((f) => f.name !== name));
  };

  const handleValidate = () => {
    if (files.length === 0) return;
    onValidate(files, format);
  };

  return (
    <div className="space-y-4">
      {/* Format selector tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
        {FORMAT_TABS.map((tab) => {
          const Icon = tab.icon;
          const active = format === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => {
                setFormat(tab.key);
                setFiles([]);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors flex-1 justify-center ${
                active
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
          dragOver
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 bg-gray-50 hover:border-gray-400'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={activeTab.accept}
          multiple={activeTab.multiple}
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <Upload
          size={40}
          className={`mx-auto mb-3 ${dragOver ? 'text-blue-500' : 'text-gray-400'}`}
        />
        <p className="text-gray-600 font-medium">
          Drag & drop {activeTab.multiple ? 'files' : 'a file'} here, or click to browse
        </p>
        <p className="text-gray-400 text-sm mt-1">
          Accepted: {activeTab.accept} {activeTab.multiple ? '(multiple)' : '(single file)'}
        </p>
      </div>

      {/* File badges */}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {files.map((f) => (
            <span
              key={f.name}
              className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full text-sm"
            >
              <FileText size={14} />
              {f.name}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeFile(f.name);
                }}
                className="ml-1 hover:text-red-500"
              >
                <X size={14} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Progress bar */}
      {loading && (
        <div className="space-y-1">
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div
              className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-sm text-gray-500 text-center">Validating... {progress}%</p>
        </div>
      )}

      {/* Validate button */}
      <button
        onClick={handleValidate}
        disabled={files.length === 0 || loading}
        className="w-full py-3 px-4 rounded-lg font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? 'Validating...' : 'Validate'}
      </button>
    </div>
  );
}
