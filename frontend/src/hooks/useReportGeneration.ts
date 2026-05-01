import { useState, useCallback } from 'react';
import { getApiClient } from '../api/client';
import { TrendReportResponse } from '../types/api';

export type ReportGenerationStep = 'idle' | 'submitting' | 'generating' | 'ready' | 'error';

interface UseReportGenerationState {
  step: ReportGenerationStep;
  reportId: string | null;
  error: Error | null;
  isLoading: boolean;
  isReady: boolean;
}

interface UseReportGenerationActions {
  generateReport: (
    patientId: string,
    periodStart: string,
    periodEnd: string
  ) => Promise<string>;
  reset: () => void;
  clearError: () => void;
}

/**
 * Hook for managing the complete report generation workflow
 * Handles submission, polling, and state transitions
 */
export function useReportGeneration(): UseReportGenerationState & UseReportGenerationActions {
  const [state, setState] = useState<UseReportGenerationState>({
    step: 'idle',
    reportId: null,
    error: null,
    isLoading: false,
    isReady: false
  });

  const generateReport = useCallback(
    async (
      patientId: string,
      periodStart: string,
      periodEnd: string
    ): Promise<string> => {
      setState({
        step: 'submitting',
        reportId: null,
        error: null,
        isLoading: true,
        isReady: false
      });

      try {
        const apiClient = getApiClient();

        // Step 1: Submit report generation
        const response = await apiClient.post<TrendReportResponse>(
          '/v1/symptoms/reports/trend',
          {
            patient_id: patientId,
            period_start: periodStart,
            period_end: periodEnd
          }
        );

        const reportId = response.data.report_id;

        // Step 2: Poll for completion
        setState(prev => ({
          ...prev,
          step: 'generating',
          reportId
        }));

        // Poll the status endpoint
        let completed = false;
        let attempts = 0;
        const maxAttempts = 30; // 30 * 2 seconds = 60 seconds max wait
        const pollInterval = 2000; // 2 seconds

        while (!completed && attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, pollInterval));
          attempts++;

          try {
            const statusResponse = await apiClient.get<{ status: string }>(`/v1/reports/${reportId}/status`);
            const jobStatus = statusResponse.data.status;

            if (jobStatus === 'completed') {
              completed = true;
              setState({
                step: 'ready',
                reportId,
                error: null,
                isLoading: false,
                isReady: true
              });
              return reportId;
            } else if (jobStatus === 'failed') {
              throw new Error('Report generation failed on the server');
            }
            // Continue polling for pending/processing
          } catch (pollErr) {
            // Continue polling unless it's a real error
            if (pollErr instanceof Error && pollErr.message.includes('failed on the server')) {
              throw pollErr;
            }
          }
        }

        if (!completed) {
          throw new Error('Report generation timed out after 60 seconds');
        }

        return reportId;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error during report generation');
        setState({
          step: 'error',
          reportId: null,
          error,
          isLoading: false,
          isReady: false
        });
        throw error;
      }
    },
    []
  );

  const reset = useCallback(() => {
    setState({
      step: 'idle',
      reportId: null,
      error: null,
      isLoading: false,
      isReady: false
    });
  }, []);

  const clearError = useCallback(() => {
    setState(prev => ({
      ...prev,
      error: null,
      step: prev.step === 'error' ? 'idle' : prev.step
    }));
  }, []);

  return {
    ...state,
    generateReport,
    reset,
    clearError
  };
}
