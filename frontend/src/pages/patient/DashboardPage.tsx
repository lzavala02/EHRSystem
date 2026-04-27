import { FormEvent, useEffect, useState } from 'react';
import { ErrorAlert } from '../../components/Alerts';
import { getApiClient } from '../../api/client';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { useAuth } from '../../context/AuthContext';
import { useFetch } from '../../hooks/useFetch';
import { useSyncAlertObservability } from '../../hooks/useSyncAlertObservability';
import {
  DashboardSnapshot,
  DashboardSyncStatus,
  HealthProfileUpdateRequest,
  MedicalHistoryUpdateRequest,
  MedicalRecordUploadRequest,
  ProviderListUpdateRequest,
  SourceSystemConnectRequest
} from '../../types/api';
import { formatUtcTimestamp, getRelativeTime, isStale } from '../../utils/date';

function formatHeightFeetInches(heightCm: number | null): string {
  if (heightCm === null) {
    return 'Missing';
  }

  const totalInches = heightCm / 2.54;
  let feet = Math.floor(totalInches / 12);
  let inches = Math.round(totalInches - feet * 12);

  if (inches === 12) {
    feet += 1;
    inches = 0;
  }

  return `${feet} ft ${inches} in`;
}

function formatWeightPoundsOunces(weightKg: number | null): string {
  if (weightKg === null) {
    return 'Missing';
  }

  const totalPounds = weightKg * 2.2046226218;
  let pounds = Math.floor(totalPounds);
  let ounces = Math.round((totalPounds - pounds) * 16);

  if (ounces === 16) {
    pounds += 1;
    ounces = 0;
  }

  return `${pounds} lb ${ounces} oz`;
}

export function PatientDashboardPage() {
  const { user } = useAuth();
  const patientId = user?.patient_id;
  const isPatientReadOnly = user?.role === 'Patient';
  const [providerIdsInput, setProviderIdsInput] = useState('');
  const [connectSystem, setConnectSystem] = useState<'Epic' | 'NextGen'>('Epic');
  const [uploadCategory, setUploadCategory] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadSourceSystem, setUploadSourceSystem] = useState<'Epic' | 'NextGen' | 'Internal'>('Internal');
  const [editingRecordId, setEditingRecordId] = useState('');
  const [editRecordCategory, setEditRecordCategory] = useState('');
  const [editRecordDescription, setEditRecordDescription] = useState('');
  const [profileHeight, setProfileHeight] = useState('');
  const [profileWeight, setProfileWeight] = useState('');
  const [profileFamilyHistory, setProfileFamilyHistory] = useState('');
  const [profileVaccination, setProfileVaccination] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

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

  const { syncIncidentId } = useSyncAlertObservability({
    scope: 'patient-dashboard',
    syncError
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

  const providers = dashboard?.providers ?? [];
  const medicalHistory = dashboard?.medical_history ?? [];
  const sourceSystems = dashboard?.source_systems ?? [];
  const missingData = dashboard?.missing_data ?? [];
  const patientProfile = dashboard?.patient_profile ?? {
    height: null,
    weight: null,
    vaccination_record: null,
    family_history: null
  };
  const syncEntries = syncStatus?.sync_status ?? [];

  useEffect(() => {
    if (!dashboard) return;
    setProviderIdsInput(dashboard.providers.map(provider => provider.provider_id).join(', '));
    setProfileHeight(dashboard.patient_profile.height === null ? '' : String(dashboard.patient_profile.height));
    setProfileWeight(dashboard.patient_profile.weight === null ? '' : String(dashboard.patient_profile.weight));
    setProfileFamilyHistory(dashboard.patient_profile.family_history ?? '');
    setProfileVaccination(dashboard.patient_profile.vaccination_record ?? '');
    if (!editingRecordId && dashboard.medical_history.length > 0) {
      setEditingRecordId(dashboard.medical_history[0].record_id);
    }
  }, [dashboard, editingRecordId]);

  const runAction = async (action: () => Promise<void>, successMessage: string) => {
    setActionLoading(true);
    setActionError(null);
    setActionMessage(null);
    try {
      await action();
      await retryAll();
      setActionMessage(successMessage);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Request failed');
    } finally {
      setActionLoading(false);
    }
  };

  const onUpdateProviderList = async (event: FormEvent) => {
    event.preventDefault();
    if (!patientId) return;

    const providerIds = providerIdsInput
      .split(',')
      .map(value => value.trim())
      .filter(Boolean);

    if (providerIds.length === 0) {
      setActionError('Enter at least one provider ID.');
      return;
    }

    await runAction(async () => {
      const apiClient = getApiClient();
      const payload: ProviderListUpdateRequest = { provider_ids: providerIds };
      await apiClient.put(`/v1/patients/${patientId}/providers`, payload);
    }, 'Provider list updated.');
  };

  const onConnectSourceSystem = async (event: FormEvent) => {
    event.preventDefault();
    if (!patientId) return;

    await runAction(async () => {
      const apiClient = getApiClient();
      const payload: SourceSystemConnectRequest = { system_name: connectSystem };
      await apiClient.post(`/v1/patients/${patientId}/source-systems/connect`, payload);
    }, `${connectSystem} connection saved.`);
  };

  const onUploadMedicalRecord = async (event: FormEvent) => {
    event.preventDefault();
    if (!patientId) return;
    if (!uploadCategory.trim() || !uploadDescription.trim()) {
      setActionError('Category and description are required for upload.');
      return;
    }

    await runAction(async () => {
      const apiClient = getApiClient();
      const payload: MedicalRecordUploadRequest = {
        category: uploadCategory.trim(),
        value_description: uploadDescription.trim(),
        source_system: uploadSourceSystem
      };
      await apiClient.post(`/v1/patients/${patientId}/medical-records/upload`, payload);
      setUploadCategory('');
      setUploadDescription('');
      setUploadSourceSystem('Internal');
    }, 'Medical record uploaded.');
  };

  const onEditMedicalHistory = async (event: FormEvent) => {
    event.preventDefault();
    if (!patientId || !editingRecordId) {
      setActionError('Select a medical record to edit.');
      return;
    }
    if (!editRecordCategory.trim() && !editRecordDescription.trim()) {
      setActionError('Enter at least one medical history field to update.');
      return;
    }

    await runAction(async () => {
      const apiClient = getApiClient();
      const payload: MedicalHistoryUpdateRequest = {};
      if (editRecordCategory.trim()) payload.category = editRecordCategory.trim();
      if (editRecordDescription.trim()) payload.value_description = editRecordDescription.trim();
      await apiClient.patch(`/v1/patients/${patientId}/medical-history/${editingRecordId}`, payload);
      setEditRecordCategory('');
      setEditRecordDescription('');
    }, 'Medical history updated.');
  };

  const onEditHealthProfile = async (event: FormEvent) => {
    event.preventDefault();
    if (!patientId) return;

    const payload: HealthProfileUpdateRequest = {};
    if (profileHeight.trim()) payload.height = Number(profileHeight);
    if (profileWeight.trim()) payload.weight = Number(profileWeight);
    if (profileFamilyHistory.trim()) payload.family_history = profileFamilyHistory.trim();
    if (profileVaccination.trim()) payload.vaccination_record = profileVaccination.trim();

    if (Object.keys(payload).length === 0) {
      setActionError('Enter at least one profile field to update.');
      return;
    }

    await runAction(async () => {
      const apiClient = getApiClient();
      await apiClient.patch(`/v1/patients/${patientId}/health-profile`, payload);
    }, 'Health profile updated.');
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

      {isPatientReadOnly && (
        <section className="rounded-lg border border-clinical-200 bg-clinical-50 p-4">
          <p className="text-sm font-semibold text-clinical-900">Patient read-only view</p>
          <p className="mt-1 text-sm text-clinical-700">
            Provider-only actions are hidden here. You can review consolidated history, source systems, and sync status,
            but editing workflows stay on the provider side.
          </p>
        </section>
      )}

      {(dashboardError || syncError) && (
        <ErrorAlert
          message={
            dashboardError?.message ??
            (syncError
              ? `Unable to load sync status. Incident: ${syncIncidentId ?? 'capturing'}`
              : 'Unable to load dashboard data')
          }
        />
      )}

      {(actionError || actionMessage) && (
        <section className="space-y-2">
          {actionError && <ErrorAlert message={actionError} />}
          {actionMessage && (
            <div className="rounded-lg border border-health-success bg-health-success/10 p-3 text-sm text-clinical-900">
              {actionMessage}
            </div>
          )}
        </section>
      )}

      {dashboard && (
        <>
          <section className="grid gap-4 md:grid-cols-3">
            <div className="bg-white rounded-lg shadow p-5 border border-clinical-100">
              <p className="text-sm text-clinical-500">Connected Providers</p>
              <p className="text-3xl font-semibold text-clinical-900 mt-1">
                {providers.length}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-5 border border-clinical-100">
              <p className="text-sm text-clinical-500">Medical Records</p>
              <p className="text-3xl font-semibold text-clinical-900 mt-1">
                {medicalHistory.length}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-5 border border-clinical-100">
              <p className="text-sm text-clinical-500">Connected Source Systems</p>
              <p className="text-3xl font-semibold text-clinical-900 mt-1">
                {sourceSystems.length}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-5 border border-clinical-100">
              <p className="text-sm text-clinical-500">Missing Data Prompts</p>
              <p className="text-3xl font-semibold text-health-warning mt-1">
                {missingData.length}
              </p>
            </div>
          </section>

          <section className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-clinical-900 mb-4">Patient Health Profile</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="border border-clinical-200 rounded-lg p-4">
                <p className="text-sm text-clinical-500">Height</p>
                <p className="font-medium text-clinical-900">
                  {formatHeightFeetInches(patientProfile.height)}
                </p>
                {patientProfile.height !== null && (
                  <p className="text-xs text-clinical-500 mt-1">
                    {patientProfile.height} cm
                  </p>
                )}
              </div>
              <div className="border border-clinical-200 rounded-lg p-4">
                <p className="text-sm text-clinical-500">Weight</p>
                <p className="font-medium text-clinical-900">
                  {formatWeightPoundsOunces(patientProfile.weight)}
                </p>
                {patientProfile.weight !== null && (
                  <p className="text-xs text-clinical-500 mt-1">
                    {patientProfile.weight} kg
                  </p>
                )}
              </div>
              <div className="border border-clinical-200 rounded-lg p-4">
                <p className="text-sm text-clinical-500">Vaccination Record</p>
                <p className="font-medium text-clinical-900">
                  {patientProfile.vaccination_record ?? 'Missing'}
                </p>
              </div>
              <div className="border border-clinical-200 rounded-lg p-4">
                <p className="text-sm text-clinical-500">Family History</p>
                <p className="font-medium text-clinical-900">
                  {patientProfile.family_history ?? 'Missing'}
                </p>
              </div>
            </div>
          </section>

          <section className="bg-white rounded-lg shadow p-6 space-y-6">
            <h2 className="text-xl font-semibold text-clinical-900">Manage Your Health Data</h2>

            <form onSubmit={(event) => { void onEditHealthProfile(event); }} className="space-y-3 border border-clinical-200 rounded-lg p-4">
              <h3 className="text-lg font-medium text-clinical-900">Edit Health Profile</h3>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-sm text-clinical-700">
                  Height (cm)
                  <input
                    type="number"
                    step="0.1"
                    value={profileHeight}
                    onChange={(event) => setProfileHeight(event.target.value)}
                    className="mt-1 w-full border border-clinical-300 rounded px-3 py-2"
                  />
                </label>
                <label className="text-sm text-clinical-700">
                  Weight (kg)
                  <input
                    type="number"
                    step="0.1"
                    value={profileWeight}
                    onChange={(event) => setProfileWeight(event.target.value)}
                    className="mt-1 w-full border border-clinical-300 rounded px-3 py-2"
                  />
                </label>
                <label className="text-sm text-clinical-700">
                  Family history
                  <input
                    type="text"
                    value={profileFamilyHistory}
                    onChange={(event) => setProfileFamilyHistory(event.target.value)}
                    className="mt-1 w-full border border-clinical-300 rounded px-3 py-2"
                  />
                </label>
                <label className="text-sm text-clinical-700">
                  Vaccination record
                  <input
                    type="text"
                    value={profileVaccination}
                    onChange={(event) => setProfileVaccination(event.target.value)}
                    className="mt-1 w-full border border-clinical-300 rounded px-3 py-2"
                  />
                </label>
              </div>
              <button
                type="submit"
                disabled={actionLoading}
                className="px-4 py-2 text-sm bg-clinical-700 text-white rounded hover:bg-clinical-800 disabled:opacity-60"
              >
                Save Health Profile
              </button>
            </form>

            <form onSubmit={(event) => { void onUpdateProviderList(event); }} className="space-y-3 border border-clinical-200 rounded-lg p-4">
              <h3 className="text-lg font-medium text-clinical-900">Edit Provider List</h3>
              <label className="block text-sm text-clinical-700">
                Provider IDs (comma separated)
                <input
                  type="text"
                  value={providerIdsInput}
                  onChange={(event) => setProviderIdsInput(event.target.value)}
                  className="mt-1 w-full border border-clinical-300 rounded px-3 py-2"
                />
              </label>
              <button
                type="submit"
                disabled={actionLoading}
                className="px-4 py-2 text-sm bg-clinical-700 text-white rounded hover:bg-clinical-800 disabled:opacity-60"
              >
                Save Provider List
              </button>
            </form>

            <form onSubmit={(event) => { void onConnectSourceSystem(event); }} className="space-y-3 border border-clinical-200 rounded-lg p-4">
              <h3 className="text-lg font-medium text-clinical-900">Connect Source System</h3>
              <label className="block text-sm text-clinical-700">
                Source system
                <select
                  value={connectSystem}
                  onChange={(event) => setConnectSystem(event.target.value as 'Epic' | 'NextGen')}
                  className="mt-1 w-full border border-clinical-300 rounded px-3 py-2"
                >
                  <option value="Epic">Epic</option>
                  <option value="NextGen">NextGen</option>
                </select>
              </label>
              <button
                type="submit"
                disabled={actionLoading}
                className="px-4 py-2 text-sm bg-clinical-700 text-white rounded hover:bg-clinical-800 disabled:opacity-60"
              >
                Connect Source
              </button>
            </form>

            <form onSubmit={(event) => { void onUploadMedicalRecord(event); }} className="space-y-3 border border-clinical-200 rounded-lg p-4">
              <h3 className="text-lg font-medium text-clinical-900">Upload Medical Record</h3>
              <div className="grid gap-3 md:grid-cols-3">
                <label className="text-sm text-clinical-700">
                  Category
                  <input
                    type="text"
                    value={uploadCategory}
                    onChange={(event) => setUploadCategory(event.target.value)}
                    className="mt-1 w-full border border-clinical-300 rounded px-3 py-2"
                  />
                </label>
                <label className="text-sm text-clinical-700 md:col-span-2">
                  Description
                  <input
                    type="text"
                    value={uploadDescription}
                    onChange={(event) => setUploadDescription(event.target.value)}
                    className="mt-1 w-full border border-clinical-300 rounded px-3 py-2"
                  />
                </label>
              </div>
              <label className="block text-sm text-clinical-700">
                Source
                <select
                  value={uploadSourceSystem}
                  onChange={(event) => setUploadSourceSystem(event.target.value as 'Epic' | 'NextGen' | 'Internal')}
                  className="mt-1 w-full border border-clinical-300 rounded px-3 py-2"
                >
                  <option value="Internal">Internal</option>
                  <option value="Epic">Epic</option>
                  <option value="NextGen">NextGen</option>
                </select>
              </label>
              <button
                type="submit"
                disabled={actionLoading}
                className="px-4 py-2 text-sm bg-clinical-700 text-white rounded hover:bg-clinical-800 disabled:opacity-60"
              >
                Upload Record
              </button>
            </form>

            <form onSubmit={(event) => { void onEditMedicalHistory(event); }} className="space-y-3 border border-clinical-200 rounded-lg p-4">
              <h3 className="text-lg font-medium text-clinical-900">Edit Medical History</h3>
              <label className="block text-sm text-clinical-700">
                Record
                <select
                  value={editingRecordId}
                  onChange={(event) => setEditingRecordId(event.target.value)}
                  className="mt-1 w-full border border-clinical-300 rounded px-3 py-2"
                >
                  <option value="">Select record</option>
                  {medicalHistory.map((record) => (
                    <option key={record.record_id} value={record.record_id}>
                      {record.category} ({record.system_name})
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-sm text-clinical-700">
                  New category (optional)
                  <input
                    type="text"
                    value={editRecordCategory}
                    onChange={(event) => setEditRecordCategory(event.target.value)}
                    className="mt-1 w-full border border-clinical-300 rounded px-3 py-2"
                  />
                </label>
                <label className="text-sm text-clinical-700">
                  New description (optional)
                  <input
                    type="text"
                    value={editRecordDescription}
                    onChange={(event) => setEditRecordDescription(event.target.value)}
                    className="mt-1 w-full border border-clinical-300 rounded px-3 py-2"
                  />
                </label>
              </div>
              <button
                type="submit"
                disabled={actionLoading}
                className="px-4 py-2 text-sm bg-clinical-700 text-white rounded hover:bg-clinical-800 disabled:opacity-60"
              >
                Save Medical History
              </button>
            </form>
          </section>

          <section className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-clinical-900 mb-4">External Data Sources</h2>
            {sourceSystems.length === 0 ? (
              <p className="text-clinical-600">No connected source systems yet.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {sourceSystems.map((source) => (
                  <span
                    key={source.system_id}
                    className="inline-flex px-3 py-1 text-sm rounded-full bg-clinical-100 text-clinical-800"
                  >
                    {source.system_name}
                  </span>
                ))}
              </div>
            )}
          </section>

          <section className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-clinical-900 mb-4">Provider Team</h2>
            {providers.length === 0 ? (
              <p className="text-clinical-600">No providers found yet.</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {providers.map((provider) => (
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
            {medicalHistory.length === 0 ? (
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
                    {medicalHistory.map((record) => (
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
            {syncEntries.length ? (
              <ul className="space-y-3">
                {syncEntries.map((entry) => {
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

          {missingData.length > 0 && (
            <section className="bg-health-warning/10 border border-health-warning rounded-lg p-6">
              <h2 className="text-xl font-semibold text-clinical-900 mb-4">Missing Data Prompts</h2>
              <ul className="space-y-2">
                {missingData.map((item) => (
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
