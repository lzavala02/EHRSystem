import { render, screen } from '@testing-library/react';
import { ProviderPatientDashboardPage } from './PatientDashboardPage';

const mockUseFetch = jest.fn();
const mockUseSelectedPatient = jest.fn();

jest.mock('../../hooks/useFetch', () => ({
  useFetch: (...args: unknown[]) => mockUseFetch(...args)
}));

jest.mock('../../context/SelectedPatientContext', () => ({
  useSelectedPatient: () => mockUseSelectedPatient()
}));

describe('ProviderPatientDashboardPage', () => {
  beforeAll(() => {
    jest.useFakeTimers();
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(() => {
    mockUseFetch.mockReset();
    mockUseSelectedPatient.mockReset();
    jest.setSystemTime(new Date('2026-04-13T12:00:00Z'));
  });

  it('renders provider dashboard data for selected patient', () => {
    mockUseSelectedPatient.mockReturnValue({
      selectedPatientId: 'pat-1',
      setSelectedPatientId: jest.fn()
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
          error: null,
          refetch: jest.fn().mockResolvedValue(undefined)
        };
      }

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
              },
              {
                provider_id: 'prov-derm',
                provider_name: 'Dr. Bea Dermatology',
                specialty: 'Dermatology',
                clinic_affiliation: 'Skin Center'
              }
            ],
            medical_history: [
              {
                record_id: 'rec-1',
                category: 'Medications',
                value_description: 'Topical corticosteroid',
                recorded_at: '2026-04-10T13:30:00Z',
                system_id: 'sys-epic',
                system_name: 'Epic'
              }
            ],
            missing_data: [
              {
                field_name: 'Vaccination Record',
                reason: 'NextGen source has not yet returned immunization history.'
              }
            ]
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
            sync_status: [
              {
                category: 'Medications',
                last_synced_at: '2026-04-12T08:00:00Z',
                system_id: 'sys-epic',
                system_name: 'Epic'
              }
            ]
          },
          loading: false,
          error: null,
          refetch: jest.fn().mockResolvedValue(undefined)
        };
      }

      throw new Error(`Unexpected url: ${url}`);
    });

    render(<ProviderPatientDashboardPage />);

    expect(screen.getByText('Patient Dashboard (Provider View)')).toBeInTheDocument();
    expect(screen.getByText('Morning integration slice')).toBeInTheDocument();
    expect(screen.getByText('Source ID: sys-epic')).toBeInTheDocument();
    expect(screen.getByText('Source ID: sys-nextgen')).toBeInTheDocument();
    expect(screen.getByText('Dr. Ada Provider')).toBeInTheDocument();
    expect(screen.getByText('Dr. Bea Dermatology')).toBeInTheDocument();
    expect(screen.getByText(/NextGen source has not yet returned immunization history\./i)).toBeInTheDocument();
    expect(screen.getByText('Patient Health Profile')).toBeInTheDocument();
    expect(screen.getByText('Topical corticosteroid')).toBeInTheDocument();
    expect(screen.getByText(/Epic\s*-\s*Medications/)).toBeInTheDocument();
  });

  it('shows unified error alert when dashboard fetch fails', () => {
    mockUseSelectedPatient.mockReturnValue({
      selectedPatientId: 'pat-1',
      setSelectedPatientId: jest.fn()
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
          error: null,
          refetch: jest.fn().mockResolvedValue(undefined)
        };
      }

      if (url === '/v1/dashboard/patients/pat-1') {
        return {
          data: null,
          loading: false,
          error: new Error('Dashboard fetch failed'),
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

    render(<ProviderPatientDashboardPage />);

    expect(screen.getByText('Dashboard fetch failed')).toBeInTheDocument();
  });

  it('shows fresh and stale badges based on per-category sync timestamps', () => {
    mockUseSelectedPatient.mockReturnValue({
      selectedPatientId: 'pat-1',
      setSelectedPatientId: jest.fn()
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
          error: null,
          refetch: jest.fn().mockResolvedValue(undefined)
        };
      }

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
              { system_id: 'sys-epic', system_name: 'Epic' }
            ],
            providers: [
              {
                provider_id: 'prov-pcp',
                provider_name: 'Dr. Ada Provider',
                specialty: 'Primary Care',
                clinic_affiliation: 'North Clinic'
              }
            ],
            medical_history: [
              {
                record_id: 'rec-1',
                category: 'Medications',
                value_description: 'Topical corticosteroid',
                recorded_at: '2026-04-10T13:30:00Z',
                system_id: 'sys-epic',
                system_name: 'Epic'
              }
            ],
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
            sync_status: [
              {
                category: 'Medications',
                last_synced_at: '2026-04-13T11:30:00Z',
                system_id: 'sys-epic',
                system_name: 'Epic'
              },
              {
                category: 'Lab Results',
                last_synced_at: '2026-04-12T10:00:00Z',
                system_id: 'sys-nextgen',
                system_name: 'NextGen'
              }
            ]
          },
          loading: false,
          error: null,
          refetch: jest.fn().mockResolvedValue(undefined)
        };
      }

      throw new Error(`Unexpected url: ${url}`);
    });

    render(<ProviderPatientDashboardPage />);

    expect(screen.getAllByText('Fresh')).toHaveLength(1);
    expect(screen.getAllByText('Stale')).toHaveLength(1);
    expect(screen.getByText(/Epic\s*-\s*Medications/)).toBeInTheDocument();
    expect(screen.getByText(/NextGen\s*-\s*Lab Results/)).toBeInTheDocument();
  });
});
