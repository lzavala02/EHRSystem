import { FormEvent, useEffect, useMemo, useState } from 'react';
import { getApiClient } from '../../api/client';
import { ErrorAlert, SuccessAlert } from '../../components/Alerts';
import { useAuth } from '../../context/AuthContext';
import { useSelectedPatient } from '../../context/SelectedPatientContext';
import { useFetch } from '../../hooks/useFetch';
import { useJobStatus } from '../../hooks/useJobStatus';
import { PatientListItem, PatientListResponse, TrendReportResponse } from '../../types/api';
import { getUtcDayEnd, getUtcDayStart } from '../../utils/date';

function normalizePatients(payload: PatientListItem[] | PatientListResponse | null): PatientListItem[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  return payload.patients ?? [];
}

function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
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

  const [jobUrl, setJobUrl] = useState<string | null>(null);
  const [currentReportId, setCurrentReportId] = useState<string | null>(null);
  const [submittingReport, setSubmittingReport] = useState(false);
  const [submittingShare, setSubmittingShare] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    status: jobStatus,
    data: jobData,
    error: jobError,
    loading: jobLoading
  } = useJobStatus<{ report_id?: string }>(jobUrl ?? '');

  useEffect(() => {
    if (selectedPatientId && !patientId) {
      setPatientId(selectedPatientId);
    }
  }, [selectedPatientId, patientId]);

  useEffect(() => {
    if (jobStatus === 'completed') {
      const completedReportId = jobData?.report_id ?? currentReportId;
      if (completedReportId) {
        setCurrentReportId(completedReportId);
        setSuccessMessage('Trend report generated and ready to share.');
      }
      setJobUrl(null);
    }
  }, [jobStatus, jobData, currentReportId]);

  useEffect(() => {
    if (jobError) {
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

      setCurrentReportId(response.data.report_id);
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
      await apiClient.post('/v1/provider/quick-share', {
        patient_id: patientId,
        from_provider_id: user?.provider_id ?? user?.user_id,
        to_provider_id: toProviderId.trim(),
        report_id: currentReportId,
        message: message.trim() || undefined
      });

      setSuccessMessage('Quick-share sent successfully.');
      setMessage('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send quick-share.');
    } finally {
      setSubmittingShare(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-clinical-900">Quick-Share</h1>

      {patientsError && <ErrorAlert message={patientsError.message} />}
      {error && <ErrorAlert message={error} />}
      {successMessage && <SuccessAlert message={successMessage} />}

      <form onSubmit={handleGenerateReport} className="bg-white rounded-lg shadow p-6 space-y-4">
        <h2 className="text-xl font-semibold text-clinical-900">1) Generate Trend Report</h2>

        <div>
          <label htmlFor="patient-id" className="block text-sm font-medium text-clinical-700 mb-1">
            Patient
          </label>
          <select
            id="patient-id"
            value={patientId}
            onChange={(e) => {
              setPatientId(e.target.value);
              setSelectedPatientId(e.target.value || null);
            }}
            disabled={patientsLoading}
            className="w-full border border-clinical-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-clinical-500"
          >
            <option value="">Select patient</option>
            {patients.map((patient) => (
              <option key={patient.patient_id} value={patient.patient_id}>
                {patient.patient_name} ({patient.patient_id})
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="start-date" className="block text-sm font-medium text-clinical-700 mb-1">
              Start Date
            </label>
            <input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full border border-clinical-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-clinical-500"
            />
          </div>
          <div>
            <label htmlFor="end-date" className="block text-sm font-medium text-clinical-700 mb-1">
              End Date
            </label>
            <input
              id="end-date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full border border-clinical-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-clinical-500"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={submittingReport || jobLoading}
          className="px-4 py-2 bg-clinical-600 text-white rounded-lg hover:bg-clinical-700 disabled:opacity-50"
        >
          {submittingReport ? 'Submitting...' : jobLoading ? 'Generating...' : 'Generate Report'}
        </button>

        {(jobUrl || jobStatus === 'processing' || jobStatus === 'pending') && (
          <p className="text-sm text-clinical-600">Report status: {jobStatus}</p>
        )}

        {currentReportId && (
          <p className="text-sm text-health-success font-medium">Current report ID: {currentReportId}</p>
        )}
      </form>

      <section className="bg-white rounded-lg shadow p-6 space-y-4">
        <h2 className="text-xl font-semibold text-clinical-900">2) Quick-Share to PCP</h2>

        <div>
          <label htmlFor="to-provider-id" className="block text-sm font-medium text-clinical-700 mb-1">
            Destination Provider ID
          </label>
          <input
            id="to-provider-id"
            type="text"
            value={toProviderId}
            onChange={(e) => setToProviderId(e.target.value)}
            placeholder="Enter PCP provider ID"
            className="w-full border border-clinical-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-clinical-500"
          />
        </div>

        <div>
          <label htmlFor="share-message" className="block text-sm font-medium text-clinical-700 mb-1">
            Optional Message
          </label>
          <textarea
            id="share-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            placeholder="Include summary context for receiving provider"
            className="w-full border border-clinical-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-clinical-500"
          />
        </div>

        <button
          type="button"
          onClick={() => {
            void handleQuickShare();
          }}
          disabled={submittingShare || !currentReportId}
          className="px-4 py-2 bg-health-info text-white rounded-lg hover:opacity-90 disabled:opacity-50"
        >
          {submittingShare ? 'Sending...' : 'Send Quick-Share'}
        </button>
      </section>
    </div>
  );
}
