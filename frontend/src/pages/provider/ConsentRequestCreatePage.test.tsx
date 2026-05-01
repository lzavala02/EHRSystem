import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ConsentRequestCreatePage } from './ConsentRequestCreatePage';

const mockUseFetch = jest.fn();
const mockUseSelectedPatient = jest.fn();
const mockPost = jest.fn();

jest.mock('../../hooks/useFetch', () => ({
  useFetch: (...args: unknown[]) => mockUseFetch(...args)
}));

jest.mock('../../context/SelectedPatientContext', () => ({
  useSelectedPatient: () => mockUseSelectedPatient()
}));

jest.mock('../../api/client', () => ({
  getApiClient: () => ({
    post: (...args: unknown[]) => mockPost(...args)
  })
}));

describe('ConsentRequestCreatePage', () => {
  beforeEach(() => {
    mockUseFetch.mockReset();
    mockUseSelectedPatient.mockReset();
    mockPost.mockReset();
  });

  it('submits a provider consent request and refreshes the list', async () => {
    const refetchPatients = jest.fn().mockResolvedValue(undefined);
    const refetchConsent = jest.fn().mockResolvedValue(undefined);

    mockUseSelectedPatient.mockReturnValue({
      selectedPatientId: null,
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
          refetch: refetchPatients
        };
      }

      if (url === '/v1/consent/requests') {
        return {
          data: { requests: [] },
          loading: false,
          error: null,
          refetch: refetchConsent
        };
      }

      throw new Error(`Unexpected url: ${url}`);
    });

    mockPost.mockResolvedValue({});

    render(<ConsentRequestCreatePage />);

    fireEvent.change(screen.getByLabelText('Patient'), { target: { value: 'pat-1' } });
    fireEvent.change(screen.getByLabelText('Reason'), {
      target: { value: 'Need chart access for follow-up care.' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send Consent Request' }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/v1/consent/requests', {
        patient_id: 'pat-1',
        reason: 'Need chart access for follow-up care.'
      });
      expect(refetchConsent).toHaveBeenCalled();
      expect(screen.getByText('Consent request sent successfully.')).toBeInTheDocument();
    });
  });

  it('shows validation error when reason is missing', async () => {
    mockUseSelectedPatient.mockReturnValue({
      selectedPatientId: null,
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

      if (url === '/v1/consent/requests') {
        return {
          data: { requests: [] },
          loading: false,
          error: null,
          refetch: jest.fn().mockResolvedValue(undefined)
        };
      }

      throw new Error(`Unexpected url: ${url}`);
    });

    render(<ConsentRequestCreatePage />);

    fireEvent.change(screen.getByLabelText('Patient'), { target: { value: 'pat-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send Consent Request' }));

    expect(screen.getByText('A consent reason is required.')).toBeInTheDocument();
    expect(mockPost).not.toHaveBeenCalled();
  });
});
