# Day 5 Engineer A Checkpoint

This checkpoint captures Day 5 platform/integration ownership completed by Engineer A and prepared for Engineer B handoff.

## Day 5 Objectives Completed

### A) Epic and NextGen adapter base flows for bidirectional push/pull

Implemented explicit Day 5 adapter classes and wired push/pull behavior through the shared sync service.

- Added `EpicAdapter` and `NextGenAdapter` in `ehrsystem/sync.py`.
- Extended adapter identity to include stable `system_id` values (`sys-epic`, `sys-nextgen`).
- Added `sync_patient_bidirectional()` orchestration path (pull, conflict detect, alert generation, push).

### B) Per-category last-synced timestamps in UTC

Implemented and verified UTC timestamp tracking by patient and category.

- Sync service already stored timezone-aware UTC timestamps; this remains enforced in Day 5 path.
- Added system-id-aware metadata projection in `get_sync_metadata_records()`.
- API now bootstraps sync status using live adapter/service output instead of static-only fixture values.

### C) Conflict detection and alert hooks

Connected sync conflicts to provider alert generation.

- Added Day 5 sync conflict orchestration using `ProviderAlertService.create_data_conflict_alert()`.
- Added fallback conflict alert generation when no alert service is injected.
- API startup now executes sync bootstrap and appends generated conflict alerts into provider alerts feed.

### D) Frontend runtime config hardening for multi-environment safety

Hardened frontend API runtime behavior for dev/staging/prod environments.

- Added `normalizeApiBaseUrl()` in `frontend/src/api/client.ts`:
  - trims trailing slashes
  - enforces `/api` suffix
  - defaults to same-origin `/api` when `VITE_API_URL` is unset
- Added `parseTimeout()` bounds in `frontend/src/api/client.ts` with safe min/max fallback.
- Added unit tests in `frontend/src/api/client.test.ts`.

## Engineer B Handoff Notes

- Dashboard freshness endpoint now reflects sync service output per category:
  - `GET /v1/dashboard/patients/{patient_id}/sync-status`
- Alerts endpoint now includes sync-generated conflict alerts during API bootstrap:
  - `GET /v1/alerts`
- Expected conflict alert types in current payloads:
  - legacy seeded: `SyncConflict`
  - Day 5 generated: `Data Conflict`

## Tests Added/Updated

- Updated: `tests/unit/test_sync.py`
  - added Epic/NextGen bidirectional push coverage
  - validated metadata system id is `sys-epic`
  - validated conflict-to-provider-alert hook path
- Added: `tests/unit/test_day5_engineer_a.py`
  - validates sync-status endpoint category UTC timestamps
  - validates alerts endpoint includes sync conflict alerts
- Added: `frontend/src/api/client.test.ts`
  - validates runtime config normalization and timeout guardrails

## Files Updated

- `ehrsystem/sync.py`
- `ehrsystem/api.py`
- `ehrsystem/__init__.py`
- `tests/unit/test_sync.py`

## Files Added

- `tests/unit/test_day5_engineer_a.py`
- `frontend/src/api/client.test.ts`
- `docs/day5_engineer_a_checkpoint.md`
