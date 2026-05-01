import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';

const mockUseAuth = jest.fn();

jest.mock('../context/AuthContext', () => ({
  useAuth: () => mockUseAuth()
}));

describe('ProtectedRoute', () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
  });

  it('redirects anonymous users to login', () => {
    mockUseAuth.mockReturnValue({ user: null, isLoading: false });

    render(
      <MemoryRouter initialEntries={['/provider/patients']}>
        <Routes>
          <Route
            path="/provider/patients"
            element={
              <ProtectedRoute requiredRoles={['Provider']}>
                <div>Provider Area</div>
              </ProtectedRoute>
            }
          />
          <Route path="/auth/login" element={<div>Login Page</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Login Page')).toBeInTheDocument();
  });

  it('redirects users without required role to unauthorized page', () => {
    mockUseAuth.mockReturnValue({
      user: { role: 'Patient' },
      isLoading: false
    });

    render(
      <MemoryRouter initialEntries={['/provider/patients']}>
        <Routes>
          <Route
            path="/provider/patients"
            element={
              <ProtectedRoute requiredRoles={['Provider']}>
                <div>Provider Area</div>
              </ProtectedRoute>
            }
          />
          <Route path="/error/unauthorized" element={<div>Unauthorized Page</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Unauthorized Page')).toBeInTheDocument();
  });

  it('renders child routes for allowed roles', () => {
    mockUseAuth.mockReturnValue({
      user: { role: 'Provider' },
      isLoading: false
    });

    render(
      <MemoryRouter initialEntries={['/provider/patients']}>
        <Routes>
          <Route
            path="/provider/patients"
            element={
              <ProtectedRoute requiredRoles={['Provider', 'Admin']}>
                <div>Provider Area</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Provider Area')).toBeInTheDocument();
  });
});
