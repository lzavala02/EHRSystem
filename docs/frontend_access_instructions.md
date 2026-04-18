# Frontend Access Instructions for Engineer A

Use these steps to access the project frontend locally.

## Local Startup

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

## Backend Connection

If the backend is running on a different host or port, update `VITE_API_URL` in the frontend environment file before restarting the dev server.

## Notes

- The frontend lives in the [frontend](../frontend) directory.
- A production build also works from `frontend` with `npm run build`.