import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SymptomLogPage } from './SymptomLogPage';

const mockUseFetch = jest.fn();
const mockUseAuth = jest.fn();
const mockPost = jest.fn();

jest.mock('../../hooks/useFetch', () => ({
  useFetch: (...args: unknown[]) => mockUseFetch(...args)
}));

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => mockUseAuth()
}));

jest.mock('../../api/client', () => ({
  getApiClient: () => ({
    post: (...args: unknown[]) => mockPost(...args)
  })
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

function mockTriggerChecklist() {
  mockUseFetch.mockReturnValue({
    data: {
      triggers: [
        { trigger_id: 'trigger-stress', trigger_name: 'Stress', category: 'Lifestyle' },
        { trigger_id: 'trigger-weather', trigger_name: 'Weather Change', category: 'Environment' }
      ]
    },
    loading: false,
    error: null,
    refetch: jest.fn().mockResolvedValue(undefined)
  });
}

describe('SymptomLogPage', () => {
  beforeEach(() => {
    mockUseFetch.mockReset();
    mockUseAuth.mockReset();
    mockPost.mockReset();
  });

  it('saves a psoriasis symptom log with triggers and OTC treatments', async () => {
    mockPatientUser();
    mockTriggerChecklist();

    mockPost.mockResolvedValue({});

    render(<SymptomLogPage />);

    fireEvent.change(screen.getByLabelText('Symptom Description'), {
      target: { value: 'Red plaques are flaring on my elbows and scalp.' }
    });
    fireEvent.click(screen.getByLabelText('Stress'));
    fireEvent.change(screen.getByLabelText('OTC Treatments (comma-separated)'), {
      target: { value: 'Hydrocortisone cream, Salicylic acid' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save Symptom Log' }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/v1/symptoms/logs', {
        patient_id: 'pat-1',
        symptom_description: 'Red plaques are flaring on my elbows and scalp.',
        severity_scale: 5,
        trigger_ids: ['trigger-stress'],
        otc_treatments: ['Hydrocortisone cream', 'Salicylic acid']
      });
      expect(screen.getByText('Symptom log saved successfully.')).toBeInTheDocument();
    });

    expect(screen.getByLabelText('Symptom Description')).toHaveValue('');
    expect(screen.getByLabelText('OTC Treatments (comma-separated)')).toHaveValue('');
  });

  it('blocks submission when description is not psoriasis-oriented', async () => {
    mockPatientUser();
    mockTriggerChecklist();

    render(<SymptomLogPage />);

    fireEvent.change(screen.getByLabelText('Symptom Description'), {
      target: { value: 'Headache and fatigue persisted for two days.' }
    });
    fireEvent.click(screen.getByLabelText('Stress'));
    fireEvent.click(screen.getByRole('button', { name: 'Save Symptom Log' }));

    await waitFor(() => {
      expect(
        screen.getByText('Description must reference psoriasis-oriented symptoms')
      ).toBeInTheDocument();
    });
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('requires OTC treatment when severity is 8 or higher', async () => {
    mockPatientUser();
    mockTriggerChecklist();

    render(<SymptomLogPage />);

    fireEvent.change(screen.getByLabelText('Symptom Description'), {
      target: { value: 'Psoriasis plaques are worsening with intense itching.' }
    });
    fireEvent.change(screen.getByLabelText('Severity (1-10)'), {
      target: { value: '8' }
    });
    fireEvent.click(screen.getByLabelText('Stress'));
    fireEvent.click(screen.getByRole('button', { name: 'Save Symptom Log' }));

    await waitFor(() => {
      expect(
        screen.getByText('At least one OTC treatment is required when severity is 8 or higher')
      ).toBeInTheDocument();
    });
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('requires at least one trigger from the psoriasis checklist', async () => {
    mockPatientUser();
    mockTriggerChecklist();

    render(<SymptomLogPage />);

    fireEvent.change(screen.getByLabelText('Symptom Description'), {
      target: { value: 'Psoriasis plaques and scaling are flaring on my scalp.' }
    });
    fireEvent.change(screen.getByLabelText('OTC Treatments (comma-separated)'), {
      target: { value: 'Hydrocortisone cream' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save Symptom Log' }));

    await waitFor(() => {
      expect(
        screen.getByText('Select at least one trigger from the psoriasis checklist.')
      ).toBeInTheDocument();
    });
    expect(mockPost).not.toHaveBeenCalled();
  });
});