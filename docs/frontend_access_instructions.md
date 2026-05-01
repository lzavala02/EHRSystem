# Frontend Access Instructions for Engineer A

Use these steps to access the project frontend locally.

## Backend Startup (Required)

Start the backend API first so frontend login and data requests do not fail through the Vite proxy.

1. Open a terminal in the repository root.

```bash
cd .
```

2. Start the API using the project-local virtual environment.

```bash
./.venv/Scripts/python.exe -m uvicorn ehrsystem.api:app --host 127.0.0.1 --port 8000
```

3. Confirm backend health in a separate terminal.

```bash
curl http://127.0.0.1:8000/health/live
```

## Frontend Startup

1. Open a terminal in the repository and change into the frontend folder.

```bash
cd frontend
```

2. Install dependencies if they are not already installed.

```bash
npm install
```

3. Start the Vite development server.

```bash
npm run dev
```

4. Open the app in a browser at `http://localhost:5173`.

5. Keep both backend and frontend terminals running while testing navigation and interactions.

## Backend Connection

If the backend is running on a different host or port, update `VITE_API_URL` in the frontend environment file before restarting the dev server.

## Notes

- The frontend lives in the [frontend](../frontend) directory.
- A production build also works from `frontend` with `npm run build`.
- Login for the Test Client: email:patient@example.com, password: Passw0rd!, code: 123456