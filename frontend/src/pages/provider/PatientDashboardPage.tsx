import { FormEvent, useEffect, useMemo, useState } from 'react';
import { getApiClient } from '../../api/client';
import { ErrorAlert } from '../../components/Alerts';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { useAuth } from '../../context/AuthContext';
import { useSelectedPatient } from '../../context/SelectedPatientContext';
import { useFetch } from '../../hooks/useFetch';
import { useSyncAlertObservability } from '../../hooks/useSyncAlertObservability';
import {
  DashboardSnapshot,
  DashboardSyncStatus,
  HealthProfileUpdateRequest,
  MedicalHistoryUpdateRequest,
  MedicalRecordUploadRequest,
  PatientListItem,
  PatientListResponse,
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

function normalizePatients(payload: PatientListItem[] | PatientListResponse | null): PatientListItem[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  return payload.patients ?? [];
}

export function ProviderPatientDashboardPage() {
  const { user } = useAuth();
  const { selectedPatientId, setSelectedPatientId } = useSelectedPatient();
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
    data: patientsData,
    loading: patientsLoading,
    error: patientsError,
    refetch: refetchPatients
  } = useFetch<PatientListItem[] | PatientListResponse>('/v1/provider/patients');

  const patients = useMemo(() => normalizePatients(patientsData ?? null), [patientsData]);
  const [patientId, setPatientId] = useState(selectedPatientId ?? '');

  useEffect(() => {
    if (selectedPatientId && !patientId) {
      setPatientId(selectedPatientId);
      return;
    }

    if (!patientId && patients.length > 0) {
      const fallback = selectedPatientId ?? patients[0].patient_id;
      setPatientId(fallback);
      setSelectedPatientId(fallback);
    }
  }, [selectedPatientId, patientId, patients, setSelectedPatientId]);

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
    scope: 'provider-dashboard',
    syncError
  });

  useEffect(() => {
    if (!dashboard) return;
    setProfileHeight(dashboard.patient_profile.height === null ? '' : String(dashboard.patient_profile.height));
    setProfileWeight(dashboard.patient_profile.weight === null ? '' : String(dashboard.patient_profile.weight));
    setProfileFamilyHistory(dashboard.patient_profile.family_history ?? '');
    setProfileVaccination(dashboard.patient_profile.vaccination_record ?? '');
    if (!editingRecordId && dashboard.medical_history.length > 0) {
      setEditingRecordId(dashboard.medical_history[0].record_id);
    }
  }, [dashboard, editingRecordId]);

  if (patientsLoading || dashboardLoading || syncLoading) {
    return <LoadingSpinner message="Loading provider dashboard..." />;
  }

  const retryAll = async () => {
    await Promise.all([refetchPatients(), refetchDashboard(), refetchSync()]);
  };

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

  const onAssignSelf = async () => {
    if (!patientId) {
      setActionError('Select a patient first.');
      return;
    }

    await runAction(async () => {
      const apiClient = getApiClient();
      const providerId = user?.provider_id;
      if (providerId) {
        await apiClient.post(
          `/v1/provider/patients/${patientId}/assign-self?provider_id=${encodeURIComponent(providerId)}`
        );
      } else {
        await apiClient.post(`/v1/provider/patients/${patientId}/assign-self`);
      }
    }, 'You are now assigned to this patient.');
  };

  const onConnectSourceSystem = async (event: FormEvent) => {
    event.preventDefault();
    if (!patientId) {
      setActionError('Select a patient first.');
      return;
    }

    await runAction(async () => {
      const apiClient = getApiClient();
      const payload: SourceSystemConnectRequest = { system_name: connectSystem };
      await apiClient.post(`/v1/patients/${patientId}/source-systems/connect`, payload);
    }, `${connectSystem} connected for this patient.`);
  };

  const onUploadMedicalRecord = async (event: FormEvent) => {
    event.preventDefault();
    if (!patientId) {
      setActionError('Select a patient first.');
      return;
    }
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
      setActionError('Select a medical record first.');
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
    if (!patientId) {
      setActionError('Select a patient first.');
      return;
    }

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
    }, 'Patient health profile updated.');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-clinical-900">Patient Dashboard (Provider View)</h1>
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

      <section className="bg-white rounded-lg shadow p-6">
        <label htmlFor="provider-dashboard-patient" className="block text-sm font-medium text-clinical-700 mb-2">
          Selected patient
        </label>
        <select
          id="provider-dashboard-patient"
          value={patientId}
          onChange={(e) => {
            setPatientId(e.target.value);
            setSelectedPatientId(e.target.value || null);
          }}
          className="w-full md:max-w-lg border border-clinical-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-clinical-500"
        >
          <option value="">Select patient</option>
          {patients.map((patient) => (
            <option key={patient.patient_id} value={patient.patient_id}>
              {patient.patient_name} ({patient.patient_id})
            </option>
          ))}
        </select>
      </section>

      {(patientsError || dashboardError || syncError) && (
        <ErrorAlert
          message={
            patientsError?.message ??
            dashboardError?.message ??
            (syncError
              ? `Unable to load sync status. Incident: ${syncIncidentId ?? 'capturing'}`
              : 'Unable to load provider dashboard')
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

      {!patientId && (
        <section className="bg-white rounded-lg shadow p-6">
          <p className="text-clinical-600">Select a patient to view dashboard data.</p>
        </section>
      )}

      {patientId && dashboard && (
        <>
          <section className="grid gap-4 md:grid-cols-4">
            <div className="bg-white rounded-lg shadow p-5 border border-clinical-100">
              <p className="text-sm text-clinical-500">Connected Providers</p>
              <p className="text-3xl font-semibold text-clinical-900 mt-1">{dashboard.providers.length}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-5 border border-clinical-100">
              <p className="text-sm text-clinical-500">Medical Records</p>
              <p className="text-3xl font-semibold text-clinical-900 mt-1">{dashboard.medical_history.length}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-5 border border-clinical-100">
              <p className="text-sm text-clinical-500">Connected Source Systems</p>
              <p className="text-3xl font-semibold text-clinical-900 mt-1">{dashboard.source_systems.length}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-5 border border-clinical-100">
              <p className="text-sm text-clinical-500">Missing Data Prompts</p>
              <p className="text-3xl font-semibold text-health-warning mt-1">{dashboard.missing_data.length}</p>
            </div>
          </section>

          <section className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-clinical-900 mb-4">External Data Sources</h2>
            {dashboard.source_systems.length === 0 ? (
              <p className="text-clinical-600">No connected source systems yet.</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {dashboard.source_systems.map((source) => (
                  <div key={source.system_id} className="border border-clinical-200 rounded-lg p-4">
                    <p className="font-medium text-clinical-900">{source.system_name}</p>
                    <p className="text-sm text-clinical-600">Source ID: {source.system_id}</p>
                  </div>
                ))}
              </div>
            )}
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
            <h2 className="text-xl font-semibold text-clinical-900 mb-4">Missing Data Prompts</h2>
            {dashboard.missing_data.length === 0 ? (
              <p className="text-clinical-600">No missing-data prompts at the moment.</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {dashboard.missing_data.map((field) => (
                  <div
                    key={field.field_name}
                    className="rounded-lg border border-health-warning/30 bg-health-warning/10 p-4"
                  >
                    <p className="font-medium text-clinical-900">{field.field_name}</p>
                    <p className="text-sm text-clinical-700">{field.reason}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-clinical-900 mb-4">Patient Health Profile</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="border border-clinical-200 rounded-lg p-4">
                <p className="text-sm text-clinical-500">Height</p>
                <p className="font-medium text-clinical-900">{formatHeightFeetInches(dashboard.patient_profile.height)}</p>
                {dashboard.patient_profile.height !== null && (
                  <p className="text-xs text-clinical-500 mt-1">{dashboard.patient_profile.height} cm</p>
                )}
              </div>
              <div className="border border-clinical-200 rounded-lg p-4">
                <p className="text-sm text-clinical-500">Weight</p>
                <p className="font-medium text-clinical-900">{formatWeightPoundsOunces(dashboard.patient_profile.weight)}</p>
                {dashboard.patient_profile.weight !== null && (
                  <p className="text-xs text-clinical-500 mt-1">{dashboard.patient_profile.weight} kg</p>
                )}
              </div>
              <div className="border border-clinical-200 rounded-lg p-4">
                <p className="text-sm text-clinical-500">Vaccination Record</p>
                <p className="font-medium text-clinical-900">{dashboard.patient_profile.vaccination_record ?? 'Missing'}</p>
              </div>
              <div className="border border-clinical-200 rounded-lg p-4">
                <p className="text-sm text-clinical-500">Family History</p>
                <p className="font-medium text-clinical-900">{dashboard.patient_profile.family_history ?? 'Missing'}</p>
              </div>
            </div>
          </section>

          <section className="bg-white rounded-lg shadow p-6 space-y-6">
            <h2 className="text-xl font-semibold text-clinical-900">Provider Actions</h2>

            <div className="border border-clinical-200 rounded-lg p-4">
              <h3 className="text-lg font-medium text-clinical-900">Assign Yourself to Patient</h3>
              <p className="text-sm text-clinical-600 mt-1 mb-3">
                Add yourself to this patient care team for ongoing coordination.
              </p>
              <button
                type="button"
                onClick={() => { void onAssignSelf(); }}
                disabled={actionLoading || !patientId}
                className="px-4 py-2 text-sm bg-clinical-700 text-white rounded hover:bg-clinical-800 disabled:opacity-60"
              >
                Assign Self
              </button>
            </div>

            <form onSubmit={(event) => { void onEditHealthProfile(event); }} className="space-y-3 border border-clinical-200 rounded-lg p-4">
              <h3 className="text-lg font-medium text-clinical-900">Edit Patient Health Profile</h3>
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
                disabled={actionLoading || !patientId}
                className="px-4 py-2 text-sm bg-clinical-700 text-white rounded hover:bg-clinical-800 disabled:opacity-60"
              >
                Save Patient Profile
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
                disabled={actionLoading || !patientId}
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
                disabled={actionLoading || !patientId}
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
                  {dashboard.medical_history.map((record) => (
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
                disabled={actionLoading || !patientId}
                className="px-4 py-2 text-sm bg-clinical-700 text-white rounded hover:bg-clinical-800 disabled:opacity-60"
              >
                Save Medical History
              </button>
            </form>
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
        </>
      )}
    </div>
  );
}
