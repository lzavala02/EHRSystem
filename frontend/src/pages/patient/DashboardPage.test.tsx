import { render, screen } from '@testing-library/react';
import { PatientDashboardPage } from './DashboardPage';

const mockUseFetch = jest.fn();
const mockUseAuth = jest.fn();
const mockGetApiClient = jest.fn();

jest.mock('../../hooks/useFetch', () => ({
  useFetch: (...args: unknown[]) => mockUseFetch(...args)
}));

jest.mock('../../api/client', () => ({
  getApiClient: (...args: unknown[]) => mockGetApiClient(...args)
}));

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => mockUseAuth()
}));

describe('PatientDashboardPage', () => {
  beforeEach(() => {
    mockUseFetch.mockReset();
    mockGetApiClient.mockReset();
    mockUseAuth.mockReset();
  });

  it('shows a patient read-only banner with dashboard data', () => {
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

    mockUseFetch.mockImplementation((url: string) => {
      if (url === '/v1/dashboard/patients/pat-1') {
        return {
          data: {
            patient_id: 'pat-1',
            patient_profile: {
              height: 170,
              weight: 72,
              vaccination_record: 'Up to date',
              family_history: 'Psoriasis'
            },
            source_systems: [
              { system_id: 'sys-epic', system_name: 'Epic' },
              { system_id: 'sys-nextgen', system_name: 'NextGen' }
            ],
            providers: [
              {
                provider_id: 'prov-pcp',
                provider_name: 'Dr. Ada Provider',
                specialty: 'Primary Care',
                clinic_affiliation: 'North Clinic'
              }
            ],
            medical_history: [],
            missing_data: []
          },
          loading: false,
          error: null,
          refetch: jest.fn().mockResolvedValue(undefined)
        };
      }

      if (url === '/v1/dashboard/patients/pat-1/sync-status') {
        return {
          data: {
            patient_id: 'pat-1',
            sync_status: []
          },
          loading: false,
          error: null,
          refetch: jest.fn().mockResolvedValue(undefined)
        };
      }

      throw new Error(`Unexpected url: ${url}`);
    });

    render(<PatientDashboardPage />);

    expect(screen.getByText('Patient read-only view')).toBeInTheDocument();
    expect(screen.getByText('Manage Your Health Data')).toBeInTheDocument();
    expect(screen.getByText(/Provider-only actions are hidden here\./i)).toBeInTheDocument();
    expect(screen.getByText('My Health Dashboard')).toBeInTheDocument();
    expect(screen.getAllByText('Epic').length).toBeGreaterThan(0);
    expect(screen.getByText('Dr. Ada Provider')).toBeInTheDocument();
  });
});
