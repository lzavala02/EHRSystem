# Day 1 Engineer B Checkpoint

This checkpoint fulfills Day 1 product-feature planning deliverables for Engineer B:

- API contract outlines for consent, dashboard, symptom logging, alerts, and reports.
- Acceptance-test checklist mapped to user stories.
- Request/response examples for contract alignment before endpoint implementation.

## Contract-First Endpoint Map (Day 1 Baseline)

All feature endpoints below are planning baseline contracts for implementation starting Day 3 and beyond. Payloads and status codes are defined here so Engineer A and Engineer B can work in parallel with stable interfaces.

### Consent Workflow

- `POST /v1/consent/requests`
  - Purpose: Provider requests patient data access.
  - Auth roles: `Provider`
  - Request fields: `patient_id`, `provider_id`, `reason`
  - Success response: `201 Created` with access request record.

- `POST /v1/consent/requests/{request_id}/notify`
  - Purpose: Trigger immediate patient notification.
  - Auth roles: `System`, `Provider`
  - Success response: `202 Accepted`.

- `POST /v1/consent/requests/{request_id}/decision`
  - Purpose: Patient approves or denies request.
  - Auth roles: `Patient`
  - Request fields: `decision` (`Approve` or `Deny`)
  - Success response: `200 OK` with updated request state.

- `POST /v1/consent/requests/{request_id}/authorization-document`
  - Purpose: Generate HIPAA authorization artifact after approval.
  - Auth roles: `System`, `Provider`
  - Success response: `201 Created` with document metadata.

### Unified Dashboard

- `GET /v1/dashboard/patients/{patient_id}`
  - Purpose: Read consolidated dashboard snapshot.
  - Auth roles: `Patient`, `Provider`, `Admin`
  - Success response: `200 OK` with providers, history, missing-data markers.

- `GET /v1/dashboard/patients/{patient_id}/sync-status`
  - Purpose: Read per-category last-synced timestamps in UTC.
  - Auth roles: `Patient`, `Provider`, `Admin`
  - Success response: `200 OK` with category-level freshness.

### Symptom and Trigger Logging (Psoriasis Scope)

- `POST /v1/symptoms/logs`
  - Purpose: Create a psoriasis symptom log.
  - Auth roles: `Patient`
  - Request fields: `patient_id`, `symptom_description`, `severity_scale`, `trigger_ids`, `otc_treatments`
  - Success response: `201 Created` with new log.

- `GET /v1/symptoms/logs`
  - Purpose: Read symptom logs for a patient and period.
  - Auth roles: `Patient`, `Provider`, `Admin`
  - Query fields: `patient_id`, `start_utc`, `end_utc`
  - Success response: `200 OK` with paged log list.

- `POST /v1/symptoms/reports/trend`
  - Purpose: Generate symptom trend report payload for PDF pipeline.
  - Auth roles: `Provider`, `Admin`
  - Request fields: `patient_id`, `period_start`, `period_end`
  - Success response: `202 Accepted` with report job metadata.

### Alerts and Provider Efficiency

- `GET /v1/alerts`
  - Purpose: Read active alerts, including negative trend and sync conflicts.
  - Auth roles: `Provider`, `Admin`, `Patient` (patient-scoped only)
  - Query fields: `patient_id`, `status`, `alert_type`
  - Success response: `200 OK` with alert list.

- `POST /v1/provider/quick-share`
  - Purpose: Share patient progress report to PCP.
  - Auth roles: `Provider`
  - Request fields: `patient_id`, `from_provider_id`, `to_provider_id`, `report_id`, `message`
  - Success response: `202 Accepted`.

### Reports

- `GET /v1/reports/{report_id}`
  - Purpose: Retrieve report metadata/status and secure URL for in-app access.
  - Auth roles: `Provider`, `Patient` (if shared), `Admin`
  - Success response: `200 OK` with report details.

## Request and Response Examples (Shared Alignment)

### Example A: Create Consent Request

Request:

```http
POST /v1/consent/requests
Content-Type: application/json

{
  "patient_id": "pat-001",
  "provider_id": "prov-derm-01",
  "reason": "Dermatology follow-up requires PCP medication history"
}
```

Response:

```json
{
  "request_id": "req-6f2e8ccf",
  "patient_id": "pat-001",
  "provider_id": "prov-derm-01",
  "status": "Pending",
  "requested_at": "2026-04-16T17:20:00Z"
}
```

### Example B: Patient Decision on Consent

Request:

```http
POST /v1/consent/requests/req-6f2e8ccf/decision
Content-Type: application/json

{
  "decision": "Approve"
}
```

Response:

```json
{
  "request_id": "req-6f2e8ccf",
  "status": "Approved",
  "responded_at": "2026-04-16T17:22:30Z"
}
```

### Example C: Dashboard Snapshot

Request:

```http
GET /v1/dashboard/patients/pat-001
```

Response:

```json
{
  "patient_id": "pat-001",
  "providers": [
    {
      "provider_id": "prov-pcp-01",
      "provider_name": "Dr. N. Patel",
      "specialty": "Primary Care",
      "clinic_affiliation": "North Clinic"
    },
    {
      "provider_id": "prov-derm-01",
      "provider_name": "Dr. A. Kim",
      "specialty": "Dermatology",
      "clinic_affiliation": "Skin Center"
    }
  ],
  "medical_history": [
    {
      "record_id": "rec-epic-101",
      "category": "Labs",
      "value_description": "CBC normal",
      "recorded_at": "2026-04-12T09:00:00Z",
      "system_id": "sys-epic"
    }
  ],
  "missing_data": [
    {
      "field_name": "Family History",
      "reason": "Family History is missing and should be confirmed with the patient."
    }
  ]
}
```

### Example D: Create Psoriasis Symptom Log

Request:

```http
POST /v1/symptoms/logs
Content-Type: application/json

{
  "patient_id": "pat-001",
  "symptom_description": "Plaque scaling and redness on elbows",
  "severity_scale": 7,
  "trigger_ids": ["trigger-stress", "trigger-lack-sleep"],
  "otc_treatments": [
    {
      "product_name": "Aveeno Eczema Therapy",
      "treatment_type": "Skincare"
    }
  ]
}
```

Response:

```json
{
  "log_id": "log-8b713a1b",
  "patient_id": "pat-001",
  "severity_scale": 7,
  "log_date": "2026-04-16T17:33:54Z"
}
```

### Example E: Trigger Trend Report Generation

Request:

```http
POST /v1/symptoms/reports/trend
Content-Type: application/json

{
  "patient_id": "pat-001",
  "period_start": "2026-03-16T00:00:00Z",
  "period_end": "2026-04-16T23:59:59Z"
}
```

Response:

```json
{
  "report_id": "rpt-f6a31b90",
  "status": "Queued",
  "queued_at": "2026-04-16T17:34:41Z"
}
```

## Acceptance-Test Checklist Mapped to User Stories

### Story 1: Cross-System Data Synchronization

- [ ] Verify push and pull operations can be initiated and return deterministic status payloads.
- [ ] Verify at least one FHIR and one HL7 adapter path are represented in test fixtures.
- [ ] Verify conflict events produce `Data Conflict` alerts visible through `GET /v1/alerts`.
- [ ] Verify `GET /v1/dashboard/patients/{patient_id}/sync-status` returns UTC timestamps per category.

### Story 2: Unified Chronic Disease Dashboard

- [ ] Verify dashboard response contains records sourced from at least two external systems.
- [ ] Verify care team list contains consolidated providers without duplicates.
- [ ] Verify complete history includes demographics and clinical categories.
- [ ] Verify missing data markers are present for incomplete patient fields.

### Story 3: Chronic Symptom and Trigger Logging (Psoriasis)

- [ ] Verify symptom payload requires psoriasis-oriented symptom description and severity range constraints.
- [ ] Verify triggers are limited to seeded checklist options (stress, lack of sleep, scented products baseline).
- [ ] Verify OTC treatment free-text entries are accepted and persisted.
- [ ] Verify trend report generation path returns queued/ready statuses and summary output.

### Story 4: Secure Digital Consent Workflow

- [ ] Verify provider can create consent request and patient receives notification event.
- [ ] Verify patient can only submit `Approve` or `Deny` decisions.
- [ ] Verify authorization document generation is blocked unless request status is `Approved`.
- [ ] Verify role-based and 2FA preconditions are enforced on consent decision operations.

### Story 5: Provider Efficiency and Proactive Alerts

- [ ] Verify auto-populate endpoint path returns prior visit fields for same patient-provider pair.
- [ ] Verify negative trend rule triggers provider alert after threshold is exceeded.
- [ ] Verify quick-share request creates auditable share event and returns accepted status.

## Joint Checkpoint Contribution (Engineer B)

- Contract-first endpoint map published for cross-team implementation.
- Shared request/response examples prepared for code and test alignment.
- Story-level acceptance-test checklist drafted for Day 3 and later execution.
