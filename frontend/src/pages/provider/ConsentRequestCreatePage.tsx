import { FormEvent, useEffect, useMemo, useState } from 'react';
import { getApiClient } from '../../api/client';
import { ErrorAlert, SuccessAlert } from '../../components/Alerts';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { useSelectedPatient } from '../../context/SelectedPatientContext';
import { useFetch } from '../../hooks/useFetch';
import { ConsentRequest, PatientListItem, PatientListResponse } from '../../types/api';
import { formatUtcTimestamp, getRelativeTime } from '../../utils/date';

interface ConsentRequestEnvelope {
  requests: ConsentRequest[];
}

function normalizePatients(payload: PatientListItem[] | PatientListResponse | null): PatientListItem[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  return payload.patients ?? [];
}

function normalizeConsentRequests(payload: ConsentRequest[] | ConsentRequestEnvelope | null): ConsentRequest[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  return payload.requests ?? [];
}

export function ConsentRequestCreatePage() {
  const { selectedPatientId, setSelectedPatientId } = useSelectedPatient();

  const {
    data: patientsData,
    loading: patientsLoading,
    error: patientsError,
    refetch: refetchPatients
  } = useFetch<PatientListItem[] | PatientListResponse>('/v1/provider/patients');

  const {
    data: consentData,
    loading: consentLoading,
    error: consentError,
    refetch: refetchConsent
  } = useFetch<ConsentRequest[] | ConsentRequestEnvelope>('/v1/consent/requests');

  const patients = useMemo(() => normalizePatients(patientsData ?? null), [patientsData]);
  const consentRequests = useMemo(() => normalizeConsentRequests(consentData ?? null), [consentData]);

  const [patientId, setPatientId] = useState(selectedPatientId ?? '');
  const [reason, setReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (selectedPatientId && !patientId) {
      setPatientId(selectedPatientId);
    }
  }, [selectedPatientId, patientId]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setActionError(null);
    setSuccessMessage(null);

    if (!patientId) {
      setActionError('Select a patient before sending a consent request.');
      return;
    }

    if (!reason.trim()) {
      setActionError('A consent reason is required.');
      return;
    }

    setSubmitting(true);
    try {
      const apiClient = getApiClient();
      await apiClient.post('/v1/consent/requests', {
        patient_id: patientId,
        reason: reason.trim()
      });
      setSuccessMessage('Consent request sent successfully.');
      setReason('');
      await refetchConsent();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to create consent request.');
    } finally {
      setSubmitting(false);
    }
  };

  if (patientsLoading || consentLoading) {
    return <LoadingSpinner message="Loading consent workflow..." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-clinical-900">Provider Consent Workflow</h1>
        <button
          type="button"
          onClick={() => {
            void Promise.all([refetchPatients(), refetchConsent()]);
          }}
          className="px-4 py-2 text-sm bg-clinical-600 text-white rounded-lg hover:bg-clinical-700 transition"
        >
          Refresh
        </button>
      </div>

      {patientsError && <ErrorAlert message={patientsError.message} />}
      {consentError && <ErrorAlert message={consentError.message} />}
      {actionError && <ErrorAlert message={actionError} />}
      {successMessage && <SuccessAlert message={successMessage} />}

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-4">
        <h2 className="text-xl font-semibold text-clinical-900">Create Consent Request</h2>

        <div>
          <label htmlFor="consent-patient-id" className="block text-sm font-medium text-clinical-700 mb-1">
            Patient
          </label>
          <select
            id="consent-patient-id"
            value={patientId}
            onChange={(e) => {
              setPatientId(e.target.value);
              setSelectedPatientId(e.target.value || null);
            }}
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

        <div>
          <label htmlFor="consent-reason" className="block text-sm font-medium text-clinical-700 mb-1">
            Reason
          </label>
          <textarea
            id="consent-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Enter why access is needed for this patient"
            className="w-full border border-clinical-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-clinical-500"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-2 bg-clinical-600 text-white rounded-lg hover:bg-clinical-700 disabled:opacity-50"
        >
          {submitting ? 'Sending...' : 'Send Consent Request'}
        </button>
      </form>

      <section className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-clinical-900 mb-4">Recent Consent Requests</h2>
        {consentRequests.length === 0 ? (
          <p className="text-clinical-600">No consent requests found.</p>
        ) : (
          <ul className="space-y-3">
            {consentRequests
              .slice()
              .sort((a, b) => new Date(b.requested_at).getTime() - new Date(a.requested_at).getTime())
              .map((request) => (
                <li key={request.request_id} className="border border-clinical-200 rounded-lg p-4">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                    <div>
                      <p className="font-semibold text-clinical-900">{request.provider_name}</p>
                      <p className="text-sm text-clinical-700 mt-1">Patient: {request.patient_id}</p>
                      <p className="text-sm text-clinical-700">{request.reason}</p>
                      <p className="text-xs text-clinical-500 mt-2">
                        Requested {getRelativeTime(request.requested_at)} ({formatUtcTimestamp(request.requested_at)})
                      </p>
                    </div>
                    <span
                      className={`inline-flex px-2 py-1 text-xs rounded font-medium ${
                        request.status === 'Approved'
                          ? 'bg-health-success text-white'
                          : request.status === 'Denied'
                            ? 'bg-health-danger text-white'
                            : 'bg-health-warning text-white'
                      }`}
                    >
                      {request.status}
                    </span>
                  </div>
                </li>
              ))}
          </ul>
        )}
      </section>
    </div>
  );
}
