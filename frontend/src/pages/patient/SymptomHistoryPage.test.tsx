import { fireEvent, render, screen, within } from '@testing-library/react';
import { SymptomHistoryPage } from './SymptomHistoryPage';

const mockUseFetch = jest.fn();
const mockUseAuth = jest.fn();

jest.mock('../../hooks/useFetch', () => ({
  useFetch: (...args: unknown[]) => mockUseFetch(...args)
}));

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => mockUseAuth()
}));

function mockPatientUser() {
  mockUseAuth.mockReturnValue({
    user: {
      user_id: 'user-1',
      role: 'Patient',
      email: 'patient@example.com',
      name: 'Jordan Patient',
      patient_id: 'pat-1',
      session_token: 'token-1',
      expires_at: '2026-04-20T12:00:00Z'
    }
  });
}

function mockHistoryLogs() {
  mockUseFetch.mockReturnValue({
    data: {
      logs: [
        {
          log_id: 'log-1',
          patient_id: 'pat-1',
          symptom_description: 'Red plaques are flaring on my elbows and scalp.',
          severity_scale: 8,
          triggers: [
            { trigger_id: 'trigger-stress', trigger_name: 'Stress' },
            { trigger_id: 'trigger-weather', trigger_name: 'Dry Weather' }
          ],
          otc_treatments: ['Hydrocortisone cream', 'Salicylic acid'],
          created_at: '2026-04-21T12:00:00.000Z'
        },
        {
          log_id: 'log-2',
          patient_id: 'pat-1',
          symptom_description: 'Psoriasis scaling improved after sleep and moisturizer.',
          severity_scale: 4,
          triggers: [{ trigger_id: 'trigger-sleep', trigger_name: 'Lack of Sleep' }],
          otc_treatments: ['Moisturizer'],
          created_at: '2026-04-19T10:00:00.000Z'
        },
        {
          log_id: 'log-3',
          patient_id: 'pat-1',
          symptom_description: 'Mild psoriasis redness only around the hairline.',
          severity_scale: 2,
          triggers: [{ trigger_id: 'trigger-infection', trigger_name: 'Infection' }],
          otc_treatments: [],
          created_at: '2026-04-15T08:00:00.000Z'
        }
      ],
      total: 3,
      page: 1,
      page_size: 20
    },
    loading: false,
    error: null,
    refetch: jest.fn().mockResolvedValue(undefined)
  });
}

describe('SymptomHistoryPage', () => {
  beforeEach(() => {
    mockUseFetch.mockReset();
    mockUseAuth.mockReset();
  });

  it('renders the patient symptom history with triggers and OTC treatments', () => {
    mockPatientUser();
    mockHistoryLogs();

    render(<SymptomHistoryPage />);

    expect(screen.getByRole('heading', { name: 'Symptom History' })).toBeInTheDocument();
    expect(screen.getByText('Red plaques are flaring on my elbows and scalp.')).toBeInTheDocument();
    expect(screen.getByText('Stress, Dry Weather')).toBeInTheDocument();
    expect(screen.getByText('Hydrocortisone cream, Salicylic acid')).toBeInTheDocument();
    expect(screen.getByText('8/10')).toBeInTheDocument();
  });

  it('filters to severe psoriasis logs and updates summary cards', () => {
    mockPatientUser();
    mockHistoryLogs();

    render(<SymptomHistoryPage />);

    fireEvent.change(screen.getByLabelText('Severity Band'), {
      target: { value: 'severe' }
    });

    expect(screen.getByText('Red plaques are flaring on my elbows and scalp.')).toBeInTheDocument();
    expect(screen.queryByText('Psoriasis scaling improved after sleep and moisturizer.')).not.toBeInTheDocument();
    expect(screen.queryByText('Mild psoriasis redness only around the hairline.')).not.toBeInTheDocument();

    expect(screen.getByText('Logs Shown')).toBeInTheDocument();
    expect(screen.getByText('Average Severity')).toBeInTheDocument();
    expect(screen.getByText('Severe Logs (8-10)')).toBeInTheDocument();

    const logsShownCard = screen.getByText('Logs Shown').closest('div');
    const averageSeverityCard = screen.getByText('Average Severity').closest('div');
    const severeLogsCard = screen.getByText('Severe Logs (8-10)').closest('div');

    expect(logsShownCard).not.toBeNull();
    expect(averageSeverityCard).not.toBeNull();
    expect(severeLogsCard).not.toBeNull();

    expect(within(logsShownCard as HTMLElement).getByText('1')).toBeInTheDocument();
    expect(within(averageSeverityCard as HTMLElement).getByText('8.0')).toBeInTheDocument();
    expect(within(severeLogsCard as HTMLElement).getByText('1')).toBeInTheDocument();
  });

  it('filters by psoriasis trigger and clears filters', () => {
    mockPatientUser();
    mockHistoryLogs();

    render(<SymptomHistoryPage />);

    fireEvent.change(screen.getByLabelText('Trigger'), {
      target: { value: 'Lack of Sleep' }
    });

    expect(screen.getByText('Psoriasis scaling improved after sleep and moisturizer.')).toBeInTheDocument();
    expect(screen.queryByText('Red plaques are flaring on my elbows and scalp.')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Clear Filters' }));

    expect(screen.getByText('Psoriasis scaling improved after sleep and moisturizer.')).toBeInTheDocument();
    expect(screen.getByText('Red plaques are flaring on my elbows and scalp.')).toBeInTheDocument();
    expect(screen.getByText('Mild psoriasis redness only around the hairline.')).toBeInTheDocument();
  });
});