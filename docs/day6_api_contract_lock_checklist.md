## Day 6 API Contract Lock Checklist (Engineer A + Engineer B)

Purpose: lock frontend-backend payload and behavior for sync freshness and conflict alerts before midday checkpoint.

### Endpoints in scope

1. GET /v1/dashboard/patients/{patient_id}/sync-status
2. GET /v1/alerts

### Endpoint 1: Sync Status Contract

Route source: ehrsystem/api.py (get_patient_dashboard_sync_status)

Required response shape:

```json
{
  "patient_id": "pat-1",
  "sync_status": [
    {
      "category": "Medications",
      "last_synced_at": "2026-04-12T08:00:00+00:00",
      "system_id": "sys-epic",
      "system_name": "Epic"
    }
  ]
}
```

Field rules to confirm:

1. patient_id: string, required
2. sync_status: array, required, may be empty
3. sync_status[].category: string, required
4. sync_status[].last_synced_at: ISO-8601 UTC string, required
5. sync_status[].system_id: string, required
6. sync_status[].system_name: string, required

Authorization and access behavior to confirm:

1. Allowed roles: Patient, Provider, Admin
2. Patient can only access own patient_id
3. Provider/Admin can access selected patient_id

Error behavior to lock:

1. 403 when patient requests another patient_id
2. 404 when patient sync status not found

### Endpoint 2: Alerts Contract

Route source: ehrsystem/api.py (list_alerts)

Required response shape:

```json
{
  "alerts": [
    {
      "alert_id": "alert-1",
      "alert_type": "SyncConflict",
      "patient_id": "pat-1",
      "provider_id": "prov-pcp",
      "description": "Medication mismatch detected between Epic and NextGen.",
      "status": "Active",
      "triggered_at": "2026-04-12T09:00:00+00:00",
      "system_id": "sys-epic"
    }
  ],
  "total": 1,
  "page": 1,
  "page_size": 1
}
```

Field rules to confirm:

1. alerts: array, required
2. alerts[].alert_id: string, required
3. alerts[].alert_type: enum values in Day 6 scope: SyncConflict, NegativeTrend
4. alerts[].patient_id: string, required
5. alerts[].provider_id: string, required in current backend payload
6. alerts[].description: string, required
7. alerts[].status: enum values used currently: Active, Resolved
8. alerts[].triggered_at: ISO-8601 UTC string, required
9. alerts[].system_id: string, present in backend payload and should remain stable
10. total/page/page_size: number, required

Authorization and access behavior to confirm:

1. Allowed roles: Provider, Admin
2. Patient role is denied

### Current frontend type alignment checks

1. frontend/src/types/api.ts has DashboardSyncStatus and SyncStatus matching sync-status payload
2. frontend/src/types/api.ts Alert type includes required system_id to match backend payload
3. backend alert_type generation is normalized to canonical values: SyncConflict and NegativeTrend

Decision to lock now:

1. Keep system_id in backend as stable field for SyncConflict alerts
2. Keep system_id required in frontend Alert type
3. Lock alert_type enum values to SyncConflict and NegativeTrend across backend generation and API payloads

### Drift resolution summary (completed)

1. Resolved enum drift where backend-generated alerts could emit Data Conflict/Negative Trend labels
2. Backend now emits canonical alert_type values (or normalizes legacy labels in API payload assembly)
3. Frontend Alert typing now requires system_id, matching API payload contract

### Contract lock acceptance criteria

1. Both engineers agree required fields and enum values above
2. Both engineers agree role access matrix and error codes
3. Example responses are copied into test fixtures for provider dashboard and alerts views
4. No same-day drift in key names or datetime format

### Midday checkpoint evidence to attach

1. Passing tests:
   - frontend/src/pages/provider/PatientDashboardPage.test.tsx
   - frontend/src/pages/provider/AlertsDashboardPage.test.tsx
2. Demo screenshots or live demo:
   - category-level sync freshness in provider dashboard
   - SyncConflict alerts visible and filterable
3. This signed-off contract checklist

### Sign-off

1. Engineer A sign-off: [X]
2. Engineer B sign-off: [X]
3. Sign-off date (UTC): 2026-04-21
4. Deferred follow-ups (if any): __________________
