# EHR Frontend - Day 1 Scaffolding Complete

This is the frontend for the EHR Chronic Disease Management System.

## Project Structure

```
frontend/
├── public/              # Static assets
├── src/
│   ├── context/        # React Context (Auth, SelectedPatient)
│   ├── api/            # API client and configuration
│   ├── hooks/          # Custom hooks (useFetch, useJobStatus)
│   ├── components/     # Reusable UI components
│   ├── pages/          # Page components by role
│   ├── types/          # TypeScript type definitions
│   ├── utils/          # Utility functions
│   ├── App.tsx         # Main app with routing
│   ├── main.tsx        # React entry point
│   └── index.css       # Global styles
├── .env.example        # Environment variables template
├── vite.config.ts      # Vite configuration
├── tsconfig.json       # TypeScript configuration
├── tailwind.config.js  # Tailwind CSS configuration
└── package.json        # Dependencies

## Tech Stack

- **Framework**: React 18 + TypeScript
- **Build**: Vite (fast dev server, optimized builds)
- **Routing**: React Router v6 (nested routes, protected routes)
- **HTTP Client**: Axios (with auth interceptors)
- **State**: React Context API
- **Styling**: Tailwind CSS + CSS Modules
- **Forms**: React Hook Form
- **Testing**: Jest + React Testing Library

## Getting Started

### Installation

```bash
cd frontend
npm install
```

### Development

```bash
npm run dev
```

Server runs at `http://localhost:5173`

### Build

```bash
npm run build
```

### Testing

```bash
npm test
npm test:watch
```

## Environment Configuration

Copy `.env.example` to `.env.local` and update values:

```bash
VITE_API_URL=http://localhost:8000/api
VITE_API_TIMEOUT=30000
VITE_ENABLE_2FA=true
VITE_LOG_LEVEL=debug
```

## API Integration

All API calls go through the centralized Axios client in `src/api/client.ts`:
- **Authentication**: Automatic Bearer token injection
- **Error Handling**: 401/403/5xx error handling
- **HIPAA Auditing**: Logs sensitive API calls
- **202 Polling**: useJobStatus hook handles background job polling

## Routing Structure

### Auth Routes (Public)
- `/auth/login` - Login page
- `/auth/2fa-verify` - Two-factor authentication

### Patient Routes (Protected)
- `/patient/dashboard` - Unified chronic disease dashboard
- `/patient/consent/requests` - Consent request inbox
- `/patient/symptoms/log` - Log new symptom
- `/patient/symptoms/history` - View symptom logs
- `/patient/reports` - Shared reports

### Provider Routes (Protected)
- `/provider/patients` - Patient list
- `/provider/alerts` - Alerts dashboard
- `/provider/quick-share` - Share reports with PCP

## Components

### Layout Components
- `AuthLayout` - Public auth pages wrapper
- `AppLayout` - Main app layout (navbar, sidebar, content)
- `NavBar` - Top navigation with user menu
- `Sidebar` - Left navigation by role

### Utility Components
- `ProtectedRoute` - RBAC route guard
- `LoadingSpinner` - Loading state indicator
- `ErrorAlert` / `SuccessAlert` - User feedback

## Hooks

### useAuth()
Access authentication context:
```typescript
const { user, login, verify2FA, logout, isAuthenticated } = useAuth();
```

### useFetch<T>(url, options)
Fetch data with loading/error states:
```typescript
const { data, loading, error, refetch } = useFetch('/v1/dashboard/patients/pat-001');
```

### useJobStatus<T>(jobUrl)
Poll background job status for 202 Accepted responses:
```typescript
const { data, status, loading } = useJobStatus('/v1/reports/rep-567/status');
```

## Utilities

### Date Formatting (UTC)
```typescript
import { formatUtcTimestamp, getRelativeTime, isStale } from '@utils/date';

formatUtcTimestamp('2026-04-17T14:32:15Z'); // "Apr 17, 2026 14:32 UTC"
getRelativeTime('2026-04-17T14:32:15Z');    // "2 hours ago"
isStale(timestamp, 24);                      // Check if > 24 hours old
```

### Form Validation
```typescript
import { validateEmail, validatePassword, validationRules } from '@utils/validation';
```

## Next Steps (Day 2)

- [ ] Implement all page components with API integration
- [ ] Build consent workflow UI
- [ ] Build symptom logging form
- [ ] Build dashboard with provider aggregation
- [ ] Add unit tests for components
- [ ] Test auth flow end-to-end
- [ ] Set up staging deployment

---

**Status**: Day 1 Frontend Scaffolding COMPLETE ✓
**Last Updated**: 2026-04-17
**Next**: Day 2 Implementation
