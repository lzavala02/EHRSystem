# Docker Deploy + Health Monitoring + CD (Render + UptimeRobot)

This runbook follows the required 3 steps in order.

## 1) Build and deploy the app as a Docker image

### Local build validation

From the repository root:

```powershell
docker build -t ehrsystem:local .
```

### Deploy target (Render)

This repository now includes a Render blueprint file at `render.yaml`.

1. Create a new Web Service in Render.
2. Connect this GitHub repository.
3. Use the Blueprint from `render.yaml` (recommended), or set Runtime to Docker manually.
4. If configuring manually, use this repository root and Dockerfile.
5. Set required environment variables (same values as .env, except local-only values).
6. Deploy.

After deploy, your base URL will look like:

- https://your-service-name.onrender.com

## 2) Health endpoint + UptimeRobot registration

The API now exposes a simple monitor endpoint:

- GET /health

Example full URL:

- https://your-service-name.onrender.com/health

### UptimeRobot setup

1. In UptimeRobot, click Add New Monitor.
2. Monitor Type: HTTP(s).
3. URL: https://your-service-name.onrender.com/health
4. Monitoring Interval: 5 minutes (or your preferred interval).
5. Alert contacts: add email/SMS/Slack as needed.
6. Save monitor and verify status turns Up.

## 3) Continuous Deployment with deployment hook

Workflow file added:

- .github/workflows/deploy.yml

Behavior:

1. On push to main, it builds Docker image from Dockerfile.
2. Pushes image tags to GitHub Container Registry:
   - ghcr.io/<owner>/ehrsystem:latest
   - ghcr.io/<owner>/ehrsystem:<commit-sha>
3. Calls a deployment hook URL from a GitHub Secret.

### Required GitHub secret

- DEPLOY_HOOK_URL: your Render deploy hook URL (or equivalent from another provider)

### Optional provider notes

- Render: use the service Deploy Hook URL.
- Other providers: use their equivalent webhook/hook endpoint.

If your provider supports image-based deploys from GHCR, configure it to pull:

- ghcr.io/<owner>/ehrsystem:latest
