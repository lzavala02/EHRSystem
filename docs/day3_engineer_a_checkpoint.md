# Day 3 Engineer A Checkpoint

This checkpoint tracks the Day 3 platform and security work for Engineer A and is aligned to the Day 3 work already completed by Engineer B:

- RBAC-protected feature API scaffolding for consent, dashboard reads, symptoms, reports, quick-share, and alerts.
- Frontend auth/session handling with role-aware navigation.
- Initial frontend unit tests for auth and route-boundary behavior.

Engineer A’s work on this day should complete the security baseline that makes those scaffolded routes safe to use in the next integration step.

## Scope to Deliver

### A) Mandatory 2FA Login Flow

- Implement the login flow with mandatory OTP/TOTP verification for all successful authenticated sessions.
- Ensure 2FA is required before any protected `/v1/*` or `/api/v1/*` route can be used.
- Keep the development/test path deterministic enough for unit coverage while preserving the production flow shape.

### B) RBAC Guardrails and Session Hardening

- Enforce Provider, Admin, and Patient role boundaries on the protected API surface.
- Add session/token hardening baseline for login, 2FA completion, and logout behavior.
- Make unauthorized access fail with the correct 401/403 response behavior for frontend routing logic.

### C) Frontend Auth Hardening Integration

- Verify that the frontend handles session expiry cleanly.
- Confirm role-aware navigation still routes authenticated users correctly after 2FA.
- Validate that route guards and unauthorized redirects remain compatible with Engineer B’s Day 3 UI scaffolding.

### D) Security Test Coverage

- Add backend unit tests for 2FA enforcement, protected route access, and role restrictions.
- Add coverage for session cleanup and expiry behavior where it affects authentication state.
- Verify that the new tests align with the Day 3 scaffold already present in `tests/unit/test_api_security_scaffolding.py`.

## Alignment With Engineer B

Engineer B has already established the feature endpoints and frontend role-navigation shape. Engineer A’s job on Day 3 is to make those paths secure and predictable:

- B’s scaffolded feature routes should remain the canonical contract for consent, dashboard, symptoms, reports, quick-share, and alerts.
- A’s auth work should not change those route shapes; it should only gate them more strictly.
- Frontend routing behavior should remain role-aware and compatible with 401/403 outcomes from the backend.

## Deliverables To Add Or Update

### Backend

- `ehrsystem/api.py` for auth/RBAC/2FA enforcement and protected route handling.
- `tests/unit/test_api_security_scaffolding.py` for security baseline coverage.

### Frontend Integration Notes

- Confirm role-aware redirect behavior in `frontend/src/App.tsx`.
- Confirm 2FA return and navigation flow in `frontend/src/context/AuthContext.tsx` and `frontend/src/pages/auth/TwoFAPage.tsx`.
- Confirm protected route behavior in `frontend/src/components/ProtectedRoute.tsx`.

## Smoke-Test Checklist

1. Start the backend and frontend in the normal local development setup.

2. Verify unauthenticated access is blocked:

```powershell
curl http://localhost:8000/v1/dashboard/patients/pat-001
```

3. Verify login requires 2FA before protected access is granted.

4. Verify an authenticated user with the wrong role receives the expected 403 behavior.

5. Verify the frontend routes authenticated users by role after 2FA completion.

6. Run the backend unit suite:

```powershell
./.venv/Scripts/python.exe -m pytest tests/unit -q
```

7. Run the frontend auth and protected-route tests:

```powershell
cd frontend
npm test -- --runInBand
```

## Validation Evidence (Completed 2026-04-18)

### Runtime and Endpoint Verification

- Backend health endpoint responded with HTTP 200 OK:
	- `GET http://127.0.0.1:8000/health/live`
- Login request succeeded and returned a valid `challenge_id` for 2FA.
- 2FA verification with development code `123456` succeeded and returned a valid `session_token`.
- Protected route access with bearer token succeeded:
	- `GET /v1/dashboard/patients/pat-1` returned patient dashboard payload.

### Automated Test Results

- Backend unit suite:
	- Command: `./.venv/Scripts/python.exe -m pytest tests/unit -q`
	- Result: `18 passed, 53 warnings in 0.78s`
- Frontend auth/route unit tests:
	- Command: `cd frontend && npm test -- --runInBand`
	- Result: `2 test suites passed, 5 tests passed`

### Local Dev Integration Notes

- Frontend API base URL uses `VITE_API_URL=http://localhost:8000/api` in `frontend/.env.local` to avoid duplicate path segments.
- Backend includes CORS middleware for local frontend origins (`localhost`/`127.0.0.1` on ports `5173` and `5174`) so browser login and 2FA flows work end-to-end.

## Day 3 Integration Checklist Output

- [X] Mandatory 2FA enforced for all login attempts.
- [X] RBAC enforced for Provider, Admin, and Patient boundaries.
- [X] Protected Day 3 feature routes remain compatible with Engineer B’s scaffold.
- [X] Frontend auth/session behavior remains stable after 2FA completion.
- [X] Backend security tests cover authentication and route protection behavior.
- [X] Day 3 ready to hand off into consent workflow integration on Day 4.

## Day 3 Joint Checkpoint Target

- Protected API surface available with auth and role checks passing.
- Frontend can authenticate and route by role.
- Day 4 can build directly on the existing Day 3 consent and dashboard scaffolding without changing the route contract.
