import { ErrorAlert } from '../../components/Alerts';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { useAuth } from '../../context/AuthContext';
import { useFetch } from '../../hooks/useFetch';
import { DashboardSnapshot, DashboardSyncStatus } from '../../types/api';
import { formatUtcTimestamp, getRelativeTime, isStale } from '../../utils/date';

export function PatientDashboardPage() {
  const { user } = useAuth();
  const patientId = user?.patient_id;

  const {
    data: dashboard,
    loading: dashboardLoading,
    error: dashboardError,
    refetch: refetchDashboard
  } = useFetch<DashboardSnapshot>(`/v1/dashboard/patients/${patientId}`, {
    skip: !patientId
  });

  const {
    data: syncStatus,
    loading: syncLoading,
    error: syncError,
    refetch: refetchSync
  } = useFetch<DashboardSyncStatus>(`/v1/dashboard/patients/${patientId}/sync-status`, {
    skip: !patientId
  });

  if (!patientId) {
    return <ErrorAlert message="No patient profile is linked to your account." />;
  }

  if (dashboardLoading || syncLoading) {
    return <LoadingSpinner message="Loading your dashboard..." />;
  }

  const retryAll = async () => {
    await Promise.all([refetchDashboard(), refetchSync()]);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-clinical-900">My Health Dashboard</h1>
        <button
          type="button"
          onClick={() => {
            void retryAll();
          }}
          className="px-4 py-2 text-sm bg-clinical-600 text-white rounded-lg hover:bg-clinical-700 transition"
        >
          Refresh
        </button>
      </div>

      {(dashboardError || syncError) && (
        <ErrorAlert
          message={dashboardError?.message ?? syncError?.message ?? 'Unable to load dashboard data'}
        />
      )}

      {dashboard && (
        <>
          <section className="grid gap-4 md:grid-cols-3">
            <div className="bg-white rounded-lg shadow p-5 border border-clinical-100">
              <p className="text-sm text-clinical-500">Connected Providers</p>
              <p className="text-3xl font-semibold text-clinical-900 mt-1">
                {dashboard.providers.length}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-5 border border-clinical-100">
              <p className="text-sm text-clinical-500">Medical Records</p>
              <p className="text-3xl font-semibold text-clinical-900 mt-1">
                {dashboard.medical_history.length}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-5 border border-clinical-100">
              <p className="text-sm text-clinical-500">Missing Data Prompts</p>
              <p className="text-3xl font-semibold text-health-warning mt-1">
                {dashboard.missing_data.length}
              </p>
            </div>
          </section>

          <section className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-clinical-900 mb-4">Provider Team</h2>
            {dashboard.providers.length === 0 ? (
              <p className="text-clinical-600">No providers found yet.</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {dashboard.providers.map((provider) => (
                  <div key={provider.provider_id} className="border border-clinical-200 rounded-lg p-4">
                    <p className="font-medium text-clinical-900">{provider.provider_name}</p>
                    <p className="text-sm text-clinical-600">{provider.specialty}</p>
                    <p className="text-sm text-clinical-500">{provider.clinic_affiliation}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-clinical-900 mb-4">Recent Medical History</h2>
            {dashboard.medical_history.length === 0 ? (
              <p className="text-clinical-600">No medical records available.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-clinical-600 border-b border-clinical-200">
                      <th className="pb-2 pr-3">Category</th>
                      <th className="pb-2 pr-3">Description</th>
                      <th className="pb-2 pr-3">Source</th>
                      <th className="pb-2">Recorded (UTC)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.medical_history.map((record) => (
                      <tr key={record.record_id} className="border-b border-clinical-100 align-top">
                        <td className="py-2 pr-3 font-medium text-clinical-900">{record.category}</td>
                        <td className="py-2 pr-3 text-clinical-700">{record.value_description}</td>
                        <td className="py-2 pr-3 text-clinical-600">{record.system_name}</td>
                        <td className="py-2 text-clinical-600">{formatUtcTimestamp(record.recorded_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-clinical-900 mb-4">Data Sync Freshness</h2>
            {syncStatus?.sync_status.length ? (
              <ul className="space-y-3">
                {syncStatus.sync_status.map((entry) => {
                  const stale = isStale(entry.last_synced_at, 24);
                  return (
                    <li
                      key={`${entry.system_id}-${entry.category}`}
                      className="flex flex-col md:flex-row md:items-center md:justify-between border border-clinical-200 rounded-lg p-4"
                    >
                      <div>
                        <p className="font-medium text-clinical-900">
                          {entry.system_name} - {entry.category}
                        </p>
                        <p className="text-sm text-clinical-600">
                          {formatUtcTimestamp(entry.last_synced_at)} ({getRelativeTime(entry.last_synced_at)})
                        </p>
                      </div>
                      <span
                        className={`mt-2 md:mt-0 inline-flex px-2 py-1 text-xs rounded font-medium ${
                          stale
                            ? 'bg-health-warning text-white'
                            : 'bg-health-success text-white'
                        }`}
                      >
                        {stale ? 'Stale' : 'Fresh'}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-clinical-600">No sync status entries found.</p>
            )}
          </section>

          {dashboard.missing_data.length > 0 && (
            <section className="bg-health-warning/10 border border-health-warning rounded-lg p-6">
              <h2 className="text-xl font-semibold text-clinical-900 mb-4">Missing Data Prompts</h2>
              <ul className="space-y-2">
                {dashboard.missing_data.map((item) => (
                  <li key={`${item.field_name}-${item.reason}`} className="text-clinical-700">
                    <span className="font-medium">{item.field_name}:</span> {item.reason}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
