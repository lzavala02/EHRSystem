import { FormEvent, useMemo, useState } from 'react';
import { getApiClient } from '../../api/client';
import { ErrorAlert, SuccessAlert } from '../../components/Alerts';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { useAuth } from '../../context/AuthContext';
import { useFetch } from '../../hooks/useFetch';
import { TriggerChecklist } from '../../types/api';
import {
  validateOTCTreatment,
  validatePsoriasisLanguage,
  validateSelectedTrigger,
  validateSeverity,
  validateSymptomDescription
} from '../../utils/validation';

interface TriggerEnvelope {
  triggers: TriggerChecklist[];
}

function normalizeTriggers(payload: TriggerChecklist[] | TriggerEnvelope | null): TriggerChecklist[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  return payload.triggers ?? [];
}

export function SymptomLogPage() {
  const { user } = useAuth();
  const patientId = user?.patient_id;

  const {
    data,
    loading,
    error,
    refetch
  } = useFetch<TriggerChecklist[] | TriggerEnvelope>('/v1/symptoms/triggers');

  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<number>(5);
  const [selectedTriggerIds, setSelectedTriggerIds] = useState<string[]>([]);
  const [otcTreatmentsInput, setOtcTreatmentsInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const triggerChecklist = useMemo(() => normalizeTriggers(data ?? null), [data]);

  const toggleTrigger = (triggerId: string) => {
    setSelectedTriggerIds((current) =>
      current.includes(triggerId)
        ? current.filter((id) => id !== triggerId)
        : [...current, triggerId]
    );
  };

  const resetForm = () => {
    setDescription('');
    setSeverity(5);
    setSelectedTriggerIds([]);
    setOtcTreatmentsInput('');
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setSuccessMessage(null);

    if (!patientId) {
      setFormError('No patient profile is linked to your account.');
      return;
    }

    const normalizedDescription = description.trim();
    const descriptionError = validateSymptomDescription(normalizedDescription);
    if (descriptionError) {
      setFormError(descriptionError);
      return;
    }

    const psoriasisLanguageError = validatePsoriasisLanguage(normalizedDescription);
    if (psoriasisLanguageError) {
      setFormError(psoriasisLanguageError);
      return;
    }

    const severityError = validateSeverity(severity);
    if (severityError) {
      setFormError(severityError);
      return;
    }

    if (selectedTriggerIds.length === 0) {
      setFormError('Select at least one trigger from the psoriasis checklist.');
      return;
    }

    const selectedTriggerNames = selectedTriggerIds
      .map((triggerId) => triggerChecklist.find((trigger) => trigger.trigger_id === triggerId)?.trigger_name)
      .filter((triggerName): triggerName is string => Boolean(triggerName));

    for (const triggerName of selectedTriggerNames) {
      const triggerValidationError = validateSelectedTrigger(triggerName);
      if (triggerValidationError) {
        setFormError(triggerValidationError);
        return;
      }
    }

    const otcTreatments = otcTreatmentsInput
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    const otcValidationTarget = otcTreatments[0] ?? '';
    const otcValidationError = validateOTCTreatment(otcValidationTarget, severity);
    if (otcValidationError) {
      setFormError(otcValidationError);
      return;
    }

    setSubmitting(true);
    try {
      const apiClient = getApiClient();
      await apiClient.post('/v1/symptoms/logs', {
        patient_id: patientId,
        symptom_description: normalizedDescription,
        severity_scale: severity,
        trigger_ids: selectedTriggerIds,
        otc_treatments: otcTreatments
      });

      setSuccessMessage('Symptom log saved successfully.');
      resetForm();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to submit symptom log.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading trigger checklist..." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-clinical-900">Log Symptom</h1>
        <button
          type="button"
          onClick={() => {
            void refetch();
          }}
          className="px-4 py-2 text-sm bg-clinical-600 text-white rounded-lg hover:bg-clinical-700 transition"
        >
          Refresh Triggers
        </button>
      </div>

      {error && <ErrorAlert message={error.message} />}
      {formError && <ErrorAlert message={formError} />}
      {successMessage && <SuccessAlert message={successMessage} />}
      {successMessage && (
        <div>
          <a
            href="/patient/symptoms/history"
            className="inline-flex items-center px-4 py-2 text-sm bg-clinical-100 text-clinical-800 rounded-lg hover:bg-clinical-200 transition"
          >
            View Symptom History
          </a>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-5">
        <div>
          <label htmlFor="symptom-description" className="block text-sm font-medium text-clinical-700 mb-2">
            Symptom Description
          </label>
          <textarea
            id="symptom-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            maxLength={500}
            placeholder="Describe your psoriasis symptom changes, affected areas, and overall pattern."
            className="w-full border border-clinical-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-clinical-500"
          />
          <p className="text-xs text-clinical-500 mt-1">{description.length}/500</p>
        </div>

        <div>
          <label htmlFor="severity" className="block text-sm font-medium text-clinical-700 mb-2">
            Severity (1-10)
          </label>
          <input
            id="severity"
            type="range"
            min={1}
            max={10}
            value={severity}
            onChange={(e) => setSeverity(Number(e.target.value))}
            className="w-full"
          />
          <p className="text-sm text-clinical-700 mt-1">Current severity: {severity}</p>
        </div>

        <fieldset>
          <legend className="text-sm font-medium text-clinical-700 mb-2">
            Trigger Checklist (Psoriasis)
          </legend>
          {triggerChecklist.length === 0 ? (
            <p className="text-clinical-600">No triggers are available.</p>
          ) : (
            <div className="grid gap-2 md:grid-cols-2">
              {triggerChecklist.map((trigger) => (
                <label
                  key={trigger.trigger_id}
                  className="flex items-center gap-2 border border-clinical-200 rounded px-3 py-2"
                >
                  <input
                    type="checkbox"
                    checked={selectedTriggerIds.includes(trigger.trigger_id)}
                    onChange={() => toggleTrigger(trigger.trigger_id)}
                  />
                  <span className="text-sm text-clinical-700">{trigger.trigger_name}</span>
                </label>
              ))}
            </div>
          )}
        </fieldset>

        <div>
          <label htmlFor="otc-treatments" className="block text-sm font-medium text-clinical-700 mb-2">
            OTC Treatments (comma-separated)
          </label>
          <input
            id="otc-treatments"
            type="text"
            value={otcTreatmentsInput}
            onChange={(e) => setOtcTreatmentsInput(e.target.value)}
            placeholder="Hydrocortisone cream, Salicylic acid"
            className="w-full border border-clinical-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-clinical-500"
          />
          <p className="text-xs text-clinical-500 mt-1">Optional free text for products used.</p>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-2 bg-clinical-600 text-white rounded-lg hover:bg-clinical-700 disabled:opacity-50"
        >
          {submitting ? 'Saving...' : 'Save Symptom Log'}
        </button>
      </form>
    </div>
  );
}
