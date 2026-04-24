import { FormEvent, useEffect, useMemo, useState } from 'react';
import { getApiClient } from '../../api/client';
import { ErrorAlert } from '../../components/Alerts';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { useAuth } from '../../context/AuthContext';
import { useSelectedPatient } from '../../context/SelectedPatientContext';
import { useFetch } from '../../hooks/useFetch';
import { useJobStatus } from '../../hooks/useJobStatus';
import {
  PatientListItem,
  PatientListResponse,
  QuickSharePrefillResponse,
  QuickShareResponse,
  ReportData,
  TrendReportResponse
} from '../../types/api';
import { formatUtcTimestamp, getUtcDayEnd, getUtcDayStart } from '../../utils/date';

function normalizePatients(payload: PatientListItem[] | PatientListResponse | null): PatientListItem[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  return payload.patients ?? [];
}

function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function toDateInputValueFromIso(rawValue: unknown): string | null {
  if (typeof rawValue !== 'string' || !rawValue.trim()) {
    return null;
  }

  const parsed = new Date(rawValue);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().slice(0, 10);
}

export function QuickSharePage() {
  const { user } = useAuth();
  const { selectedPatientId, setSelectedPatientId } = useSelectedPatient();

  const {
    data: patientsData,
    loading: patientsLoading,
    error: patientsError
  } = useFetch<PatientListItem[] | PatientListResponse>('/v1/provider/patients');

  const patients = useMemo(() => normalizePatients(patientsData ?? null), [patientsData]);

  const [patientId, setPatientId] = useState(selectedPatientId ?? '');
  const [toProviderId, setToProviderId] = useState('');
  const [message, setMessage] = useState('');
  const [startDate, setStartDate] = useState(toDateInputValue(new Date(Date.now() - 1000 * 60 * 60 * 24 * 30)));
  const [endDate, setEndDate] = useState(toDateInputValue(new Date()));
  const [startDateTouched, setStartDateTouched] = useState(false);
  const [endDateTouched, setEndDateTouched] = useState(false);
  const [prefillSourceTimestamp, setPrefillSourceTimestamp] = useState<string | null>(null);

  const [jobUrl, setJobUrl] = useState<string | null>(null);
  const [currentReportId, setCurrentReportId] = useState<string | null>(null);
  const [reportWorkflowStatus, setReportWorkflowStatus] = useState<
    'idle' | 'pending' | 'processing' | 'completed' | 'failed'
  >('idle');
  const [reportResponse, setReportResponse] = useState<TrendReportResponse | null>(null);
  const [reportMetadata, setReportMetadata] = useState<ReportData | null>(null);
  const [loadingReportMetadata, setLoadingReportMetadata] = useState(false);
  const [downloadingReport, setDownloadingReport] = useState(false);
  const [submittingReport, setSubmittingReport] = useState(false);
  const [submittingShare, setSubmittingShare] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [shareReceipt, setShareReceipt] = useState<QuickShareResponse | null>(null);

  const {
    status: jobStatus,
    data: jobData,
    error: jobError,
    loading: jobLoading
  } = useJobStatus<{ report_id?: string }>(jobUrl ?? '');

  const loadReportMetadata = async (reportId: string) => {
    setLoadingReportMetadata(true);
    try {
      const apiClient = getApiClient();
      const response = await apiClient.get<ReportData>(`/v1/reports/${reportId}`);
      setReportMetadata(response.data);
    } catch (err) {
      setReportMetadata(null);
      setError(err instanceof Error ? err.message : 'Unable to load generated report details.');
    } finally {
      setLoadingReportMetadata(false);
    }
  };

  const handleDownloadReport = async () => {
    if (!currentReportId) {
      setError('Generate a report before downloading it.');
      return;
    }

    setError(null);
    setDownloadingReport(true);

    try {
      const apiClient = getApiClient();
      const metadataResponse = await apiClient.get<ReportData>(`/v1/reports/${currentReportId}`);
      setReportMetadata(metadataResponse.data);

      const pdfResponse = await apiClient.get(metadataResponse.data.secure_url, {
        responseType: 'blob'
      });

      const blob = new Blob([pdfResponse.data], { type: 'application/pdf' });
      const objectUrl = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = `${currentReportId}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(objectUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to download the generated PDF report.');
    } finally {
      setDownloadingReport(false);
    }
  };

  useEffect(() => {
    if (selectedPatientId && !patientId) {
      setPatientId(selectedPatientId);
    }
  }, [selectedPatientId, patientId]);

  useEffect(() => {
    if (!patientId) {
      setPrefillSourceTimestamp(null);
      return;
    }

    const loadPrefill = async () => {
      try {
        const apiClient = getApiClient();
        const response = await apiClient.get<QuickSharePrefillResponse>(
          `/v1/provider/patients/${patientId}/quick-share-prefill`
        );
        const fields = response.data.fields ?? {};

        const suggestedToProviderId =
          typeof fields['to_provider_id'] === 'string' ? String(fields['to_provider_id']) : '';
        const suggestedMessage = typeof fields['message'] === 'string' ? String(fields['message']) : '';
        const suggestedStartDate = toDateInputValueFromIso(fields['period_start']);
        const suggestedEndDate = toDateInputValueFromIso(fields['period_end']);

        setToProviderId((current) => current || suggestedToProviderId);
        setMessage((current) => current || suggestedMessage);

        if (!startDateTouched && suggestedStartDate) {
          setStartDate(suggestedStartDate);
        }
        if (!endDateTouched && suggestedEndDate) {
          setEndDate(suggestedEndDate);
        }

        setPrefillSourceTimestamp(response.data.source_timestamp_utc);
      } catch {
        setPrefillSourceTimestamp(null);
      }
    };

    void loadPrefill();
  }, [patientId, startDateTouched, endDateTouched]);

  useEffect(() => {
    if (jobStatus === 'pending' || jobStatus === 'processing') {
      setReportWorkflowStatus(jobStatus);
    }

    if (jobStatus === 'completed') {
      const completedReportId = jobData?.report_id ?? currentReportId;
      if (completedReportId) {
        setCurrentReportId(completedReportId);
        setReportWorkflowStatus('completed');
        setSuccessMessage('Trend report generated and ready to share.');
        void loadReportMetadata(completedReportId);
      }
      setJobUrl(null);
    }
  }, [jobStatus, jobData, currentReportId]);

  useEffect(() => {
    if (jobError) {
      setReportWorkflowStatus('failed');
      setError(jobError.message);
      setJobUrl(null);
    }
  }, [jobError]);

  const handleGenerateReport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!patientId) {
      setError('Select a patient before generating a report.');
      return;
    }

    setSubmittingReport(true);
    try {
      const apiClient = getApiClient();
      const response = await apiClient.post<TrendReportResponse>('/v1/symptoms/reports/trend', {
        patient_id: patientId,
        period_start: getUtcDayStart(new Date(startDate)),
        period_end: getUtcDayEnd(new Date(endDate))
      });

      setReportResponse(response.data);
      setReportMetadata(null);
      setShareReceipt(null);
      setCurrentReportId(response.data.report_id);
      setReportWorkflowStatus(response.data.status);
      setJobUrl(`/v1/reports/${response.data.report_id}/status`);
      setSuccessMessage('Report generation started. Waiting for completion...');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to generate report.');
    } finally {
      setSubmittingReport(false);
    }
  };

  const handleQuickShare = async () => {
    setError(null);
    setSuccessMessage(null);

    if (!patientId) {
      setError('Select a patient before sharing.');
      return;
    }

    if (!toProviderId.trim()) {
      setError('Destination provider ID is required.');
      return;
    }

    if (!currentReportId) {
      setError('Generate a report before sending quick-share.');
      return;
    }

    setSubmittingShare(true);
    try {
      const apiClient = getApiClient();
      const response = await apiClient.post<QuickShareResponse>('/v1/provider/quick-share', {
        patient_id: patientId,
        from_provider_id: user?.provider_id ?? user?.user_id,
        to_provider_id: toProviderId.trim(),
        report_id: currentReportId,
        message: message.trim() || undefined
      });

      setShareReceipt(response.data);
      setSuccessMessage('Quick-share sent successfully to the receiving PCP.');
      setMessage('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send quick-share.');
    } finally {
      setSubmittingShare(false);
    }
  };

  const isReportGenerating = submittingReport || jobLoading || loadingReportMetadata;
  const isReportReady = Boolean(currentReportId && reportWorkflowStatus === 'completed' && reportMetadata);
  const canProceedToShare = isReportReady;

  const getStatusColor = (status: string) => {
    if (status === 'pending' || status === 'processing') return 'text-yellow-600 bg-yellow-50';
    if (status === 'completed') return 'text-green-600 bg-green-50';
    if (status === 'failed') return 'text-red-600 bg-red-50';
    return 'text-clinical-600 bg-clinical-50';
  };

  const getStatusText = (status: string) => {
    if (status === 'pending') return 'Pending...';
    if (status === 'processing') return 'Generating Report...';
    if (status === 'completed') return 'Ready';
    if (status === 'failed') return 'Failed';
    return status;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-clinical-900">Secure Report Quick-Share</h1>
        <div className="text-sm text-clinical-600">
          Step 1 of 2: Generate Report
        </div>
      </div>

      {patientsError && (
        <ErrorAlert 
          message={`Unable to load patients: ${patientsError.message}`}
        />
      )}
      
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <div className="flex-1">
            <p className="text-red-800 font-medium">Error</p>
            <p className="text-red-700 text-sm mt-1">{error}</p>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-red-500 hover:text-red-700 flex-shrink-0"
          >
            ✕
          </button>
        </div>
      )}

      {successMessage && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
          <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <div className="flex-1">
            <p className="text-green-800 font-medium">Success</p>
            <p className="text-green-700 text-sm mt-1">{successMessage}</p>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-green-500 hover:text-green-700 flex-shrink-0"
          >
            ✕
          </button>
        </div>
      )}

      {/* Step 1: Generate Report */}
      <form onSubmit={handleGenerateReport} className="bg-white rounded-lg shadow-md p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-clinical-900">Generate Trend Report</h2>
          {currentReportId && (
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(reportWorkflowStatus)}`}>
              {getStatusText(reportWorkflowStatus)}
            </span>
          )}
        </div>

        {/* Patient Selection */}
        <div>
          <label htmlFor="patient-id" className="block text-sm font-medium text-clinical-700 mb-2">
            Select Patient
          </label>
          {patientsLoading ? (
            <div className="w-full border border-clinical-300 rounded-lg px-3 py-2 bg-clinical-50 flex items-center gap-2">
              <LoadingSpinner size="sm" />
              <span className="text-sm text-clinical-600">Loading patients...</span>
            </div>
          ) : (
            <select
              id="patient-id"
              value={patientId}
              onChange={(e) => {
                setPatientId(e.target.value);
                setSelectedPatientId(e.target.value || null);
                setStartDateTouched(false);
                setEndDateTouched(false);
                setCurrentReportId(null);
                setReportWorkflowStatus('idle');
                setReportResponse(null);
                setReportMetadata(null);
                setShareReceipt(null);
                setJobUrl(null);
              }}
              disabled={isReportGenerating}
              className="w-full border border-clinical-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-clinical-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">Select a patient</option>
              {patients.map((patient) => (
                <option key={patient.patient_id} value={patient.patient_id}>
                  {patient.patient_name} ({patient.patient_id})
                </option>
              ))}
            </select>
          )}
          {!patientId && !patientsLoading && (
            <p className="text-xs text-clinical-500 mt-1">Choose a patient to continue</p>
          )}
        </div>

        {/* Date Range Selection */}
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="start-date" className="block text-sm font-medium text-clinical-700 mb-2">
              Start Date
            </label>
            <input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDateTouched(true);
                setStartDate(e.target.value);
              }}
              disabled={isReportGenerating}
              className="w-full border border-clinical-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-clinical-500 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <p className="text-xs text-clinical-500 mt-1">Last 30 days by default</p>
          </div>
          <div>
            <label htmlFor="end-date" className="block text-sm font-medium text-clinical-700 mb-2">
              End Date
            </label>
            <input
              id="end-date"
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDateTouched(true);
                setEndDate(e.target.value);
              }}
              disabled={isReportGenerating}
              className="w-full border border-clinical-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-clinical-500 disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
        </div>

        {/* Prefill Source Info */}
        {prefillSourceTimestamp && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">
              <span className="font-medium">ℹ️ Auto-populated</span>
              {' '}from your visit on{' '}
              <span className="font-semibold">{formatUtcTimestamp(prefillSourceTimestamp)}</span>
            </p>
          </div>
        )}

        {reportResponse?.should_quick_share && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <p className="text-sm font-medium text-amber-900">Negative trend thresholds were exceeded.</p>
            <p className="text-sm text-amber-800 mt-1">
              Quick-share to the PCP is recommended once the report artifact is ready.
            </p>
          </div>
        )}

        {/* Report Generation Status Display */}
        {isReportGenerating && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
            <LoadingSpinner size="sm" className="text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-yellow-800 font-medium">Generating Report</p>
              <p className="text-yellow-700 text-sm mt-1">
                Please wait while we compile the symptom trend data for the selected date range...
              </p>
              {jobStatus && (
                <p className="text-yellow-700 text-xs mt-2">
                  Status: <span className="font-mono">{jobStatus}</span>
                </p>
              )}
            </div>
          </div>
        )}

        {loadingReportMetadata && (
          <div className="bg-clinical-50 border border-clinical-200 rounded-lg p-4 flex items-start gap-3">
            <LoadingSpinner size="sm" className="text-clinical-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-clinical-900 font-medium">Finalizing report artifact</p>
              <p className="text-clinical-700 text-sm mt-1">
                We are loading the generated report details and secure download link.
              </p>
            </div>
          </div>
        )}

        {/* Report Ready Display */}
        {isReportReady && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
            <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <div className="flex-1">
              <p className="text-green-800 font-medium">Report Ready</p>
              <p className="text-green-700 text-sm mt-1">Report ID: <span className="font-mono">{currentReportId}</span></p>
              <p className="text-green-700 text-sm">Proceed to the next step to share with the patient's PCP.</p>
              <div className="mt-3 space-y-1 text-sm text-green-800">
                <p><span className="font-medium">Summary:</span> {reportMetadata?.summary}</p>
                <p>
                  <span className="font-medium">Period:</span>{' '}
                  {reportMetadata ? `${formatUtcTimestamp(reportMetadata.period_start)} to ${formatUtcTimestamp(reportMetadata.period_end)}` : 'Loading...'}
                </p>
                <p><span className="font-medium">Symptoms logged:</span> {reportMetadata?.symptom_count ?? 0}</p>
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => {
                    void handleDownloadReport();
                  }}
                  disabled={downloadingReport}
                  className="px-4 py-2 rounded-lg bg-white text-green-800 border border-green-300 hover:bg-green-100 disabled:opacity-50"
                >
                  {downloadingReport ? 'Downloading PDF...' : 'Download PDF Report'}
                </button>
                {reportMetadata?.expires_at && (
                  <p className="self-center text-xs text-green-700">
                    Secure access expires at {formatUtcTimestamp(reportMetadata.expires_at)}.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Generate Button */}
        <button
          type="submit"
          disabled={!patientId || isReportGenerating}
          className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
            !patientId || isReportGenerating
              ? 'bg-clinical-300 text-clinical-500 cursor-not-allowed'
              : 'bg-clinical-600 text-white hover:bg-clinical-700 active:bg-clinical-800'
          }`}
        >
          {isReportGenerating ? (
            <span className="flex items-center justify-center gap-2">
              <LoadingSpinner size="sm" />
              Generating Report...
            </span>
          ) : (
            'Generate Report'
          )}
        </button>
      </form>

      {/* Step 2: Quick-Share (only enabled after report ready) */}
      <section className="bg-white rounded-lg shadow-md p-6 space-y-6" style={{ opacity: canProceedToShare ? 1 : 0.6 }}>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-clinical-900">Share with PCP</h2>
          <div className="text-sm text-clinical-600">
            Step 2 of 2
          </div>
        </div>

        {!canProceedToShare && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 flex items-start gap-2">
            <svg className="w-5 h-5 text-gray-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 5v8a2 2 0 01-2 2h-5l-5 4v-4H4a2 2 0 01-2-2V5a2 2 0 012-2h12a2 2 0 012 2zm-11-1a1 1 0 11-2 0 1 1 0 012 0zM8 8a1 1 0 100-2 1 1 0 000 2zm5-1a1 1 0 11-2 0 1 1 0 012 0z" clipRule="evenodd" />
            </svg>
            <p className="text-sm text-gray-700">
              Generate a report in Step 1 to proceed with sharing.
            </p>
          </div>
        )}

        {/* Destination Provider */}
        <div>
          <label htmlFor="to-provider-id" className="block text-sm font-medium text-clinical-700 mb-2">
            Destination Provider ID
          </label>
          <input
            id="to-provider-id"
            type="text"
            value={toProviderId}
            onChange={(e) => setToProviderId(e.target.value)}
            placeholder="Enter the primary care physician's provider ID"
            disabled={!canProceedToShare || submittingShare}
            className="w-full border border-clinical-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-clinical-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <p className="text-xs text-clinical-500 mt-1">
            The provider who will receive this report for review.
          </p>
        </div>

        {/* Message */}
        <div>
          <label htmlFor="share-message" className="block text-sm font-medium text-clinical-700 mb-2">
            Message (Optional)
          </label>
          <textarea
            id="share-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            placeholder="Add a custom message or leave blank to use auto-populated message"
            disabled={!canProceedToShare || submittingShare}
            maxLength={500}
            className="w-full border border-clinical-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-clinical-500 disabled:opacity-50 disabled:cursor-not-allowed resize-none"
          />
          <p className="text-xs text-clinical-500 mt-1">
            {message.length}/500 characters
          </p>
        </div>

        {/* Quick-Share Submission Status */}
        {submittingShare && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
            <LoadingSpinner size="sm" className="text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-blue-800 font-medium">Sending Report</p>
              <p className="text-blue-700 text-sm mt-1">
                Please wait while we securely deliver the report to the receiving provider...
              </p>
            </div>
          </div>
        )}

        {shareReceipt && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm font-medium text-green-900">PCP quick-share delivered to the in-app queue.</p>
            <p className="text-sm text-green-800 mt-1">
              Share ID: <span className="font-mono">{shareReceipt.share_id}</span>
            </p>
            {shareReceipt.message && (
              <p className="text-sm text-green-800 mt-1">{shareReceipt.message}</p>
            )}
          </div>
        )}

        {/* Send Button */}
        <button
          type="button"
          onClick={() => {
            void handleQuickShare();
          }}
          disabled={!canProceedToShare || !toProviderId.trim() || submittingShare}
          className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
            !canProceedToShare || !toProviderId.trim() || submittingShare
              ? 'bg-health-info-light text-health-info-dark cursor-not-allowed opacity-50'
              : 'bg-health-info text-white hover:opacity-90 active:opacity-80'
          }`}
        >
          {submittingShare ? (
            <span className="flex items-center justify-center gap-2">
              <LoadingSpinner size="sm" />
              Sending Quick-Share...
            </span>
          ) : (
            'Send Quick-Share to PCP'
          )}
        </button>

        {/* Help Text */}
        <div className="bg-clinical-50 border border-clinical-200 rounded-lg p-3 mt-4">
          <p className="text-sm text-clinical-800">
            <span className="font-medium">What happens next:</span>
            {' '}The receiving provider will be notified securely in-app and can review the symptom trend report. A message with auto-populated context from your last visit will be included.
          </p>
        </div>
      </section>
    </div>
  );
}
