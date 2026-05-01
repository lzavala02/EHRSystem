import { useMemo, useState } from 'react';
import { ErrorAlert } from '../../components/Alerts';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { useSelectedPatient } from '../../context/SelectedPatientContext';
import { useFetch } from '../../hooks/useFetch';
import { PatientListItem, PatientListResponse } from '../../types/api';
import { formatUtcTimestamp } from '../../utils/date';

function normalizePatients(payload: PatientListItem[] | PatientListResponse | null): PatientListItem[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  return payload.patients ?? [];
}

export function PatientListPage() {
  const [search, setSearch] = useState('');
  const { selectedPatientId, setSelectedPatientId } = useSelectedPatient();

  const {
    data,
    loading,
    error,
    refetch
  } = useFetch<PatientListItem[] | PatientListResponse>('/v1/provider/patients');

  const patients = useMemo(() => normalizePatients(data ?? null), [data]);

  const filteredPatients = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return patients;
    return patients.filter((patient) => {
      return (
        patient.patient_name.toLowerCase().includes(query) ||
        patient.patient_id.toLowerCase().includes(query) ||
        patient.primary_condition.toLowerCase().includes(query)
      );
    });
  }, [patients, search]);

  if (loading) {
    return <LoadingSpinner message="Loading patient list..." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-clinical-900">My Patients</h1>
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
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, condition, or patient ID"
            className="w-full md:max-w-md border border-clinical-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-clinical-500"
          />
          <p className="text-sm text-clinical-600">
            Showing {filteredPatients.length} of {patients.length} patients
          </p>
        </div>

        {filteredPatients.length === 0 ? (
          <p className="text-clinical-600">No patients match your search.</p>
        ) : (
          <ul className="space-y-3">
            {filteredPatients.map((patient) => {
              const isSelected = selectedPatientId === patient.patient_id;
              return (
                <li
                  key={patient.patient_id}
                  className={`border rounded-lg p-4 transition ${
                    isSelected
                      ? 'border-health-info bg-health-info/10'
                      : 'border-clinical-200'
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                    <div>
                      <p className="font-semibold text-clinical-900">{patient.patient_name}</p>
                      <p className="text-sm text-clinical-600">{patient.patient_id}</p>
                      <p className="text-sm text-clinical-700">Primary condition: {patient.primary_condition}</p>
                      <p className="text-xs text-clinical-500 mt-1">
                        Last visit (UTC): {formatUtcTimestamp(patient.last_visit)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedPatientId(patient.patient_id)}
                      className={`px-3 py-1.5 text-sm rounded ${
                        isSelected
                          ? 'bg-health-info text-white'
                          : 'bg-clinical-100 text-clinical-700 hover:bg-clinical-200'
                      }`}
                    >
                      {isSelected ? 'Selected' : 'Select for Workflow'}
                    </button>
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
