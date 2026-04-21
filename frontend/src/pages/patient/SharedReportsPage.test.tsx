import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SharedReportsPage } from './SharedReportsPage';

const mockGet = jest.fn();

jest.mock('../../api/client', () => ({
  getApiClient: () => ({
    get: (...args: unknown[]) => mockGet(...args)
  })
}));

describe('SharedReportsPage', () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  it('loads a shared report and exposes the secure report link', async () => {
    mockGet.mockResolvedValue({
      data: {
        report_id: 'rep-1',
        patient_id: 'pat-1',
        generated_at: '2026-04-21T12:00:00.000Z',
        secure_url: 'https://secure.example.test/reports/rep-1',
        expires_at: '2026-05-21T12:00:00.000Z'
      }
    });

    render(<SharedReportsPage />);

    fireEvent.change(screen.getByLabelText('Report ID'), { target: { value: 'rep-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Load Report' }));

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/v1/reports/rep-1');
      expect(screen.getByText('Report loaded successfully.')).toBeInTheDocument();
    });

    expect(screen.getByText('rep-1')).toBeInTheDocument();
    expect(screen.getByText('pat-1')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open Secure Report' })).toHaveAttribute(
      'href',
      'https://secure.example.test/reports/rep-1'
    );
  });
});