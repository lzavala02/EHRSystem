import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SharedReportsPage } from './SharedReportsPage';

const mockGet = jest.fn();
const mockOpen = jest.fn();
const mockCreateObjectURL = jest.fn();
const mockRevokeObjectURL = jest.fn();

jest.mock('../../api/client', () => ({
  getApiClient: () => ({
    get: (...args: unknown[]) => mockGet(...args)
  })
}));

describe('SharedReportsPage', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockOpen.mockReset();
    mockCreateObjectURL.mockReset();
    mockRevokeObjectURL.mockReset();

    Object.defineProperty(window, 'open', {
      configurable: true,
      value: mockOpen
    });

    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: mockCreateObjectURL
    });

    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: mockRevokeObjectURL
    });
  });

  it('loads a shared report and exposes the secure report link', async () => {
    const blob = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
    mockGet.mockResolvedValue({
      data: {
        report_id: 'rep-1',
        patient_id: 'pat-1',
        generated_at: '2026-04-21T12:00:00.000Z',
        secure_url: '/v1/reports/rep-1/content?access_token=abc123',
        expires_at: '2026-05-21T12:00:00.000Z'
      }
    });
    mockGet.mockResolvedValueOnce({
      data: {
        report_id: 'rep-1',
        patient_id: 'pat-1',
        generated_at: '2026-04-21T12:00:00.000Z',
        secure_url: '/v1/reports/rep-1/content?access_token=abc123',
        expires_at: '2026-05-21T12:00:00.000Z'
      }
    });
    mockGet.mockResolvedValueOnce({ data: blob });
    mockCreateObjectURL.mockReturnValue('blob:secure-report-url');

    render(<SharedReportsPage />);

    fireEvent.change(screen.getByLabelText('Report ID'), { target: { value: 'rep-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Load Report' }));

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/v1/reports/rep-1');
      expect(screen.getByText('Report loaded successfully.')).toBeInTheDocument();
    });

    expect(screen.getByText('rep-1')).toBeInTheDocument();
    expect(screen.getByText('pat-1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Open Secure Report' }));

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/v1/reports/rep-1/content?access_token=abc123', {
        responseType: 'blob',
        headers: { Accept: 'application/pdf' }
      });
      expect(mockCreateObjectURL).toHaveBeenCalled();
      expect(mockOpen).toHaveBeenCalledWith('blob:secure-report-url', '_blank', 'noopener,noreferrer');
    });
  });
});