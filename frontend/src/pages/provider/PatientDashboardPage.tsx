import { useEffect, useMemo, useState } from 'react';
import { ErrorAlert } from '../../components/Alerts';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { useSelectedPatient } from '../../context/SelectedPatientContext';
import { useFetch } from '../../hooks/useFetch';
import { useSyncAlertObservability } from '../../hooks/useSyncAlertObservability';
import {
  DashboardSnapshot,
  DashboardSyncStatus,
  PatientListItem,
  PatientListResponse
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
  const { selectedPatientId, setSelectedPatientId } = useSelectedPatient();

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

  if (patientsLoading || dashboardLoading || syncLoading) {
    return <LoadingSpinner message="Loading provider dashboard..." />;
  }

  const retryAll = async () => {
    await Promise.all([refetchPatients(), refetchDashboard(), refetchSync()]);
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
