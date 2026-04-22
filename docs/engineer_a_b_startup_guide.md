# Engineer A + Engineer B Startup Guide

Date: 2026-04-22
Project: EHRSystem

## Goal
Start backend and frontend in a reliable order so the app can run on any developer device, including fresh machines that do not yet have prerequisites installed.

## Recommended Setup
- Run backend once per machine: Docker services on port 8000.
- Run frontend per developer machine: Vite on port 5173 (or 5174 if 5173 is occupied).

If both engineers are on separate machines, both should run all steps locally.
If both engineers are on one machine, only one Vite dev server is needed.

## Prerequisites (Install If Missing)

Required:
- Git
- Docker (Desktop on Windows/macOS, Engine + Compose plugin on Linux)
- Node.js 20+ and npm

Optional but recommended:
- Python 3.11+ (for local test execution outside Docker)

### Install Commands by OS

Windows (PowerShell, winget):

```powershell
winget install --id Git.Git -e
winget install --id Docker.DockerDesktop -e
winget install --id OpenJS.NodeJS.LTS -e
winget install --id Python.Python.3.11 -e
```

macOS (Homebrew):

```bash
brew install git
brew install --cask docker
brew install node
brew install python@3.11
```

Ubuntu/Debian:

```bash
sudo apt-get update
sudo apt-get install -y git nodejs npm python3 python3-venv
```

For Docker on Linux, follow official Docker Engine + Compose plugin instructions:
https://docs.docker.com/engine/install/

### Verify Prerequisites

Run these commands and confirm they print versions:

```powershell
git --version
docker --version
docker compose version
node -v
npm -v
python --version
```

If `docker compose` fails but `docker-compose` works, use `docker-compose` in all backend commands.

## Step 1: Clone and Initialize Workspace

If repository is not already present:

```bash
git clone <repo-url>
cd EHRSystem
```

Ensure root environment file exists:

PowerShell:

```powershell
if (!(Test-Path .env)) { Copy-Item .env.example .env }
```

Bash:

```bash
test -f .env || cp .env.example .env
```

## Step 2: Start Backend Services First

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
- api: up/healthy
- worker: up

## Step 3: Confirm API Is Reachable

PowerShell:

```powershell
Invoke-WebRequest -UseBasicParsing http://localhost:8000/health/live
```

Bash:

```bash
curl http://localhost:8000/health/live
```

Expected response contains:

```json
{"status":"ok","service":"api","environment":"development"}
```

Optional auth probe:

```powershell
Invoke-WebRequest -UseBasicParsing http://localhost:8000/api/v1/auth/login -Method Post -ContentType 'application/json' -Body '{"email":"patient@example.com","password":"Passw0rd!"}'
```

Expected: JSON with `challenge_id` and `expires_at`.

## Step 4: Configure Frontend API URL

In `frontend/.env.local`, ensure:

```env
VITE_API_URL=http://localhost:8000/api
```

If `frontend/.env.local` does not exist, create it.

## Step 5: Install Frontend Dependencies and Start Frontend

From `frontend` directory:

```powershell
npm ci
npm run dev
```

If `npm ci` fails because lockfile drift exists, run:

```powershell
npm install
npm run dev
```

Open browser:
- http://localhost:5173
- or the URL printed by Vite if 5173 is busy

## Step 6: Login Accounts For Engineer A / Engineer B

Use two different accounts to test parallel role access.

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

### Symptom: Docker command fails

Cause:
- Docker Desktop/Engine is not started or not installed correctly.

Fix:
1. Start Docker Desktop (or Docker service on Linux).
2. Re-run:

```powershell
docker version
docker compose version
```

### Symptom: "Network Error" on login

Cause:
- API is not running yet, or still starting.

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
- Wrong `VITE_API_URL` (for example staging URL during local dev).

Fix:
1. Set `VITE_API_URL=http://localhost:8000/api` in `frontend/.env.local`.
2. Restart Vite after env changes.

### Symptom: Port conflict (8000, 5432, 6379, or 5173)

Fix:
1. Stop conflicting processes/containers.
2. For frontend, use the alternate Vite URL shown in terminal (usually 5174).

### Symptom: Node version errors during frontend install/run

Cause:
- Node is too old for current frontend toolchain.

Fix:
1. Upgrade Node.js to current LTS (Node 20+).
2. Re-run `node -v` and then `npm ci`.

## One-Command Recovery Sequence

From repository root:

```powershell
docker compose up -d db redis api worker
docker compose ps
Invoke-WebRequest -UseBasicParsing http://localhost:8000/health/live
```

Then from `frontend` directory:

```powershell
npm run dev
```
