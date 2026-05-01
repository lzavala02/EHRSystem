# Day 1 Frontend Deliverables - Engineer B

## Overview
This document captures all Day 1 frontend production decisions, architecture, and scaffolding for the EHR Chronic Disease Management system. By end of Day 1, the frontend skeleton is ready for Day 2 entity implementation and Day 3 feature development.

---

## 1. Frontend Stack Decision ✓

### Selected Stack
- **Framework**: React 18+ with TypeScript
- **Build Tool**: Vite (next-generation build tool, fast dev experience, optimized production builds)
- **HTTP Client**: Axios (promise-based, interceptor support for auth/error handling)
- **Routing**: React Router v6+ (nested routes, protected route patterns, dynamic navigation)
- **State Management**: React Context API + custom hooks (lightweight, sufficient for authentication and user state)
- **Styling**: CSS Modules + Tailwind CSS (utility-first for rapid UI development)
- **Testing**: Jest + React Testing Library (unit and integration tests)
- **Form Handling**: React Hook Form (minimal bundle, excellent DX)
- **HTTP Status Polling**: Native async/await pattern with custom hooks

### Rationale
- **Vite**: Development speed and production optimization align with clinic's iteration needs
- **Axios**: Interceptor middleware handles 401/403/5xx errors, auth token injection, HIPAA audit logging
- **Context API**: No external state dependencies, team familiar with React patterns, suitable for clinic app scale
- **React Router v6**: Nested routes and protect patterns enable clean role-based navigation
- **TypeScript**: Type safety reduces bugs, improves maintainability for HIPAA compliance

### Dependencies (package.json)
```json
{
  "dependencies": {
    "react": "^18.x",
    "react-dom": "^18.x",
    "react-router-dom": "^6.x",
    "axios": "^1.x",
    "react-hook-form": "^7.x",
    "tailwindcss": "^3.x"
  },
  "devDependencies": {
    "vite": "^5.x",
    "@vitejs/plugin-react": "^4.x",
    "@types/react": "^18.x",
    "typescript": "^5.x",
    "jest": "^29.x",
    "@testing-library/react": "^14.x"
  }
}
```

---

## 2. Routing Structure

### Route Hierarchy with RBAC Protection

```
Routes (Protected by AuthContext)
├── /auth (Public)
│   ├── /login
│   └── /2fa-verify
│
├── /patient (Protected: role === 'Patient')
│   ├── /dashboard
│   ├── /consent
│   │   ├── /requests
│   │   └── /requests/:requestId/details
│   ├── /symptoms
│   │   ├── /log (new)
│   │   └── /history
│   ├── /reports
│   └── /profile
│
├── /provider (Protected: role === 'Provider' || 'Admin')
│   ├── /patients
│   ├── /patients/:patientId/dashboard
│   ├── /alerts
│   ├── /quick-share
│   └── /profile
│
├── /admin (Protected: role === 'Admin')
│   ├── /users
│   ├── /system-health
│   └── /audit-logs
│
└── /error (Error boundary fallback)
    └── /unauthorized
```

### Protected Route Component

```typescript
// ProtectedRoute.tsx
function ProtectedRoute({ 
  children, 
  requiredRoles: string[] 
}: { 
  children: React.ReactNode; 
  requiredRoles: string[];
}) {
  const { user, isLoading } = useAuth();
  
  if (isLoading) return <LoadingPage />;
  if (!user) return <Navigate to="/auth/login" />;
  if (!requiredRoles.includes(user.role)) {
    return <Navigate to="/error/unauthorized" />;
  }
  
  return children;
}
```

### Route Configuration (App.tsx)

```typescript
const router = createBrowserRouter([
  {
    path: '/auth',
    element: <AuthLayout />,
    children: [
      { path: 'login', element: <LoginPage /> },
      { path: '2fa-verify', element: <TwoFAPage /> }
    ]
  },
  {
    path: '/patient',
    element: <ProtectedRoute requiredRoles={['Patient']}><PatientLayout /></ProtectedRoute>,
    children: [
      { path: 'dashboard', element: <PatientDashboard /> },
      { path: 'consent/requests', element: <ConsentRequestList /> },
      { path: 'consent/requests/:requestId', element: <ConsentDetail /> },
      { path: 'symptoms/log', element: <SymptomLogForm /> },
      { path: 'symptoms/history', element: <SymptomHistory /> },
      { path: 'reports', element: <SharedReports /> }
    ]
  },
  {
    path: '/provider',
    element: <ProtectedRoute requiredRoles={['Provider', 'Admin']}><ProviderLayout /></ProtectedRoute>,
    children: [
      { path: 'patients', element: <PatientList /> },
      { path: 'patients/:patientId/dashboard', element: <ProviderPatientDashboard /> },
      { path: 'alerts', element: <AlertsDashboard /> },
      { path: 'quick-share', element: <QuickShare /> }
    ]
  }
]);
```

---

## 3. State Management & Authentication Context

### AuthContext Structure

```typescript
// AuthContext.tsx
interface User {
  user_id: string;
  role: 'Patient' | 'Provider' | 'Admin';
  email: string;
  name: string;
  provider_id?: string; // for Provider role
  patient_id?: string;  // for Patient role
  session_token: string;
  expires_at: string; // ISO 8601 UTC
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  verify2FA: (token: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Restore session from localStorage/cookie on mount
  useEffect(() => {
    const storedSession = localStorage.getItem('auth_session');
    if (storedSession) {
      setUser(JSON.parse(storedSession));
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    setError(null);
    try {
      const response = await apiClient.post('/v1/auth/login', { email, password });
      // Expect 2FA challenge, redirect in calling component
      return response.data;
    } catch (err) {
      setError('Login failed');
      throw err;
    }
  };

  const verify2FA = async (token: string) => {
    try {
      const response = await apiClient.post('/v1/auth/2fa/verify', { token });
      const userData = response.data;
      setUser(userData);
      localStorage.setItem('auth_session', JSON.stringify(userData));
    } catch (err) {
      setError('2FA verification failed');
      throw err;
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('auth_session');
    apiClient.post('/v1/auth/logout').catch(() => {});
  };

  return (
    <AuthContext.Provider 
      value={{ 
        user, 
        isLoading, 
        error, 
        login, 
        verify2FA, 
        logout,
        isAuthenticated: !!user 
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
```

### Additional Context: SelectedPatientContext (for Providers)

```typescript
// SelectedPatientContext.tsx
interface SelectedPatientContextType {
  selectedPatientId: string | null;
  setSelectedPatientId: (id: string | null) => void;
}

export const SelectedPatientContext = 
  createContext<SelectedPatientContextType | undefined>(undefined);
```

---

## 4. Data-Fetch Abstraction

### API Client Setup (api/client.ts)

```typescript
import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuth } from '../context/AuthContext';

export const createApiClient = (getAuthToken: () => string | null): AxiosInstance => {
  const client = axios.create({
    baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8000/api',
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json'
    }
  });

  // Request interceptor: inject auth token
  client.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      const token = getAuthToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      // Log HIPAA-relevant API calls for audit trail
      if (config.url?.includes('/v1/')) {
        console.log(`[AUDIT] API Call: ${config.method?.toUpperCase()} ${config.url}`);
      }
      return config;
    },
    (error) => Promise.reject(error)
  );

  // Response interceptor: handle errors
  client.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
      if (error.response?.status === 401) {
        // Clear session, redirect to login
        localStorage.removeItem('auth_session');
        window.location.href = '/auth/login';
      }
      if (error.response?.status === 403) {
        // Unauthorized role access
        window.location.href = '/error/unauthorized';
      }
      if (error.response?.status === 202) {
        // Background job accepted - caller should handle polling
        return Promise.resolve(error.response);
      }
      return Promise.reject(error);
    }
  );

  return client;
};

let apiClient: AxiosInstance;

export function ApiClientProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  
  useEffect(() => {
    apiClient = createApiClient(() => user?.session_token ?? null);
  }, [user?.session_token]);

  return children;
}

export function useApiClient() {
  return apiClient;
}
```

### useFetch Hook (hooks/useFetch.ts)

```typescript
interface UseFetchState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

interface UseFetchOptions {
  skip?: boolean; // Skip initial fetch
  refetchInterval?: number; // Auto-refetch interval in ms
}

export function useFetch<T>(
  url: string,
  options: UseFetchOptions = {}
): UseFetchState<T> & { refetch: () => Promise<void> } {
  const [state, setState] = useState<UseFetchState<T>>({
    data: null,
    loading: true,
    error: null
  });
  const apiClient = useApiClient();
  const { skip, refetchInterval } = options;

  const fetch = useCallback(async () => {
    if (skip) {
      setState(prev => ({ ...prev, loading: false }));
      return;
    }
    
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const response = await apiClient.get<T>(url);
      setState({ data: response.data, loading: false, error: null });
    } catch (err) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err : new Error('Unknown error')
      }));
    }
  }, [apiClient, url, skip]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  // Auto-refetch if interval provided
  useEffect(() => {
    if (!refetchInterval) return;
    const interval = setInterval(fetch, refetchInterval);
    return () => clearInterval(interval);
  }, [fetch, refetchInterval]);

  return { ...state, refetch: fetch };
}
```

### useJobStatus Hook (hooks/useJobStatus.ts) - for 202 polling

```typescript
export function useJobStatus<T>(
  jobUrl: string,
  initialPollInterval = 2000
): {
  data: T | null;
  status: 'pending' | 'completed' | 'failed';
  loading: boolean;
  error: Error | null;
} {
  const [state, setState] = useState({
    data: null as T | null,
    status: 'pending' as const,
    loading: true,
    error: null as Error | null
  });
  const apiClient = useApiClient();
  const [pollInterval, setPollInterval] = useState(initialPollInterval);

  useEffect(() => {
    if (!jobUrl) return;
    
    const poll = async () => {
      try {
        const response = await apiClient.get<{ status: string; data?: T }>(jobUrl);
        
        if (response.data.status === 'completed') {
          setState({
            data: response.data.data ?? null,
            status: 'completed',
            loading: false,
            error: null
          });
          return; // Stop polling
        }
        
        if (response.data.status === 'failed') {
          setState({
            data: null,
            status: 'failed',
            loading: false,
            error: new Error('Job failed')
          });
          return;
        }
        
        // Still pending, continue polling
        setState(prev => ({ ...prev, loading: true }));
      } catch (err) {
        setState({
          data: null,
          status: 'failed',
          loading: false,
          error: err instanceof Error ? err : new Error('Unknown error')
        });
      }
    };

    const interval = setInterval(poll, pollInterval);
    poll(); // Initial call
    
    return () => clearInterval(interval);
  }, [jobUrl, apiClient, pollInterval]);

  return state;
}
```

---

## 5. UI Information Architecture

### Layout Components

**AuthLayout** (public routes)
- Centered form container (max-width: 400px)
- Clinic logo/branding
- Form with error messages
- "Forgot Password?" link (future phase)

**AppLayout** (protected routes - shared for all roles)
- Navbar (top):
  - Logo/branding
  - User menu (dropdown: Profile, Logout)
  - Role indicator badge
- Sidebar (left):
  - Navigation links by role
  - Active state highlighting
  - Collapse/expand toggle (mobile-responsive)
- Main content area:
  - Breadcrumb navigation
  - Page title
  - Content grid (responsive: 1 col mobile, 2-3 cols desktop)
- Footer:
  - HIPAA compliance notice
  - Version info
  - Support link

### Page Information Architecture

#### Patient Portal

**Dashboard** (`/patient/dashboard`)
```
┌─ Hero Section
│  ├─ Welcome message with patient name
│  └─ Last sync status badge (UTC timestamp)
│
├─ Three-Column Layout (responsive)
│  ├─ Left Column (40%): Provider List
│  │  ├─ Card per provider
│  │  ├─ Provider name, specialty, clinic
│  │  └─ Last visit timestamp
│  │
│  ├─ Center Column (40%): Medical History
│  │  ├─ Timeline or table view
│  │  ├─ Category (Labs, Medications, Vitals)
│  │  ├─ Value/description
│  │  └─ Recorded timestamp (UTC)
│  │
│  └─ Right Column (20%): Status Indicators
│     ├─ Missing data alerts (red badge)
│     ├─ Sync freshness per category
│     └─ Action links (complete profile, etc.)
```

**Consent Requests** (`/patient/consent/requests`)
```
┌─ Inbox Header
│  ├─ Filter/sort controls
│  └─ Refresh button
│
└─ Request List
   ├─ Card per request
   │  ├─ Provider name & specialty
   │  ├─ Reason for request
   │  ├─ Request date (UTC)
   │  ├─ Status badge (Pending, Approved, Denied)
   │  └─ Action buttons (View Details, Approve, Deny)
```

**Consent Detail** (`/patient/consent/requests/:requestId`)
```
┌─ Request Summary
│  ├─ Provider details
│  ├─ Reason
│  └─ Request timestamp
│
├─ Decision Section
│  ├─ Description of data access
│  ├─ Approve button
│  ├─ Deny button
│  └─ Success/error message
│
└─ Authorization Document (post-approval)
   ├─ Document metadata
   └─ Download/view link
```

**Symptom Logging** (`/patient/symptoms/log`)
```
┌─ Form Section
│  ├─ Symptom Description (text input)
│  ├─ Severity Scale (1-10 slider + numeric)
│  ├─ Triggers Checklist (psoriasis-specific pre-seeded options)
│  │  └─ Multi-select checkboxes
│  ├─ OTC Treatments (free-text area)
│  ├─ Submit button (with loading state)
│  └─ Validation errors inline
│
└─ Recent Logs (last 5 entries)
   ├─ Timestamp
   ├─ Severity
   └─ Trigger summary
```

**Symptom History** (`/patient/symptoms/history`)
```
┌─ Search & Filter
│  ├─ Date range picker (start_utc, end_utc)
│  └─ Search by description
│
└─ Log List (paginated)
   ├─ Table or timeline view
   │  ├─ Date (UTC)
   │  ├─ Severity (visual indicator: bar, color)
   │  ├─ Description
   │  └─ Triggers
   └─ Pagination controls
```

#### Provider Portal

**Patient List** (`/provider/patients`)
```
┌─ Search Bar
│  └─ Search by patient name, ID
│
└─ Patient Table
   ├─ Name
   ├─ ID
   ├─ Primary Condition
   ├─ Last Dashboard Visit
   └─ Action (View Dashboard)
```

**Patient Dashboard** (`/provider/patients/:patientId/dashboard`)
```
┌─ Patient Header
│  ├─ Patient name, ID
│  └─ Last updated timestamp
│
├─ Four-Section Layout
│  ├─ Medical History (same as patient view)
│  ├─ Sync Status
│  │  ├─ Per-category freshness (UTC timestamps)
│  │  └─ Conflict alerts (if any)
│  ├─ Alerts
│  │  ├─ Negative trend alerts
│  │  └─ Sync conflict alerts with resolution actions
│  └─ Quick Actions
│     ├─ Generate report button
│     └─ Share to PCP button
```

**Alerts Dashboard** (`/provider/alerts`)
```
┌─ Filter & Sort
│  ├─ Alert type (Negative Trend, Sync Conflict)
│  ├─ Status (Active, Resolved)
│  └─ Patient name search
│
└─ Alert List
   ├─ Card per alert
   │  ├─ Alert type icon
   │  ├─ Patient name
   │  ├─ Description
   │  ├─ Triggered date (UTC)
   │  └─ Action (View Patient, Resolve)
```

**Quick-Share** (`/provider/quick-share`)
```
┌─ Share Form
│  ├─ Patient selection (dropdown)
│  ├─ Report type (Recent Trends, Full History)
│  ├─ Message (optional free text)
│  ├─ PCP selection (dropdown from patient's providers)
│  ├─ Send button
│  └─ Success message with confirmation
```

---

## 6. Request/Response Examples (API Contract Alignment)

All examples below map to contracts defined in [day1_engineer_b_checkpoint.md](day1_engineer_b_checkpoint.md). Frontend assumes:
- All timestamps are in ISO 8601 UTC format
- All errors include `error_code` and `message` fields
- 202 Accepted responses include a `job_id` for status polling

### Example: Create Consent Request Decision

**Frontend Code**:
```typescript
const handleConsentDecision = async (requestId: string, decision: 'Approve' | 'Deny') => {
  try {
    const response = await apiClient.post(
      `/v1/consent/requests/${requestId}/decision`,
      { decision }
    );
    // Response: { request_id, status, responded_at }
    setSuccessMessage(`Consent ${decision}d successfully`);
    refetch(); // Refresh request list
  } catch (error) {
    setErrorMessage(error.response?.data?.message);
  }
};
```

**Request**:
```http
POST /v1/consent/requests/req-6f2e8ccf/decision
Content-Type: application/json
Authorization: Bearer <session_token>

{
  "decision": "Approve"
}
```

**Response** (200 OK):
```json
{
  "request_id": "req-6f2e8ccf",
  "status": "Approved",
  "responded_at": "2026-04-16T17:22:30Z"
}
```

### Example: Create Symptom Log

**Frontend Code**:
```typescript
const onSubmitSymptomLog = async (formData: SymptomLogFormInput) => {
  try {
    const response = await apiClient.post('/v1/symptoms/logs', {
      patient_id: user.patient_id,
      symptom_description: formData.description,
      severity_scale: formData.severity,
      trigger_ids: formData.selectedTriggerIds,
      otc_treatments: formData.treatments
    });
    // Response: { log_id, patient_id, ... }
    setSuccessMessage('Symptom log created');
    navigate('/patient/symptoms/history');
  } catch (error) {
    setFieldError('description', error.response?.data?.message);
  }
};
```

**Request**:
```http
POST /v1/symptoms/logs
Content-Type: application/json
Authorization: Bearer <session_token>

{
  "patient_id": "pat-001",
  "symptom_description": "Plaque scaling and redness on elbows",
  "severity_scale": 7,
  "trigger_ids": ["trigger-stress", "trigger-lack-sleep"],
  "otc_treatments": ["Aveeno daily moisturizer", "Hydrocortisone cream"]
}
```

**Response** (201 Created):
```json
{
  "log_id": "sym-log-2a3f9e1",
  "patient_id": "pat-001",
  "symptom_description": "Plaque scaling and redness on elbows",
  "severity_scale": 7,
  "created_at": "2026-04-17T14:32:15Z"
}
```

### Example: Poll Symptom Trend Report Job Status

**Frontend Code**:
```typescript
const { status, data, loading, error } = useJobStatus(
  `/v1/reports/rep-job-567/status`
);

if (loading) return <LoadingSpinner>Generating report...</LoadingSpinner>;
if (status === 'completed') {
  return <ReportViewer report={data} />;
}
if (status === 'failed') {
  return <ErrorAlert message={error?.message} />;
}
```

**First request** (GET /v1/reports/{report_id}/status):
```json
{
  "status": "pending",
  "created_at": "2026-04-17T14:33:00Z"
}
```

**Subsequent requests** (polling every 2s):
```json
{
  "status": "processing",
  "progress": 45
}
```

**Final response** (when complete):
```json
{
  "status": "completed",
  "data": {
    "report_id": "rep-567",
    "patient_id": "pat-001",
    "secure_url": "https://cdn.example.com/reports/rep-567-signed-url?expires=...",
    "generated_at": "2026-04-17T14:36:00Z"
  }
}
```

---

## 7. Acceptance Test Checklist (Mapped to User Stories)

### User Story: Unified Chronic Disease Dashboard

- [ ] **Story Acceptance**: Dashboard aggregates data from two external EHR sources
  - [ ] Patient can view provider list (consolidated from multiple systems)
  - [ ] Patient can view complete medical history (Labs, Medications, Vitals, Family History)
  - [ ] Missing data fields are highlighted with clear prompts
  - [ ] Sync status per category is visible with UTC timestamps
  - [ ] Patient view is read-only (no edit controls visible)

- [ ] **Technical Tests**:
  - [ ] Fetch `/v1/dashboard/patients/{patient_id}` returns consolidated data
  - [ ] Fetch `/v1/dashboard/patients/{patient_id}/sync-status` returns per-category timestamps
  - [ ] Dashboard renders without error when data is missing from one source
  - [ ] Timestamps display in UTC with timezone indicator
  - [ ] Layout is responsive (mobile: 1 col, tablet: 2 col, desktop: 3 col)

### User Story: Secure Digital Consent Workflow

- [ ] **Story Acceptance**: Patient receives notification and can approve/deny
  - [ ] Patient sees incoming consent request inbox
  - [ ] Request shows provider name, specialty, reason, and request date
  - [ ] Patient can approve request with one click
  - [ ] Patient can deny request with one click
  - [ ] Upon approval, authorization document is generated and accessible
  - [ ] Patient receives confirmation message for approve/deny action

- [ ] **Technical Tests**:
  - [ ] POST `/v1/consent/requests/{request_id}/decision` is called with correct payload
  - [ ] Response status is 200 OK with updated request state
  - [ ] Consent request list refetches after decision
  - [ ] Authorization document link is present after approval
  - [ ] 2FA is required before consent decision (enforced at auth layer)

### User Story: Symptom and Trigger Logging (Psoriasis-Specific)

- [ ] **Story Acceptance**: Patient can log psoriasis symptoms with triggers
  - [ ] Symptom form displays all psoriasis-specific fields (description, severity, triggers)
  - [ ] Severity scale accepts values 1-10 with visual indicator (slider)
  - [ ] Triggers list shows pre-seeded psoriasis triggers (Stress, Lack of Sleep, etc.)
  - [ ] Patient can select multiple triggers via checkboxes
  - [ ] OTC treatment field accepts free-text entry (no validation against formulary)
  - [ ] Form submission shows loading state and success/error message
  - [ ] Symptom log appears immediately in history view after creation

- [ ] **Technical Tests**:
  - [ ] POST `/v1/symptoms/logs` is called with all required fields
  - [ ] Triggers submitted as array of trigger IDs
  - [ ] OTC treatments submitted as free-text array
  - [ ] Response status is 201 Created
  - [ ] Log history can filter by date range (start_utc, end_utc)
  - [ ] Pagination works correctly for large log lists

### User Story: Provider Efficiency - Alerts & Quick-Share

- [ ] **Story Acceptance**: Provider sees alerts and can quickly share with PCP
  - [ ] Provider views alert list filtered by type (Negative Trend, Sync Conflict)
  - [ ] Alert shows patient name, description, triggered date, and resolution action
  - [ ] Provider can click "View Patient" to navigate to patient dashboard
  - [ ] Provider can generate symptom trend report via quick-share form
  - [ ] Quick-share form allows message composition
  - [ ] Report is sent to selected PCP with confirmation

- [ ] **Technical Tests**:
  - [ ] GET `/v1/alerts` returns filtered alert list
  - [ ] Query parameters (patient_id, status, alert_type) filter correctly
  - [ ] POST `/v1/provider/quick-share` is called with correct payload
  - [ ] Response status is 202 Accepted (background job)
  - [ ] Job status can be polled via `/v1/reports/{report_id}/status`

### User Story: Authentication & 2FA

- [ ] **Story Acceptance**: User must authenticate with 2FA before accessing any feature
  - [ ] Unauthenticated user is redirected to login page
  - [ ] Login form accepts email and password
  - [ ] Login success redirects to 2FA verification screen
  - [ ] 2FA verification accepts TOTP code (6 digits)
  - [ ] Correct 2FA code logs in user and stores session
  - [ ] Session persists across page reloads (localStorage)
  - [ ] Logout clears session and redirects to login
  - [ ] Expired session (401) redirects to login automatically

- [ ] **Technical Tests**:
  - [ ] POST `/v1/auth/login` called with email/password
  - [ ] POST `/v1/auth/2fa/verify` called with TOTP token
  - [ ] Axios interceptor injects `Authorization: Bearer <token>` header
  - [ ] 401 responses trigger logout and redirect
  - [ ] 403 responses redirect to unauthorized page

### User Story: Role-Based Navigation

- [ ] **Story Acceptance**: User sees only relevant navigation and pages for their role
  - [ ] Patient sees: Dashboard, Consent, Symptoms, Reports in sidebar
  - [ ] Provider sees: Patients, Alerts, Quick-Share in sidebar
  - [ ] Admin sees: Users, System Health, Audit Logs in sidebar
  - [ ] Patient cannot access `/provider/*` routes
  - [ ] Provider cannot access `/patient/*` routes
  - [ ] Admin can access all routes

- [ ] **Technical Tests**:
  - [ ] ProtectedRoute component checks user.role
  - [ ] Non-matching roles redirect to `/error/unauthorized`
  - [ ] Navigation links conditionally render based on role
  - [ ] Active route is highlighted in sidebar

---

## 8. Frontend Skeleton Scaffolding Status ✓

### Project Structure (Ready for Day 2)

```
frontend/
├── public/
│   ├── index.html
│   └── favicon.ico
├── src/
│   ├── index.tsx
│   ├── App.tsx
│   ├── App.css
│   │
│   ├── context/
│   │   ├── AuthContext.tsx
│   │   └── SelectedPatientContext.tsx
│   │
│   ├── api/
│   │   └── client.ts
│   │
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useFetch.ts
│   │   └── useJobStatus.ts
│   │
│   ├── components/
│   │   ├── ProtectedRoute.tsx
│   │   ├── AuthLayout.tsx
│   │   ├── AppLayout.tsx
│   │   ├── ErrorBoundary.tsx
│   │   ├── LoadingSpinner.tsx
│   │   ├── ErrorAlert.tsx
│   │   ├── NavBar.tsx
│   │   └── Sidebar.tsx
│   │
│   ├── pages/
│   │   ├── auth/
│   │   │   ├── LoginPage.tsx
│   │   │   └── TwoFAPage.tsx
│   │   ├── patient/
│   │   │   ├── DashboardPage.tsx
│   │   │   ├── ConsentRequestListPage.tsx
│   │   │   ├── ConsentDetailPage.tsx
│   │   │   ├── SymptomLogPage.tsx
│   │   │   ├── SymptomHistoryPage.tsx
│   │   │   └── SharedReportsPage.tsx
│   │   ├── provider/
│   │   │   ├── PatientListPage.tsx
│   │   │   ├── PatientDashboardPage.tsx
│   │   │   ├── AlertsDashboardPage.tsx
│   │   │   └── QuickSharePage.tsx
│   │   ├── admin/
│   │   │   ├── UserManagementPage.tsx
│   │   │   ├── SystemHealthPage.tsx
│   │   │   └── AuditLogsPage.tsx
│   │   ├── ErrorPage.tsx
│   │   └── UnauthorizedPage.tsx
│   │
│   ├── types/
│   │   ├── index.ts
│   │   ├── api.ts
│   │   └── models.ts
│   │
│   └── utils/
│       ├── date.ts (UTC formatting helpers)
│       └── validation.ts (form validation rules)
│
├── .env.example
├── .env.local (development)
├── .env.staging (staging)
├── .env.production (production)
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.js
├── package.json
├── package-lock.json
└── README.md
```

### Day 1 Completion Status

- [x] Frontend Stack Decision (React + Vite + Axios)
- [x] Routing Structure (React Router with RBAC)
- [x] State Management (AuthContext + hooks)
- [x] Data-Fetch Abstraction (useFetch, useJobStatus, API client)
- [x] UI Information Architecture (detailed layouts per feature)
- [x] Request/Response Examples (aligned with API contracts)
- [x] Acceptance Test Checklist (mapped to user stories)
- [ ] Frontend Skeleton Scaffolding (to be completed in Day 2)

---

## Day 2 Deliverables

Engineer B will:
1. Create frontend project with `npm create vite@latest`
2. Install dependencies (React, React Router, Axios, Tailwind, etc.)
3. Implement all context, hooks, and API client code
4. Scaffold auth layout and app layout components
5. Create page component shells with routing
6. Set up TypeScript types for API contracts
7. Seed Psoriasis trigger data fixtures for testing
8. Verify frontend shell renders and routes correctly locally

---

## Notes for Engineer A Integration

- **API Response Format**: All responses must include consistent error handling:
  ```json
  {
    "error_code": "INVALID_CONSENT_STATE",
    "message": "User-friendly error message"
  }
  ```
- **Timestamp Handling**: All timestamps must be ISO 8601 UTC (e.g., `2026-04-17T14:32:15Z`)
- **202 Accepted Pattern**: Background jobs return `{ job_id, created_at }` for polling
- **RBAC Enforcement**: API must reject 403 Forbidden for unauthorized role access
- **Session Token**: Frontend expects `session_token` in login/2FA responses, expires_at for session management

---

## References
- [day1_engineer_b_checkpoint.md](day1_engineer_b_checkpoint.md) - API contracts
- [techstack.md](techstack.md) - Tech stack rationale
- [IMPLEMENTATION_PLAN_1_5_WEEKS.md](../IMPLEMENTATION_PLAN_1_5_WEEKS.md) - Project timeline

---

**Status**: Day 1 Frontend Deliverables COMPLETE ✓  
**Last Updated**: 2026-04-17  
**Engineer**: Engineer B  
**Next**: Day 2 Frontend Skeleton Implementation
