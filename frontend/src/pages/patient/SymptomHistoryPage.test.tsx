import { render, screen } from '@testing-library/react';
import { SymptomHistoryPage } from './SymptomHistoryPage';

const mockUseFetch = jest.fn();
const mockUseAuth = jest.fn();

jest.mock('../../hooks/useFetch', () => ({
  useFetch: (...args: unknown[]) => mockUseFetch(...args)
}));

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => mockUseAuth()
}));

describe('SymptomHistoryPage', () => {
  beforeEach(() => {
    mockUseFetch.mockReset();
    mockUseAuth.mockReset();
  });

  it('renders the patient symptom history with triggers and OTC treatments', () => {
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
              { trigger_id: 'trigger-weather', trigger_name: 'Weather Change' }
            ],
            otc_treatments: ['Hydrocortisone cream', 'Salicylic acid'],
            created_at: '2026-04-21T12:00:00.000Z'
          }
        ],
        total: 1,
        page: 1,
        page_size: 20
      },
      loading: false,
      error: null,
      refetch: jest.fn().mockResolvedValue(undefined)
    });

    render(<SymptomHistoryPage />);

    expect(screen.getByRole('heading', { name: 'Symptom History' })).toBeInTheDocument();
    expect(screen.getByText('Red plaques are flaring on my elbows and scalp.')).toBeInTheDocument();
    expect(screen.getByText('Stress, Weather Change')).toBeInTheDocument();
    expect(screen.getByText('Hydrocortisone cream, Salicylic acid')).toBeInTheDocument();
    expect(screen.getByText('8/10')).toBeInTheDocument();
  });
});