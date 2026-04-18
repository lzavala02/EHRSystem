import { useState, useEffect, useCallback } from 'react';
import { getApiClient } from '../api/client';

interface UseFetchState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

interface UseFetchOptions {
  skip?: boolean;
  refetchInterval?: number;
}

/**
 * Generic data fetching hook with loading and error states
 */
export function useFetch<T>(
  url: string,
  options: UseFetchOptions = {}
): UseFetchState<T> & { refetch: () => Promise<void> } {
  const [state, setState] = useState<UseFetchState<T>>({
    data: null,
    loading: true,
    error: null
  });
  const { skip = false, refetchInterval } = options;

  const fetch = useCallback(async () => {
    if (skip) {
      setState(prev => ({ ...prev, loading: false }));
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const apiClient = getApiClient();
      const response = await apiClient.get<T>(url);
      setState({ data: response.data, loading: false, error: null });
    } catch (err) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err : new Error('Unknown error occurred')
      }));
    }
  }, [url, skip]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  // Auto-refetch if interval provided
  useEffect(() => {
    if (!refetchInterval) return;
    const interval = setInterval(fetch, refetchInterval);
    return () => clearInterval(interval);
  }, [fetch, refetchInterval]);

  return { ...state, refetch: fetch };
}
