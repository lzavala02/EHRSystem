# Day 2 Joint Checkpoint (Engineer A + Engineer B)

This checkpoint provides the exact run order and verification queries for Day 2 migration and seed sign-off.

## Objective

Confirm that the combined Day 2 data model is applied and seeded end-to-end for:

- Engineer A scope: core entities and sync metadata.
- Engineer B scope: consent, alerts, symptom logs, triggers, treatments, report artifacts, secure messaging, and psoriasis trigger checklist fixtures.

## Exact Run Order

1. Apply Engineer A core schema migration:

```powershell
psql -d <database_name> -f db/migrations/20260417_core_schema.sql
```

2. Apply Engineer B feature schema migration:

```powershell
psql -d <database_name> -f db/migrations/20260417_engineer_b_day2_feature_schema.sql
```

3. Apply Engineer A seed script:

```powershell
psql -d <database_name> -f db/migrations/20260417_seed.sql
```

4. Apply Engineer B seed script:

```powershell
psql -d <database_name> -f db/migrations/20260417_engineer_b_day2_seed.sql
```

## Verification Queries (Sign-Off)

### 1) Required tables exist

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'providers',
    'patients',
    'ehr_systems',
    'medical_record_items',
    'sync_metadata',
    'symptom_logs',
    'triggers',
    'treatments',
    'access_requests',
    'alerts',
    'report_artifacts',
    'secure_messages'
  )
ORDER BY table_name;
```

Expected: 12 rows returned.

### 2) Required enum types exist

```sql
SELECT typname
FROM pg_type
WHERE typname IN (
  'protocol_type',
  'sync_direction',
  'access_request_status',
  'alert_status',
  'alert_type'
)
ORDER BY typname;
```

Expected: 5 rows returned.

### 3) Engineer A seed baseline is present

```sql
SELECT
  (SELECT COUNT(*) FROM providers WHERE name = 'Dr. Ada Platform') AS provider_count,
  (SELECT COUNT(*) FROM patients WHERE full_name = 'Jordan Patient') AS patient_count,
  (SELECT COUNT(*) FROM ehr_systems WHERE system_name IN ('Epic', 'NextGen')) AS ehr_system_count,
  (SELECT COUNT(*) FROM sync_metadata) AS sync_metadata_count;
```

Expected: `provider_count >= 1`, `patient_count >= 1`, `ehr_system_count >= 2`, `sync_metadata_count >= 1`.

### 4) Psoriasis trigger checklist is seeded

```sql
SELECT trigger_name
FROM triggers
WHERE trigger_name IN (
  'Stress',
  'Lack of Sleep',
  'Scented Products',
  'Dry Weather',
  'Skin Injury',
  'Infection',
  'Smoking',
  'Alcohol'
)
ORDER BY trigger_name;
```

Expected: 8 rows returned.

### 5) Engineer B workflow seed fixtures are present

```sql
SELECT
  (SELECT COUNT(*) FROM access_requests WHERE status = 'Pending') AS pending_access_requests,
  (SELECT COUNT(*) FROM alerts WHERE alert_type = 'Missing Data' AND status = 'Active') AS active_missing_data_alerts;
```

Expected: both counts `>= 1`.

### 6) UTC-aware timestamps are populated in key Day 2 tables

```sql
SELECT
  (SELECT COUNT(*) FROM ehr_systems WHERE last_synced_at IS NOT NULL) AS ehr_with_sync_ts,
  (SELECT COUNT(*) FROM sync_metadata WHERE last_synced_at IS NOT NULL) AS metadata_with_sync_ts,
  (SELECT COUNT(*) FROM access_requests WHERE requested_at IS NOT NULL) AS access_requests_with_ts,
  (SELECT COUNT(*) FROM alerts WHERE created_at IS NOT NULL) AS alerts_with_ts;
```

Expected: all counts `>= 1` after seeds.

## Optional: one-shot SQL runner

If you want a single invocation after the four scripts complete:

```powershell
psql -d <database_name> -c "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('providers','patients','ehr_systems','medical_record_items','sync_metadata','symptom_logs','triggers','treatments','access_requests','alerts','report_artifacts','secure_messages') ORDER BY table_name;"
```

## Day 2 Joint Sign-Off Checklist

- [ ] Engineer A migration applied successfully.
- [ ] Engineer B migration applied successfully.
- [ ] Engineer A seed applied successfully.
- [ ] Engineer B seed applied successfully.
- [ ] All verification queries return expected results.
- [ ] Ready to proceed to Day 3 security/API scaffolding.
