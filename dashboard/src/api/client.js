import axios from 'axios';

const client = axios.create({
  baseURL: window.__API_URL__ || import.meta.env.VITE_API_URL || '',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

client.interceptors.response.use(
  (res) => res,
  (err) => {
    console.error('[API]', err.config?.url, err.response?.status, err.message);
    return Promise.reject(err);
  }
);

export default client;
