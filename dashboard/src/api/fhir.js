import client from './client';

export const fhirApi = {
  // Studies
  getStudies: () => client.get('/api/fhir/studies').then(r => r.data),
  getStudy: (id) => client.get(`/api/fhir/studies/${id}`).then(r => r.data),

  // Patients
  getStudyPatients: (studyId, count = 200) =>
    client.get(`/api/fhir/studies/${studyId}/patients`, { params: { count } }).then(r => r.data),

  // Adverse events
  getStudyAdverseEvents: (studyId, count = 1000) =>
    client.get(`/api/fhir/studies/${studyId}/adverse-events`, { params: { count } }).then(r => r.data),

  // Observations
  getStudyObservations: (studyId, category, count = 2000) =>
    client.get(`/api/fhir/studies/${studyId}/observations`, {
      params: { category, count },
    }).then(r => r.data),

  // Patient timeline
  getPatientTimeline: (patientId) =>
    client.get(`/api/fhir/patients/${patientId}/timeline`).then(r => r.data),

  // Upload
  uploadFiles: (formData, onProgress) =>
    client.post('/api/upload/validate', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: onProgress,
    }).then(r => {
      // Flatten: expose validation_report fields at top level for the UI
      const data = r.data;
      const vr = data.validation_report || {};
      return {
        dataset_id: data.dataset_id,
        overall_status: vr.status || data.status,
        domains: vr.domains || {},
        total_rows: Object.values(vr.domains || {}).reduce((sum, d) => sum + (d.row_count || 0), 0),
        message: data.message,
      };
    }),

  loadDataset: (datasetId, studyName) =>
    client.post(`/api/upload/load/${datasetId}`, { study_name: studyName }).then(r => r.data),

  loadToFhir: (formData) =>
    client.post('/api/upload/load', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
    }).then(r => r.data),

  // Datasets
  getDatasets: () => client.get('/api/datasets').then(r => r.data),
  getDataset: (id) => client.get(`/api/datasets/${id}`).then(r => r.data),
  deleteDataset: (id) => client.delete(`/api/datasets/${id}`).then(r => r.data),
};
