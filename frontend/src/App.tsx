import { useEffect } from 'react';
import { createBrowserRouter, RouterProvider, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SelectedPatientProvider } from './context/SelectedPatientContext';
import { initializeApiClient } from './api/client';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AuthLayout } from './components/AuthLayout';
import { AppLayout } from './components/AppLayout';

// Auth pages
import { LoginPage } from './pages/auth/LoginPage';
import { TwoFAPage } from './pages/auth/TwoFAPage';

// Patient pages
import { PatientDashboardPage } from './pages/patient/DashboardPage';
import { ConsentRequestListPage } from './pages/patient/ConsentRequestListPage';
import { SymptomLogPage } from './pages/patient/SymptomLogPage';
import { SymptomHistoryPage } from './pages/patient/SymptomHistoryPage';
import { SharedReportsPage } from './pages/patient/SharedReportsPage';

// Provider pages
import { PatientListPage } from './pages/provider/PatientListPage';
import { AlertsDashboardPage } from './pages/provider/AlertsDashboardPage';
import { QuickSharePage } from './pages/provider/QuickSharePage';

// Error pages
import { ErrorPage } from './pages/ErrorPage';
import { UnauthorizedPage } from './pages/UnauthorizedPage';

// Wrapper component to initialize API client after auth context is ready
function AppContent() {
  const { user } = useAuth();

  useEffect(() => {
    // Initialize API client with auth token provider
    initializeApiClient(() => user?.session_token ?? null);
  }, [user]);

  const router = createBrowserRouter([
    // Auth Routes (Public)
    {
      path: '/auth',
      element: <AuthLayout><Outlet /></AuthLayout>,
      children: [
        { path: 'login', element: <LoginPage /> },
        { path: '2fa-verify', element: <TwoFAPage /> }
      ]
    },

    // Patient Routes (Protected)
    {
      path: '/patient',
      element: (
        <ProtectedRoute requiredRoles={['Patient']}>
          <AppLayout><Outlet /></AppLayout>
        </ProtectedRoute>
      ),
      children: [
        { path: 'dashboard', element: <PatientDashboardPage /> },
        { path: 'consent/requests', element: <ConsentRequestListPage /> },
        { path: 'symptoms/log', element: <SymptomLogPage /> },
        { path: 'symptoms/history', element: <SymptomHistoryPage /> },
        { path: 'reports', element: <SharedReportsPage /> }
      ]
    },

    // Provider Routes (Protected)
    {
      path: '/provider',
      element: (
        <ProtectedRoute requiredRoles={['Provider', 'Admin']}>
          <AppLayout><Outlet /></AppLayout>
        </ProtectedRoute>
      ),
      children: [
        { path: 'patients', element: <PatientListPage /> },
        { path: 'alerts', element: <AlertsDashboardPage /> },
        { path: 'quick-share', element: <QuickSharePage /> }
      ]
    },

    // Error Routes
    {
      path: '/error/unauthorized',
      element: <UnauthorizedPage />
    },
    { path: '/error', element: <ErrorPage /> },

    // Root redirect
    { path: '/', element: <Navigate to="/auth/login" replace /> },
    { path: '*', element: <ErrorPage /> }
  ]);

  return <RouterProvider router={router} />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <SelectedPatientProvider>
          <AppContent />
        </SelectedPatientProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
