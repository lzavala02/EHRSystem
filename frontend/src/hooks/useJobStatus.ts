import { useState, useEffect } from 'react';
import { getApiClient } from '../api/client';

interface UseJobStatusState<T> {
  data: T | null;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  loading: boolean;
  error: Error | null;
}

/**
 * Hook for polling a background job status endpoint (202 pattern)
 * Useful for async operations like report generation
 */
export function useJobStatus<T>(
  jobUrl: string,
  initialPollInterval = 2000
): UseJobStatusState<T> {
  const [state, setState] = useState<UseJobStatusState<T>>({
    data: null,
    status: 'pending',
    loading: true,
    error: null
  });
  const [pollInterval] = useState(initialPollInterval);

  useEffect(() => {
    if (!jobUrl) {
      setState(prev => ({ ...prev, loading: false }));
      return;
    }

    let isActive = true;
    const poll = async () => {
      try {
        const apiClient = getApiClient();
        const response = await apiClient.get<{
          status: string;
          data?: T;
          progress?: number;
        }>(jobUrl);

        if (!isActive) return;

        const jobStatus = response.data.status as 'pending' | 'processing' | 'completed' | 'failed';

        if (jobStatus === 'completed') {
          setState({
            data: response.data.data ?? null,
            status: 'completed',
            loading: false,
            error: null
          });
          return; // Stop polling
        }

        if (jobStatus === 'failed') {
          setState({
            data: null,
            status: 'failed',
            loading: false,
            error: new Error('Job failed to complete')
          });
          return;
        }

        // Still pending/processing, continue polling
        setState(prev => ({
          ...prev,
          status: jobStatus,
          loading: true,
          error: null
        }));

        // Schedule next poll
        const timeout = setTimeout(poll, pollInterval);
        return () => clearTimeout(timeout);
      } catch (err) {
        if (!isActive) return;
        setState({
          data: null,
          status: 'failed',
          loading: false,
          error: err instanceof Error ? err : new Error('Unknown error occurred')
        });
      }
    };

    // Initial poll
    poll();

    return () => {
      isActive = false;
    };
  }, [jobUrl, pollInterval]);

  return state;
}
