# Engineer A + Engineer B Startup Guide

Date: 2026-04-19
Project: EHRSystem

## Goal
Start backend and frontend in a reliable order so both Engineer A and Engineer B can log in without connection or auth issues.

## Recommended Setup
- Run backend once (shared): Docker services on port 8000.
- Run frontend per developer machine: Vite on port 5173 (or 5174 if 5173 is occupied).

If both engineers are on separate machines, both should run these steps locally.
If both engineers are on one machine, only one Vite dev server is needed.

## Prerequisites
- Docker Desktop running
- Node.js + npm installed
- Repository cloned

## Step 1: Start Backend Services First
From repository root:

```powershell
docker compose up -d db redis api worker
```

Check containers:

```powershell
docker compose ps
```

Expected:
- db: healthy
- redis: healthy
- api: up (health starting/healthy, then healthy)
- worker: up

## Step 2: Confirm API Is Reachable
Run:

```powershell
Invoke-WebRequest -UseBasicParsing http://localhost:8000/health/live
```

Expected response contains:

```json
{"status":"ok","service":"api","environment":"development"}
```

Optional auth probe:

```powershell
Invoke-WebRequest -UseBasicParsing http://localhost:8000/api/v1/auth/login -Method Post -ContentType 'application/json' -Body '{"email":"patient@example.com","password":"Passw0rd!"}'
```

Expected: JSON with challenge_id and expires_at.

## Step 3: Configure Frontend API URL
In frontend environment config, ensure API points to local backend:

```env
VITE_API_URL=http://localhost:8000/api
```

For local development, use frontend/.env.local (create it if missing) or keep the default fallback in the client.

## Step 4: Start Frontend
From frontend directory:

```powershell
npm install
npm run dev
```

Open browser:
- http://localhost:5173
- or the URL printed by Vite if 5173 is busy

## Step 5: Login Accounts For Engineer A / Engineer B
Use any two different accounts to test parallel role access.

Common test credentials:
- Patient
  - email: patient@example.com
  - password: Passw0rd!
- Provider
  - email: provider@example.com
  - password: Passw0rd!
- Admin
  - email: admin@example.com
  - password: Passw0rd!

2FA code for all test users:
- 123456

Recommended split:
- Engineer A: patient@example.com
- Engineer B: provider@example.com

This avoids session confusion when validating role-based pages.

## Troubleshooting (Most Common)

### Symptom: "Network Error" on login
Cause:
- API not running yet, or still starting.

Fix:
1. Recheck containers:

```powershell
docker compose ps
```

2. Recheck health endpoint:

```powershell
Invoke-WebRequest -UseBasicParsing http://localhost:8000/health/live
```

3. Refresh frontend only after API health passes.

### Symptom: Frontend points to wrong API
Cause:
- Wrong VITE_API_URL (for example staging URL during local dev).

Fix:
- Set VITE_API_URL=http://localhost:8000/api
- Restart Vite after env changes.

### Symptom: Port conflict on 5173
Fix:
- Use the alternate Vite URL shown in terminal (usually 5174).
- Backend CORS already allows 5173 and 5174.

## One-Command Recovery Sequence
From repository root:

```powershell
docker compose up -d db redis api worker
docker compose ps
Invoke-WebRequest -UseBasicParsing http://localhost:8000/health/live
```

Then from frontend directory:

```powershell
npm run dev
```
