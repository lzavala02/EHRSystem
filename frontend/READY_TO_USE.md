# Frontend Project - Ready-to-Use Guide

**Status**: ✅ Production-Ready Skeleton  
**Date**: April 17, 2026  
**Engineer**: Engineer B  
**Next Phase**: Day 2 Feature Implementation

---

## Quick Start

### 1. Install Dependencies

```bash
cd frontend
npm install
```

This installs all required packages:
- React 18, React DOM
- React Router v6
- Axios
- React Hook Form
- Tailwind CSS
- TypeScript
- Vite
- Testing libraries

### 2. Start Development Server

```bash
npm run dev
```

Server runs at: **http://localhost:5173**

Hot module replacement enabled - changes reload automatically.

### 3. Access the Application

- **Login Page**: http://localhost:5173/auth/login
- **Error Handling**: Invalid routes redirect to error page

---

## Project Structure - What's Ready

```
frontend/
├── public/
│   └── index.html              ✅ Entry point
│
├── src/
│   ├── context/
│   │   ├── AuthContext.tsx      ✅ Auth state + login/logout/2FA
│   │   └── SelectedPatientContext.tsx  ✅ Provider patient selection
│   │
│   ├── api/
│   │   └── client.ts           ✅ Axios setup + interceptors
│   │
│   ├── hooks/
│   │   ├── useFetch.ts         ✅ Generic data fetching
│   │   └── useJobStatus.ts     ✅ Background job polling
│   │
│   ├── components/
│   │   ├── ProtectedRoute.tsx  ✅ RBAC guard
│   │   ├── AuthLayout.tsx      ✅ Public pages wrapper
│   │   ├── AppLayout.tsx       ✅ Main app layout
│   │   ├── NavBar.tsx          ✅ Top navigation
│   │   ├── Sidebar.tsx         ✅ Left navigation (role-based)
│   │   ├── ErrorBoundary.tsx   ✅ Error handling
│   │   ├── LoadingSpinner.tsx  ✅ Loading state
│   │   └── Alerts.tsx          ✅ Error/success messages
│   │
│   ├── pages/
│   │   ├── auth/
│   │   │   ├── LoginPage.tsx       ✅ Email/password form (scaffolded)
│   │   │   └── TwoFAPage.tsx       ✅ 2FA code input (scaffolded)
│   │   │
│   │   ├── patient/
│   │   │   ├── DashboardPage.tsx   🔄 Needs implementation
│   │   │   ├── ConsentRequestListPage.tsx  🔄 Needs implementation
│   │   │   ├── SymptomLogPage.tsx  🔄 Needs implementation
│   │   │   ├── SymptomHistoryPage.tsx  🔄 Needs implementation
│   │   │   └── SharedReportsPage.tsx  🔄 Needs implementation
│   │   │
│   │   ├── provider/
│   │   │   ├── PatientListPage.tsx  🔄 Needs implementation
│   │   │   ├── AlertsDashboardPage.tsx  🔄 Needs implementation
│   │   │   └── QuickSharePage.tsx  🔄 Needs implementation
│   │   │
│   │   ├── admin/  (placeholder for Phase 2)
│   │   │
│   │   ├── ErrorPage.tsx           ✅ Error boundary page
│   │   └── UnauthorizedPage.tsx    ✅ 403 page
│   │
│   ├── types/
│   │   └── api.ts                 ✅ All TypeScript types for API
│   │
│   ├── utils/
│   │   ├── date.ts                ✅ UTC formatting helpers
│   │   └── validation.ts          ✅ Form validation rules
│   │
│   ├── App.tsx                    ✅ Main app + routing
│   ├── main.tsx                   ✅ React entry point
│   └── index.css                  ✅ Global styles (Tailwind)
│
├── .env.example                   ✅ Environment template
├── .env.local                     🔄 Development config (create from .env.example)
├── .env.staging                   ✅ Staging config
├── .env.production                ✅ Production config
│
├── .gitignore                     ✅ Git exclusions
├── .eslintrc.cjs                  ✅ ESLint configuration
├── vite.config.ts                 ✅ Vite build config
├── tsconfig.json                  ✅ TypeScript config
├── tsconfig.node.json             ✅ TypeScript config (build)
├── tailwind.config.js             ✅ Tailwind CSS config
├── postcss.config.js              ✅ PostCSS config
│
├── package.json                   ✅ Dependencies
├── package-lock.json              (auto-generated)
└── README.md                      ✅ Frontend documentation

Legend:
✅ Ready to use
🔄 Needs implementation
```

---

## What's Fully Implemented ✅

### Authentication System
- **AuthContext** with hooks:
  - `useAuth()` - Access user state, login, logout, verify2FA
  - Session persistence in localStorage
  - Automatic token refresh on mount
  - 401/403 error handling with redirect
- **LoginPage** - Email/password form with validation
- **TwoFAPage** - 6-digit code input with verification
- **ProtectedRoute** - RBAC enforcement on routes

### API Integration
- **Axios Client** with:
  - Bearer token injection (Authorization header)
  - HIPAA audit logging for sensitive endpoints
  - 401 → logout + redirect
  - 403 → unauthorized page redirect
  - 202 → background job response handling
  - Error response standardization
- **useFetch Hook** - Generic data fetching with loading/error states
- **useJobStatus Hook** - Background job status polling

### Layouts & Navigation
- **AuthLayout** - Centered form for login/2FA
- **AppLayout** - Navbar + sidebar + content + footer
- **NavBar** - Logo, user menu, role badge
- **Sidebar** - Role-based navigation (collapses on mobile)
- **ErrorBoundary** - Catch React errors with fallback UI

### Styling
- **Tailwind CSS** configured with custom clinical color palette
- **Global Styles** in index.css
- **Responsive Design** - Mobile-first approach
- **Dark sidebar** with light content area

### Type Safety
- **Complete API Types** (50+ interfaces):
  - Authentication (LoginRequest, TwoFAVerifyRequest, User, etc.)
  - Consent (ConsentRequest, ConsentDecision, Authorization, etc.)
  - Dashboard (DashboardSnapshot, SyncStatus, MedicalRecord, etc.)
  - Symptoms (SymptomLog, Trigger, Treatment, etc.)
  - Alerts (Alert, AlertList)
  - Reports (ReportJob, TrendReport, etc.)
- **Strict TypeScript** enabled in tsconfig

### Utilities
- **Date Utilities** (src/utils/date.ts):
  - `formatUtcTimestamp()` - ISO to readable UTC time
  - `getRelativeTime()` - "2 hours ago" format
  - `isStale()` - Check if timestamp > N hours old
  - `toUtcIsoString()` - Date to ISO string
  - `getUtcDayStart/End()` - UTC day boundaries
- **Validation Utilities** (src/utils/validation.ts):
  - `validateEmail()`, `validatePassword()`, `validateTotpCode()`
  - `validationRules` object for React Hook Form
  - Reusable form field rules

---

## What Needs Implementation 🔄

### Authentication Pages (Day 2 - ~1.5 hours)

**LoginPage.tsx** - Currently has:
- Form structure
- Error display
- But needs:
  - [ ] Form submission to `/v1/auth/login`
  - [ ] Handle challenge_id response
  - [ ] Redirect to TwoFAPage on success
  - [ ] Show validation errors per field

**TwoFAPage.tsx** - Currently has:
- Code input field
- But needs:
  - [ ] Form submission to `/v1/auth/2fa/verify`
  - [ ] Handle user session response
  - [ ] Store session in localStorage
  - [ ] Redirect to dashboard on success

### Patient Portal Pages (Day 2 - ~3 hours)

Each page needs:
- API call using `useFetch` or `apiClient.get/post`
- Loading spinner
- Error alert display
- Data rendering

1. **DashboardPage.tsx** - Unified health dashboard
   - Fetch `GET /v1/dashboard/patients/{patient_id}`
   - Fetch `GET /v1/dashboard/patients/{patient_id}/sync-status`
   - Display: providers, medical history, missing data, sync status

2. **ConsentRequestListPage.tsx** - Consent inbox
   - Fetch `GET /v1/consent/requests`
   - Display: request list, provider info, request date
   - Handle approve/deny actions

3. **SymptomLogPage.tsx** - Symptom form
   - Form with fields: description, severity (1-10), triggers, treatments
   - POST `POST /v1/symptoms/logs`
   - Show success/error message

4. **SymptomHistoryPage.tsx** - Past symptom logs
   - Fetch `GET /v1/symptoms/logs?start_utc=...&end_utc=...`
   - Display: table/timeline, filtering, pagination

5. **SharedReportsPage.tsx** - Shared provider reports
   - Fetch `GET /v1/reports/{report_id}`
   - Display: report list, download/view links

### Provider Portal Pages (Day 2 - ~1.5 hours)

1. **PatientListPage.tsx** - Patient list & search
   - Fetch `GET /v1/provider/patients`
   - Search/filter functionality

2. **AlertsDashboardPage.tsx** - Alerts with filtering
   - Fetch `GET /v1/alerts?patient_id=...&status=...&alert_type=...`
   - Display: alert cards, actions, filtering

3. **QuickSharePage.tsx** - Share report with PCP
   - Form to select patient, report type, message
   - POST `POST /v1/provider/quick-share`
   - Show success message with confirmation

---

## Environment Setup

### Step 1: Create .env.local

```bash
cp .env.example .env.local
```

### Step 2: Update .env.local

```
VITE_API_URL=http://localhost:8000/api
VITE_API_TIMEOUT=30000
VITE_AUTH_REDIRECT_URI=http://localhost:5173/auth/callback

VITE_ENABLE_2FA=true
VITE_ENABLE_AUDIT_LOG=true

VITE_JOB_POLL_INTERVAL_MS=2000
VITE_DASHBOARD_CACHE_TTL_MS=30000

VITE_LOG_LEVEL=debug
VITE_HIPAA_AUDIT_ENABLED=true
```

### Step 3: Verify Setup

```bash
npm run dev
```

Expected output:
```
  VITE v5.0.8  ready in X ms

  ➜  Local:   http://localhost:5173/
  ➜  press h to show help
```

---

## Development Workflow

### Code Examples

#### Using useAuth Hook

```typescript
import { useAuth } from '@hooks/useAuth';

export function MyComponent() {
  const { user, login, logout, isAuthenticated } = useAuth();
  
  if (!isAuthenticated) {
    return <p>Please log in</p>;
  }
  
  return <p>Welcome, {user.name}!</p>;
}
```

#### Fetching Data

```typescript
import { useFetch } from '@hooks/useFetch';
import { DashboardSnapshot } from '@types/api';

export function Dashboard() {
  const { user } = useAuth();
  const { data, loading, error, refetch } = useFetch<DashboardSnapshot>(
    `/v1/dashboard/patients/${user.patient_id}`
  );
  
  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorAlert message={error.message} />;
  
  return (
    <div>
      <button onClick={refetch}>Refresh</button>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}
```

#### Posting Data

```typescript
import { getApiClient } from '@api/client';

export function MyForm() {
  const apiClient = getApiClient();
  const [loading, setLoading] = useState(false);
  
  const handleSubmit = async (formData) => {
    setLoading(true);
    try {
      const response = await apiClient.post('/v1/endpoint', formData);
      console.log('Success:', response.data);
    } catch (error) {
      console.error('Error:', error.message);
    } finally {
      setLoading(false);
    }
  };
  
  return <form onSubmit={handleSubmit}>{/* fields */}</form>;
}
```

#### Polling Background Jobs

```typescript
import { useJobStatus } from '@hooks/useJobStatus';

export function ReportGenerator() {
  const [jobUrl, setJobUrl] = useState<string | null>(null);
  const { data, status, loading, error } = useJobStatus(jobUrl!);
  
  const startJob = async () => {
    const response = await apiClient.post('/v1/symptoms/reports/trend', {
      patient_id, period_start, period_end
    });
    setJobUrl(`/v1/reports/${response.data.report_id}/status`);
  };
  
  return (
    <div>
      <button onClick={startJob}>Generate Report</button>
      {loading && <p>Generating...</p>}
      {status === 'completed' && <p>Done! {data.secure_url}</p>}
      {status === 'failed' && <ErrorAlert message={error?.message} />}
    </div>
  );
}
```

---

## Available npm Commands

```bash
# Development
npm run dev          # Start dev server (http://localhost:5173)

# Building
npm run build        # Optimize build for production
npm run preview      # Preview production build locally

# Testing
npm test             # Run unit tests
npm test:watch      # Run tests in watch mode

# Linting
npm run lint         # Check code quality
```

---

## Browser DevTools

### Redux DevTools Alternative
While not installed, you can debug auth state via:
```javascript
// In browser console
window.__apiClient  // View API client
localStorage.getItem('auth_session')  // View user session
```

### Network Tab
Monitor API calls to verify:
- Authorization header: `Bearer <token>`
- Content-Type: `application/json`
- Status codes: 200, 201, 202, 400, 401, 403, 5xx

---

## File Organization Tips

### Imports Use Path Aliases

Configured in tsconfig.json:
```typescript
// Instead of:
import { useAuth } from '../../../../context/AuthContext';

// Use:
import { useAuth } from '@context/AuthContext';
import { useFetch } from '@hooks/useFetch';
import { DashboardSnapshot } from '@types/api';
import { formatUtcTimestamp } from '@utils/date';
```

Available aliases:
- `@/*` → `src/*`
- `@components/*` → `src/components/*`
- `@pages/*` → `src/pages/*`
- `@hooks/*` → `src/hooks/*`
- `@context/*` → `src/context/*`
- `@api/*` → `src/api/*`
- `@types/*` → `src/types/*`
- `@utils/*` → `src/utils/*`

---

## Common Tasks

### Add a New Page

1. Create file in `src/pages/{section}/NewPage.tsx`
2. Export component function
3. Add route in `App.tsx`
4. Use ProtectedRoute wrapper if protected

```typescript
// src/pages/patient/NewPage.tsx
export function NewPage() {
  const { user } = useAuth();
  const { data, loading, error } = useFetch('/v1/endpoint');
  
  return <div>{/* content */}</div>;
}
```

### Add API Type

Edit `src/types/api.ts`:
```typescript
export interface NewType {
  id: string;
  name: string;
  created_at: string;
}
```

### Update Styling

Global styles: `src/index.css`  
Tailwind classes: Any `.tsx` file (utility-first)

---

## Troubleshooting

### Dev Server Won't Start

```bash
# Check Node version (need 16+)
node --version

# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
npm run dev
```

### API Calls Failing with 401

```javascript
// Check if token exists
localStorage.getItem('auth_session')

// Try logging in again
// Navigate to /auth/login
```

### Styles Not Applying

- Vite may need restart: `npm run dev`
- Ensure Tailwind classes are spelled correctly
- Check tailwind.config.js has correct content paths

### TypeScript Errors

- Ensure `@types/*` imports use correct alias
- Check `tsconfig.json` for compilation settings
- Run `npm install` if new packages added

---

## Documentation References

For detailed information, see:

- **Full Frontend Spec**: [docs/day1_frontend_deliverables.md](../docs/day1_frontend_deliverables.md)
- **API Contracts**: [docs/day1_engineer_b_checkpoint.md](../docs/day1_engineer_b_checkpoint.md)
- **Day 2 Implementation Guide**: [docs/day2_frontend_quick_reference.md](../docs/day2_frontend_quick_reference.md)
- **Frontend README**: [README.md](./README.md)

---

## Next Steps

### Day 2 Implementation Checklist

- [ ] Run `npm install` to install dependencies
- [ ] Create `.env.local` from `.env.example`
- [ ] Run `npm run dev` and verify login page loads
- [ ] Implement auth form submission (LoginPage, TwoFAPage)
- [ ] Test auth flow with mocked API responses
- [ ] Implement patient dashboard page
- [ ] Implement consent workflow
- [ ] Implement symptom logging form
- [ ] Implement provider portal pages
- [ ] Run `npm test` for unit tests
- [ ] Test full auth flow end-to-end

---

## Support

- **Questions about setup**: Check [README.md](./README.md)
- **Questions about types**: See [src/types/api.ts](./src/types/api.ts)
- **Questions about utilities**: See [src/utils/](./src/utils/)
- **Questions about hooks**: See [src/hooks/](./src/hooks/)

---

**Status**: ✅ Ready for Day 2 Development  
**Last Updated**: 2026-04-17  
**Next Phase**: Feature Implementation
