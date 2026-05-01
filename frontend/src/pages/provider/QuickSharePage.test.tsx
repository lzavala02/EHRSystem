import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QuickSharePage } from './QuickSharePage';

const mockUseFetch = jest.fn();
const mockUseSelectedPatient = jest.fn();
const mockUseAuth = jest.fn();
const mockUseJobStatus = jest.fn();
const mockGet = jest.fn();
const mockPost = jest.fn();
let jobPhase: 'idle' | 'completed' = 'idle';

const idleJobState = {
  status: 'pending',
  data: null,
  error: null,
  loading: false
};

const completedJobState = {
  status: 'completed',
  data: { report_id: 'rep-99' },
  error: null,
  loading: false
};

jest.mock('../../hooks/useFetch', () => ({
  useFetch: (...args: unknown[]) => mockUseFetch(...args)
}));

jest.mock('../../context/SelectedPatientContext', () => ({
  useSelectedPatient: () => mockUseSelectedPatient()
}));

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => mockUseAuth()
}));

jest.mock('../../hooks/useJobStatus', () => ({
  useJobStatus: (...args: unknown[]) => mockUseJobStatus(...args)
}));

jest.mock('../../api/client', () => ({
  getApiClient: () => ({
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args)
  })
}));

describe('QuickSharePage', () => {
  beforeEach(() => {
    mockUseFetch.mockReset();
    mockUseSelectedPatient.mockReset();
    mockUseAuth.mockReset();
    mockUseJobStatus.mockReset();
    mockGet.mockReset();
    mockPost.mockReset();

    mockUseSelectedPatient.mockReturnValue({
      selectedPatientId: null,
      setSelectedPatientId: jest.fn()
    });

    jobPhase = 'idle';

    mockUseAuth.mockReturnValue({
      user: {
        user_id: 'user-provider-1',
        provider_id: 'prov-pcp'
      }
    });

    mockUseFetch.mockImplementation((url: string) => {
      if (url === '/v1/provider/patients') {
        return {
          data: {
            patients: [
              {
                patient_id: 'pat-1',
                patient_name: 'Jordan Patient',
                primary_condition: 'Psoriasis',
                last_visit: '2026-04-12T10:00:00Z'
              }
            ]
          },
          loading: false,
          error: null
        };
      }

      throw new Error(`Unexpected url: ${url}`);
    });

    mockUseJobStatus.mockImplementation(() => {
      if (jobPhase === 'idle') {
        return idleJobState;
      }

      return completedJobState;
    });

    mockGet.mockImplementation((url: string) => {
      if (url === '/v1/provider/patients/pat-1/quick-share-prefill') {
        return Promise.resolve({
          data: {
            patient_id: 'pat-1',
            provider_id: 'prov-pcp',
            fields: {
              to_provider_id: 'prov-derm',
              message: 'Please review before dermatology follow-up.',
              period_start: '2026-04-01T00:00:00+00:00',
              period_end: '2026-04-30T00:00:00+00:00'
            },
            source_timestamp_utc: '2026-04-12T10:00:00Z'
          }
        });
      }

      if (url === '/v1/reports/rep-99') {
        return Promise.resolve({
          data: {
            report_id: 'rep-99',
            patient_id: 'pat-1',
            generated_by_provider_id: 'prov-pcp',
            generated_at: '2026-04-23T12:00:00Z',
            secure_url: '/v1/reports/rep-99/content?access_token=test-token',
            summary: 'Trend report generated from 1 symptom log(s), but severity trend is not yet measurable.',
            period_start: '2026-04-01T00:00:00+00:00',
            period_end: '2026-04-30T00:00:00+00:00',
            symptom_count: 1,
            trigger_names: ['Stress'],
            treatment_names: ['Hydrocortisone cream'],
            expires_at: '2026-04-23T12:10:00Z'
          }
        });
      }

      throw new Error(`Unexpected GET url: ${url}`);
    });

    mockPost.mockImplementation((url: string) => {
      if (url === '/v1/symptoms/reports/trend') {
        return Promise.resolve({
          data: {
            report_id: 'rep-99',
            status: 'pending',
            created_at: '2026-04-23T12:00:00Z',
            job_id: 'rep-99',
            threshold_alerts_created: ['alert-1'],
            should_quick_share: true,
            threshold_analyses: [{ detected: true }]
          }
        });
      }

      if (url === '/v1/provider/quick-share') {
        return Promise.resolve({
          data: {
            share_id: 'share-1',
            status: 'pending',
            created_at: '2026-04-23T12:02:00Z',
            message: 'Progress report shared with provider prov-derm for patient pat-1.'
          }
        });
      }

      throw new Error(`Unexpected POST url: ${url}`);
    });
  });

  it('transitions from report generation to ready-to-share and successful PCP quick-share', async () => {
    const { rerender } = render(<QuickSharePage />);

    const shareButton = screen.getByRole('button', { name: 'Send Quick-Share to PCP' });
    expect(shareButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Select Patient'), { target: { value: 'pat-1' } });

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/v1/provider/patients/pat-1/quick-share-prefill');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Generate Report' }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/v1/symptoms/reports/trend', {
        patient_id: 'pat-1',
        period_start: '2026-04-01T00:00:00.000Z',
        period_end: '2026-04-30T23:59:59.999Z'
      });
    });

    jobPhase = 'completed';
    rerender(<QuickSharePage />);

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/v1/reports/rep-99');
      expect(screen.getByText('Trend report generated and ready to share.')).toBeInTheDocument();
      expect(screen.getByText('Report Ready')).toBeInTheDocument();
    });

    expect(screen.getByText(/Quick-share to the PCP is recommended/i)).toBeInTheDocument();
    expect(screen.getByText(/Symptoms logged:/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Send Quick-Share to PCP' })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Send Quick-Share to PCP' }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/v1/provider/quick-share', {
        patient_id: 'pat-1',
        from_provider_id: 'prov-pcp',
        to_provider_id: 'prov-derm',
        report_id: 'rep-99',
        message: 'Please review before dermatology follow-up.'
      });
    });

    await waitFor(() => {
      expect(screen.getByText('Quick-share sent successfully to the receiving PCP.')).toBeInTheDocument();
      expect(screen.getByText('PCP quick-share delivered to the in-app queue.')).toBeInTheDocument();
      expect(screen.getByText('share-1')).toBeInTheDocument();
    });
  });
});