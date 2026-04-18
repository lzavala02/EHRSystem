import { useMemo, useState } from 'react';
import { ErrorAlert } from '../../components/Alerts';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { useFetch } from '../../hooks/useFetch';
import { Alert, AlertListResponse } from '../../types/api';
import { formatUtcTimestamp, getRelativeTime } from '../../utils/date';

function normalizeAlerts(payload: Alert[] | AlertListResponse | null): Alert[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  return payload.alerts ?? [];
}

export function AlertsDashboardPage() {
  const [statusFilter, setStatusFilter] = useState<'all' | 'Active' | 'Resolved'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'NegativeTrend' | 'SyncConflict'>('all');

  const {
    data,
    loading,
    error,
    refetch
  } = useFetch<Alert[] | AlertListResponse>('/v1/alerts');

  const alerts = useMemo(() => normalizeAlerts(data ?? null), [data]);

  const filteredAlerts = useMemo(() => {
    return alerts
      .filter((alert) => (statusFilter === 'all' ? true : alert.status === statusFilter))
      .filter((alert) => (typeFilter === 'all' ? true : alert.alert_type === typeFilter))
      .sort((a, b) => new Date(b.triggered_at).getTime() - new Date(a.triggered_at).getTime());
  }, [alerts, statusFilter, typeFilter]);

  if (loading) {
    return <LoadingSpinner message="Loading alerts..." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-clinical-900">Alerts</h1>
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

      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label htmlFor="status-filter" className="block text-sm font-medium text-clinical-700 mb-1">
              Status
            </label>
            <select
              id="status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'Active' | 'Resolved')}
              className="w-full border border-clinical-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-clinical-500"
            >
              <option value="all">All statuses</option>
              <option value="Active">Active</option>
              <option value="Resolved">Resolved</option>
            </select>
          </div>
          <div>
            <label htmlFor="type-filter" className="block text-sm font-medium text-clinical-700 mb-1">
              Alert Type
            </label>
            <select
              id="type-filter"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as 'all' | 'NegativeTrend' | 'SyncConflict')}
              className="w-full border border-clinical-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-clinical-500"
            >
              <option value="all">All types</option>
              <option value="NegativeTrend">Negative Trend</option>
              <option value="SyncConflict">Sync Conflict</option>
            </select>
          </div>
          <div className="flex items-end">
            <p className="text-sm text-clinical-600">{filteredAlerts.length} alert(s) shown</p>
          </div>
        </div>

        {filteredAlerts.length === 0 ? (
          <p className="text-clinical-600">No alerts match your filters.</p>
        ) : (
          <ul className="space-y-3">
            {filteredAlerts.map((alert) => (
              <li key={alert.alert_id} className="border border-clinical-200 rounded-lg p-4">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                  <div>
                    <p className="font-semibold text-clinical-900">{alert.description}</p>
                    <p className="text-sm text-clinical-600 mt-1">
                      Patient: {alert.patient_id}
                      {alert.provider_id ? ` | Provider: ${alert.provider_id}` : ''}
                    </p>
                    <p className="text-xs text-clinical-500 mt-2">
                      Triggered {getRelativeTime(alert.triggered_at)} ({formatUtcTimestamp(alert.triggered_at)})
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <span
                      className={`inline-flex px-2 py-1 text-xs rounded font-medium ${
                        alert.alert_type === 'NegativeTrend'
                          ? 'bg-health-warning text-white'
                          : 'bg-health-info text-white'
                      }`}
                    >
                      {alert.alert_type}
                    </span>
                    <span
                      className={`inline-flex px-2 py-1 text-xs rounded font-medium ${
                        alert.status === 'Active'
                          ? 'bg-health-danger text-white'
                          : 'bg-health-success text-white'
                      }`}
                    >
                      {alert.status}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
