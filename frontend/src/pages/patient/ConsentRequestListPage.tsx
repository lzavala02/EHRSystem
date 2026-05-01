import { useMemo, useState } from 'react';
import { getApiClient } from '../../api/client';
import { ErrorAlert, SuccessAlert } from '../../components/Alerts';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { useFetch } from '../../hooks/useFetch';
import { ConsentRequest } from '../../types/api';
import { formatUtcTimestamp, getRelativeTime } from '../../utils/date';

interface ConsentRequestEnvelope {
  requests: ConsentRequest[];
}

function normalizeConsentRequests(payload: ConsentRequest[] | ConsentRequestEnvelope | null): ConsentRequest[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  return payload.requests ?? [];
}

export function ConsentRequestListPage() {
  const {
    data,
    loading,
    error,
    refetch
  } = useFetch<ConsentRequest[] | ConsentRequestEnvelope>('/v1/consent/requests');

  const [actionError, setActionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);

  const requests = useMemo(() => normalizeConsentRequests(data ?? null), [data]);

  const submitDecision = async (requestId: string, decision: 'Approve' | 'Deny') => {
    setActionError(null);
    setSuccessMessage(null);
    setActiveRequestId(requestId);

    try {
      const apiClient = getApiClient();
      await apiClient.post(`/v1/consent/requests/${requestId}/decision`, { decision });
      setSuccessMessage(`Request ${decision === 'Approve' ? 'approved' : 'denied'} successfully.`);
      await refetch();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to update consent request.');
    } finally {
      setActiveRequestId(null);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading consent requests..." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-clinical-900">Consent Requests</h1>
        <button
          type="button"
          onClick={() => {
            void refetch();
          }}
          className="px-4 py-2 text-sm bg-clinical-600 text-white rounded-lg hover:bg-clinical-700 transition"
        >
          Refresh
        </button>
      </div>

      {error && <ErrorAlert message={error.message} />}
      {actionError && <ErrorAlert message={actionError} />}
      {successMessage && <SuccessAlert message={successMessage} />}

      <div className="bg-white rounded-lg shadow p-6">
        {requests.length === 0 ? (
          <p className="text-clinical-600">You have no consent requests at this time.</p>
        ) : (
          <ul className="space-y-4">
            {requests.map((request) => {
              const isPending = request.status === 'Pending';
              const isProcessing = activeRequestId === request.request_id;

              return (
                <li key={request.request_id} className="border border-clinical-200 rounded-lg p-4">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold text-clinical-900">{request.provider_name}</p>
                      <p className="text-sm text-clinical-600">{request.provider_specialty}</p>
                      <p className="text-sm text-clinical-700 mt-2">{request.reason}</p>
                      <p className="text-xs text-clinical-500 mt-2">
                        Requested {getRelativeTime(request.requested_at)} ({formatUtcTimestamp(request.requested_at)})
                      </p>
                    </div>

                    <div className="flex flex-col items-start md:items-end gap-2">
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

                      {isPending && (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={isProcessing}
                            onClick={() => {
                              void submitDecision(request.request_id, 'Approve');
                            }}
                            className="px-3 py-1.5 text-sm bg-health-success text-white rounded hover:opacity-90 disabled:opacity-50"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            disabled={isProcessing}
                            onClick={() => {
                              void submitDecision(request.request_id, 'Deny');
                            }}
                            className="px-3 py-1.5 text-sm bg-health-danger text-white rounded hover:opacity-90 disabled:opacity-50"
                          >
                            Deny
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
