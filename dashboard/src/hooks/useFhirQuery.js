import { useState, useEffect, useCallback } from 'react';

export function useFhirQuery(queryFn, deps = [], options = {}) {
  const enabled = options.enabled ?? true;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    if (!enabled) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await queryFn();
      setData(result);
    } catch (err) {
      const detail = err.response?.data?.detail;
      const msg = typeof detail === 'string' ? detail : err.message;
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [...deps, enabled]);

  useEffect(() => { refetch(); }, [refetch]);

  return { data, loading, error, refetch };
}
