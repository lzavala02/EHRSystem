import { useMemo, useState } from 'react';
import { ErrorAlert } from '../../components/Alerts';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { useAuth } from '../../context/AuthContext';
import { useFetch } from '../../hooks/useFetch';
import { SymptomLog, SymptomLogListResponse } from '../../types/api';
import { formatUtcTimestamp } from '../../utils/date';

function normalizeLogs(payload: SymptomLog[] | SymptomLogListResponse | null): SymptomLog[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  return payload.logs ?? [];
}

export function SymptomHistoryPage() {
  const { user } = useAuth();
  const patientId = user?.patient_id;

  const [searchText, setSearchText] = useState('');
  const [minimumSeverity, setMinimumSeverity] = useState<number>(1);

  const {
    data,
    loading,
    error,
    refetch
  } = useFetch<SymptomLog[] | SymptomLogListResponse>(
    `/v1/symptoms/logs${patientId ? `?patient_id=${patientId}` : ''}`,
    { skip: !patientId }
  );

  const logs = useMemo(() => normalizeLogs(data ?? null), [data]);

  const filteredLogs = useMemo(() => {
    const normalizedSearch = searchText.trim().toLowerCase();
    return [...logs]
      .filter((log) => log.severity_scale >= minimumSeverity)
      .filter((log) => {
        if (!normalizedSearch) return true;
        return (
          log.symptom_description.toLowerCase().includes(normalizedSearch) ||
          log.triggers.some((trigger) => trigger.trigger_name.toLowerCase().includes(normalizedSearch)) ||
          log.otc_treatments.some((treatment) => treatment.toLowerCase().includes(normalizedSearch))
        );
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [logs, minimumSeverity, searchText]);

  if (!patientId) {
    return <ErrorAlert message="No patient profile is linked to your account." />;
  }

  if (loading) {
    return <LoadingSpinner message="Loading symptom history..." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-clinical-900">Symptom History</h1>
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
          <div className="md:col-span-2">
            <label htmlFor="history-search" className="block text-sm font-medium text-clinical-700 mb-1">
              Search
            </label>
            <input
              id="history-search"
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search by symptom, trigger, or treatment"
              className="w-full border border-clinical-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-clinical-500"
            />
          </div>
          <div>
            <label htmlFor="min-severity" className="block text-sm font-medium text-clinical-700 mb-1">
              Minimum Severity
            </label>
            <select
              id="min-severity"
              value={minimumSeverity}
              onChange={(e) => setMinimumSeverity(Number(e.target.value))}
              className="w-full border border-clinical-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-clinical-500"
            >
              {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => (
                <option key={value} value={value}>
                  {value}+
                </option>
              ))}
            </select>
          </div>
        </div>

        {filteredLogs.length === 0 ? (
          <p className="text-clinical-600">No symptom logs match your current filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-clinical-600 border-b border-clinical-200">
                  <th className="pb-2 pr-3">Date (UTC)</th>
                  <th className="pb-2 pr-3">Severity</th>
                  <th className="pb-2 pr-3">Symptom</th>
                  <th className="pb-2 pr-3">Triggers</th>
                  <th className="pb-2">OTC Treatments</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => (
                  <tr key={log.log_id} className="border-b border-clinical-100 align-top">
                    <td className="py-3 pr-3 text-clinical-700">{formatUtcTimestamp(log.created_at)}</td>
                    <td className="py-3 pr-3">
                      <span className="inline-flex px-2 py-1 bg-clinical-100 text-clinical-700 rounded text-xs font-medium">
                        {log.severity_scale}/10
                      </span>
                    </td>
                    <td className="py-3 pr-3 text-clinical-700">{log.symptom_description}</td>
                    <td className="py-3 pr-3 text-clinical-700">
                      {log.triggers.length ? log.triggers.map((trigger) => trigger.trigger_name).join(', ') : 'None'}
                    </td>
                    <td className="py-3 text-clinical-700">
                      {log.otc_treatments.length ? log.otc_treatments.join(', ') : 'None'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
