# Network Error Incident Report ("Netword Error")

Date: 2026-04-19
Project: EHRSystem

## Summary
The frontend showed a generic "Network Error" after startup because the backend API was not reachable from the host at that moment.

## What We Observed
- Frontend API client points to localhost API by default.
- Browser-side requests failed before receiving any HTTP response.
- Host probe to API failed initially:
  - GET http://localhost:8000/health/live -> Unable to connect to the remote server
- Docker service state initially showed only the database container running; API container was not up yet.

## Root Cause
The API service was unavailable during startup, so requests from the frontend to port 8000 could not connect. Axios surfaced this as a generic "Network Error".

## What Was Done To Fix It
1. Started missing backend services:
   - docker compose up -d api worker redis
2. Verified container status:
   - docker compose ps
3. Verified API liveness from host:
   - GET http://localhost:8000/health/live
4. Verified a real application endpoint used by the frontend:
   - POST http://localhost:8000/api/v1/auth/login

## Verification Results After Fix
- Health endpoint responded successfully:
  - {"status":"ok","service":"api","environment":"development"}
- Auth login endpoint responded successfully with challenge payload:
  - {"challenge_id":"...","expires_at":"...","methods":["totp"]}

## Why The Error Appears As "Network Error"
Axios reports "Network Error" when the request cannot establish a connection at all (service down, port unreachable, DNS/URL mismatch, or blocked by network policy), rather than when the server returns a valid HTTP status code.

## Prevention Checklist
- Start required services before frontend testing:
  - docker compose up -d db redis api worker
- Confirm API is healthy before opening the app:
  - http://localhost:8000/health/live
- Check container states when errors occur:
  - docker compose ps
- If frontend is started in staging/production mode, confirm VITE_API_URL is valid for that environment.

## Quick Recovery Commands
Run from repository root:

```powershell
docker compose up -d db redis api worker
docker compose ps
Invoke-WebRequest -UseBasicParsing http://localhost:8000/health/live
```
