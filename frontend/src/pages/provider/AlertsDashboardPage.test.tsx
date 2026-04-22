import { fireEvent, render, screen } from '@testing-library/react';
import { AlertsDashboardPage } from './AlertsDashboardPage';

const mockUseFetch = jest.fn();

jest.mock('../../hooks/useFetch', () => ({
  useFetch: (...args: unknown[]) => mockUseFetch(...args)
}));

describe('AlertsDashboardPage', () => {
  beforeEach(() => {
    mockUseFetch.mockReset();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-13T12:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders and filters sync conflict alerts in provider view', () => {
    mockUseFetch.mockReturnValue({
      data: {
        alerts: [
          {
            alert_id: 'alert-1',
            alert_type: 'SyncConflict',
            patient_id: 'pat-1',
            provider_id: 'prov-1',
            system_id: 'sys-epic',
            description: 'Epic conflict in Medications: local and remote values differ.',
            status: 'Active',
            triggered_at: '2026-04-13T11:40:00Z'
          },
          {
            alert_id: 'alert-2',
            alert_type: 'NegativeTrend',
            patient_id: 'pat-2',
            provider_id: 'prov-1',
            system_id: 'sys-nextgen',
            description: 'Symptom severity trend increased for patient pat-2.',
            status: 'Resolved',
            triggered_at: '2026-04-12T11:40:00Z'
          }
        ],
        total: 2,
        page: 1,
        page_size: 20
      },
      loading: false,
      error: null,
      refetch: jest.fn().mockResolvedValue(undefined)
    });

    render(<AlertsDashboardPage />);

    expect(screen.getByText('Epic conflict in Medications: local and remote values differ.')).toBeInTheDocument();
    expect(screen.getByText('Symptom severity trend increased for patient pat-2.')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Alert Type'), {
      target: { value: 'SyncConflict' }
    });

    expect(screen.getByText('Epic conflict in Medications: local and remote values differ.')).toBeInTheDocument();
    expect(screen.queryByText('Symptom severity trend increased for patient pat-2.')).not.toBeInTheDocument();
    expect(screen.getByText('1 alert(s) shown')).toBeInTheDocument();
  });

  it('shows fetch error for alerts retrieval failures', () => {
    mockUseFetch.mockReturnValue({
      data: null,
      loading: false,
      error: new Error('Alerts endpoint unavailable'),
      refetch: jest.fn().mockResolvedValue(undefined)
    });

    render(<AlertsDashboardPage />);

    expect(screen.getByText('Unable to load alerts. Incident: capturing')).toBeInTheDocument();
  });
});
