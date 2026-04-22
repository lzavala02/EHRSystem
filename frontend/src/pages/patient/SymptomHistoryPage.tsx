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

function getSeverityBand(severity: number): 'mild' | 'moderate' | 'severe' {
  if (severity <= 3) return 'mild';
  if (severity <= 7) return 'moderate';
  return 'severe';
}

export function SymptomHistoryPage() {
  const { user } = useAuth();
  const patientId = user?.patient_id;

  const [searchText, setSearchText] = useState('');
  const [minimumSeverity, setMinimumSeverity] = useState<number>(1);
  const [selectedTrigger, setSelectedTrigger] = useState('all');
  const [severityBand, setSeverityBand] = useState<'all' | 'mild' | 'moderate' | 'severe'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'highest' | 'lowest'>('newest');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

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

  const availableTriggers = useMemo(() => {
    const triggerSet = new Set<string>();
    for (const log of logs) {
      for (const trigger of log.triggers) {
        triggerSet.add(trigger.trigger_name);
      }
    }
    return [...triggerSet].sort((a, b) => a.localeCompare(b));
  }, [logs]);

  const filteredLogs = useMemo(() => {
    const normalizedSearch = searchText.trim().toLowerCase();
    const fromDate = dateFrom ? new Date(`${dateFrom}T00:00:00.000Z`) : null;
    const toDate = dateTo ? new Date(`${dateTo}T23:59:59.999Z`) : null;

    return [...logs]
      .filter((log) => log.severity_scale >= minimumSeverity)
      .filter((log) => {
        if (severityBand === 'all') return true;
        return getSeverityBand(log.severity_scale) === severityBand;
      })
      .filter((log) => {
        if (selectedTrigger === 'all') return true;
        return log.triggers.some((trigger) => trigger.trigger_name === selectedTrigger);
      })
      .filter((log) => {
        const createdAt = new Date(log.created_at);
        if (fromDate && createdAt < fromDate) return false;
        if (toDate && createdAt > toDate) return false;
        return true;
      })
      .filter((log) => {
        if (!normalizedSearch) return true;
        return (
          log.symptom_description.toLowerCase().includes(normalizedSearch) ||
          log.triggers.some((trigger) => trigger.trigger_name.toLowerCase().includes(normalizedSearch)) ||
          log.otc_treatments.some((treatment) => treatment.toLowerCase().includes(normalizedSearch))
        );
      })
      .sort((a, b) => {
        if (sortBy === 'oldest') {
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        }
        if (sortBy === 'highest') {
          return b.severity_scale - a.severity_scale;
        }
        if (sortBy === 'lowest') {
          return a.severity_scale - b.severity_scale;
        }
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [logs, minimumSeverity, searchText, selectedTrigger, severityBand, sortBy, dateFrom, dateTo]);

  const summary = useMemo(() => {
    const total = filteredLogs.length;
    const severeCount = filteredLogs.filter((log) => log.severity_scale >= 8).length;
    const averageSeverity =
      total === 0
        ? null
        : filteredLogs.reduce((sum, log) => sum + log.severity_scale, 0) / total;

    return {
      total,
      severeCount,
      averageSeverity: averageSeverity !== null ? averageSeverity.toFixed(1) : 'N/A'
    };
  }, [filteredLogs]);

  const clearFilters = () => {
    setSearchText('');
    setMinimumSeverity(1);
    setSelectedTrigger('all');
    setSeverityBand('all');
    setSortBy('newest');
    setDateFrom('');
    setDateTo('');
  };

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
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-clinical-200 bg-clinical-50 p-3">
            <p className="text-xs text-clinical-600">Logs Shown</p>
            <p className="text-2xl font-semibold text-clinical-900">{summary.total}</p>
          </div>
          <div className="rounded-lg border border-clinical-200 bg-clinical-50 p-3">
            <p className="text-xs text-clinical-600">Average Severity</p>
            <p className="text-2xl font-semibold text-clinical-900">{summary.averageSeverity}</p>
          </div>
          <div className="rounded-lg border border-clinical-200 bg-clinical-50 p-3">
            <p className="text-xs text-clinical-600">Severe Logs (8-10)</p>
            <p className="text-2xl font-semibold text-clinical-900">{summary.severeCount}</p>
          </div>
        </div>

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

        <div className="grid gap-4 md:grid-cols-4">
          <div>
            <label htmlFor="severity-band" className="block text-sm font-medium text-clinical-700 mb-1">
              Severity Band
            </label>
            <select
              id="severity-band"
              value={severityBand}
              onChange={(e) => setSeverityBand(e.target.value as 'all' | 'mild' | 'moderate' | 'severe')}
              className="w-full border border-clinical-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-clinical-500"
            >
              <option value="all">All</option>
              <option value="mild">Mild (1-3)</option>
              <option value="moderate">Moderate (4-7)</option>
              <option value="severe">Severe (8-10)</option>
            </select>
          </div>

          <div>
            <label htmlFor="trigger-filter" className="block text-sm font-medium text-clinical-700 mb-1">
              Trigger
            </label>
            <select
              id="trigger-filter"
              value={selectedTrigger}
              onChange={(e) => setSelectedTrigger(e.target.value)}
              className="w-full border border-clinical-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-clinical-500"
            >
              <option value="all">All Triggers</option>
              {availableTriggers.map((triggerName) => (
                <option key={triggerName} value={triggerName}>
                  {triggerName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="date-from" className="block text-sm font-medium text-clinical-700 mb-1">
              Date From
            </label>
            <input
              id="date-from"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full border border-clinical-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-clinical-500"
            />
          </div>

          <div>
            <label htmlFor="date-to" className="block text-sm font-medium text-clinical-700 mb-1">
              Date To
            </label>
            <input
              id="date-to"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full border border-clinical-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-clinical-500"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <label htmlFor="sort-by" className="block text-sm font-medium text-clinical-700 mb-1">
              Sort
            </label>
            <select
              id="sort-by"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'newest' | 'oldest' | 'highest' | 'lowest')}
              className="w-full min-w-52 border border-clinical-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-clinical-500"
            >
              <option value="newest">Date: Newest First</option>
              <option value="oldest">Date: Oldest First</option>
              <option value="highest">Severity: Highest First</option>
              <option value="lowest">Severity: Lowest First</option>
            </select>
          </div>

          <button
            type="button"
            onClick={clearFilters}
            className="px-4 py-2 text-sm bg-clinical-100 text-clinical-700 rounded-lg hover:bg-clinical-200 transition"
          >
            Clear Filters
          </button>
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
