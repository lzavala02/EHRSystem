import { FormEvent, useState } from 'react';
import { getApiClient } from '../../api/client';
import { ErrorAlert, SuccessAlert } from '../../components/Alerts';
import { ReportData } from '../../types/api';
import { formatUtcTimestamp } from '../../utils/date';

export function SharedReportsPage() {
  const [reportId, setReportId] = useState('');
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchReport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!reportId.trim()) {
      setError('Please enter a report ID.');
      return;
    }

    setLoading(true);
    try {
      const apiClient = getApiClient();
      const response = await apiClient.get<ReportData>(`/v1/reports/${reportId.trim()}`);
      setReport(response.data);
      setSuccessMessage('Report loaded successfully.');
    } catch (err) {
      setReport(null);
      setError(err instanceof Error ? err.message : 'Unable to load report.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-clinical-900">Shared Reports</h1>

      {error && <ErrorAlert message={error} />}
      {successMessage && <SuccessAlert message={successMessage} />}

      <form onSubmit={fetchReport} className="bg-white rounded-lg shadow p-6 space-y-4">
        <div>
          <label htmlFor="report-id" className="block text-sm font-medium text-clinical-700 mb-1">
            Report ID
          </label>
          <input
            id="report-id"
            type="text"
            value={reportId}
            onChange={(e) => setReportId(e.target.value)}
            placeholder="Enter report ID"
            className="w-full border border-clinical-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-clinical-500"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-clinical-600 text-white rounded-lg hover:bg-clinical-700 disabled:opacity-50"
        >
          {loading ? 'Loading...' : 'Load Report'}
        </button>
      </form>

      {report && (
        <section className="bg-white rounded-lg shadow p-6 space-y-3">
          <h2 className="text-xl font-semibold text-clinical-900">Report Details</h2>
          <p className="text-sm text-clinical-700">
            <span className="font-medium">Report ID:</span> {report.report_id}
          </p>
          <p className="text-sm text-clinical-700">
            <span className="font-medium">Patient ID:</span> {report.patient_id}
          </p>
          <p className="text-sm text-clinical-700">
            <span className="font-medium">Generated At (UTC):</span> {formatUtcTimestamp(report.generated_at)}
          </p>
          {report.expires_at && (
            <p className="text-sm text-clinical-700">
              <span className="font-medium">Expires At (UTC):</span> {formatUtcTimestamp(report.expires_at)}
            </p>
          )}
          <a
            href={report.secure_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex mt-2 px-4 py-2 bg-health-info text-white rounded-lg hover:opacity-90"
          >
            Open Secure Report
          </a>
        </section>
      )}
    </div>
  );
}
