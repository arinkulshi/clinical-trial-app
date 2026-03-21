import React, { useState, useEffect, useCallback } from 'react';
import { Database, Upload, List } from 'lucide-react';
import { fhirApi } from '../api/fhir';
import Card from '../components/common/Card';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorMessage from '../components/common/ErrorMessage';
import TemplateDownload from '../components/data-management/TemplateDownload';
import FileUploader from '../components/data-management/FileUploader';
import ValidationReport from '../components/data-management/ValidationReport';
import DatasetRegistry from '../components/data-management/DatasetRegistry';
import DatasetDetailDrawer from '../components/data-management/DatasetDetailDrawer';

const TABS = [
  { key: 'upload', label: 'Upload & Validate', icon: Upload },
  { key: 'registry', label: 'Dataset Registry', icon: List },
];

export default function DataManagement() {
  const [activeTab, setActiveTab] = useState('upload');

  // Upload tab state
  const [validationReport, setValidationReport] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [loadingLoad, setLoadingLoad] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  // Registry tab state
  const [datasets, setDatasets] = useState([]);
  const [datasetsLoading, setDatasetsLoading] = useState(false);
  const [datasetsError, setDatasetsError] = useState(null);
  const [selectedDataset, setSelectedDataset] = useState(null);

  // Fetch datasets
  const fetchDatasets = useCallback(async () => {
    setDatasetsLoading(true);
    setDatasetsError(null);
    try {
      const data = await fhirApi.getDatasets();
      setDatasets(Array.isArray(data) ? data : data.datasets || []);
    } catch (err) {
      setDatasetsError(err.message || 'Failed to load datasets');
    } finally {
      setDatasetsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'registry') {
      fetchDatasets();
    }
  }, [activeTab, fetchDatasets]);

  // Validate handler
  const handleValidate = async (files, format) => {
    setUploading(true);
    setUploadError(null);
    setValidationReport(null);
    try {
      const formData = new FormData();
      formData.append('format', format);
      files.forEach((f) => formData.append('files', f));
      const report = await fhirApi.uploadFiles(formData, (progress) => {
        // Progress callback — FileUploader manages its own display
      });
      setValidationReport(report);
    } catch (err) {
      setUploadError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  // Load to FHIR handler
  const handleLoad = async (datasetId, studyName) => {
    setLoadingLoad(true);
    try {
      await fhirApi.loadDataset(datasetId, studyName);
      setValidationReport((prev) =>
        prev ? { ...prev, overall_status: 'LOADED' } : prev
      );
      // Refresh registry
      fetchDatasets();
    } catch (err) {
      setUploadError(err.message || 'Failed to load into FHIR server');
    } finally {
      setLoadingLoad(false);
    }
  };

  // Registry: load dataset
  const handleRegistryLoad = async (ds) => {
    const studyName = prompt('Enter study name for FHIR loading:', ds.study_name || '');
    if (!studyName) return;
    try {
      await fhirApi.loadDataset(ds.id, studyName);
      fetchDatasets();
    } catch (err) {
      alert('Failed to load: ' + (err.message || 'Unknown error'));
    }
  };

  // Registry: delete dataset
  const handleDelete = async (ds) => {
    if (!confirm(`Delete dataset "${ds.study_name || ds.name}"? This cannot be undone.`)) {
      return;
    }
    try {
      await fhirApi.deleteDataset(ds.id);
      setSelectedDataset(null);
      fetchDatasets();
    } catch (err) {
      alert('Failed to delete: ' + (err.message || 'Unknown error'));
    }
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Database size={28} className="text-blue-600" />
          Data Management
        </h1>
        <p className="text-gray-500 mt-1">
          Upload, validate, and load clinical trial data into the FHIR server.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-5 py-2 rounded-md text-sm font-medium transition-colors ${
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

      {/* Upload & Validate tab */}
      {activeTab === 'upload' && (
        <div className="space-y-6">
          <TemplateDownload />

          <Card title="Upload Files" icon={Upload}>
            <FileUploader onValidate={handleValidate} loading={uploading} />
          </Card>

          {uploadError && (
            <ErrorMessage
              message={uploadError}
              onRetry={() => setUploadError(null)}
            />
          )}

          {validationReport && (
            <Card title="Validation Report" icon={Database}>
              <ValidationReport
                report={validationReport}
                onLoad={handleLoad}
                loadingLoad={loadingLoad}
              />
            </Card>
          )}
        </div>
      )}

      {/* Dataset Registry tab */}
      {activeTab === 'registry' && (
        <div className="space-y-4">
          {datasetsLoading ? (
            <div className="py-16 flex justify-center">
              <LoadingSpinner />
            </div>
          ) : datasetsError ? (
            <ErrorMessage message={datasetsError} onRetry={fetchDatasets} />
          ) : (
            <Card title="Datasets" icon={List}>
              <DatasetRegistry
                datasets={datasets}
                onView={(ds) => setSelectedDataset(ds)}
                onLoad={handleRegistryLoad}
                onDelete={handleDelete}
              />
            </Card>
          )}

          <DatasetDetailDrawer
            dataset={selectedDataset}
            open={!!selectedDataset}
            onClose={() => setSelectedDataset(null)}
          />
        </div>
      )}
    </div>
  );
}
