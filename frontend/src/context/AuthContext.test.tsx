import { render, screen, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import { AuthProvider, useAuth } from './AuthContext';

jest.mock('../api/client', () => ({
  getApiClient: () => ({
    post: jest.fn()
  })
}));

function AuthConsumer() {
  const { isLoading, isAuthenticated, user } = useAuth();

  if (isLoading) {
    return <div>Loading</div>;
  }

  return (
    <div>
      <span data-testid="auth-state">{isAuthenticated ? 'authenticated' : 'anonymous'}</span>
      <span data-testid="role">{user?.role ?? 'none'}</span>
    </div>
  );
}

function renderWithProvider(children: ReactNode) {
  return render(<AuthProvider>{children}</AuthProvider>);
}

describe('AuthProvider session restore', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('restores a non-expired session from localStorage', async () => {
    localStorage.setItem(
      'auth_session',
      JSON.stringify({
        user_id: 'user-patient-1',
        role: 'Patient',
        email: 'patient@example.com',
        name: 'Jordan Patient',
        patient_id: 'pat-1',
        session_token: 'token-1',
        expires_at: '2099-01-01T00:00:00Z'
      })
    );

    renderWithProvider(<AuthConsumer />);

    await waitFor(() => {
      expect(screen.getByTestId('auth-state')).toHaveTextContent('authenticated');
      expect(screen.getByTestId('role')).toHaveTextContent('Patient');
    });
  });

  it('clears expired localStorage session data', async () => {
    localStorage.setItem(
      'auth_session',
      JSON.stringify({
        user_id: 'user-patient-1',
        role: 'Patient',
        email: 'patient@example.com',
        name: 'Jordan Patient',
        patient_id: 'pat-1',
        session_token: 'token-1',
        expires_at: '2000-01-01T00:00:00Z'
      })
    );

    renderWithProvider(<AuthConsumer />);

    await waitFor(() => {
      expect(screen.getByTestId('auth-state')).toHaveTextContent('anonymous');
      expect(localStorage.getItem('auth_session')).toBeNull();
    });
  });
});
