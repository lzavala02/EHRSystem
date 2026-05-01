# Data Storage and Retrieval Testing Guide (Living Document)

This document is the running source of truth for verifying that data is stored and retrieved correctly throughout implementation.

Use this document in every checkpoint. Update it as features are added so testing stays aligned with the current codebase.

## Goal

Confirm, at each milestone, that:

- Data writes persist in PostgreSQL as expected.
- Data reads return correct records and shape.
- UTC timestamp and relational integrity expectations are met.
- Unit and feature-level tests continue to pass after changes.

## How to Use This Document

For each implementation day:

1. Run the baseline environment checks.
2. Run the storage/retrieval checks listed for that day.
3. Capture outcomes in the Update Log section.
4. Add any new feature-specific checks introduced that day.

## Baseline Environment Checks

From project root:

```powershell
docker compose up -d db
docker compose exec -T db pg_isready -U ehr -d ehrsystem
```

If the database is not ready, inspect logs:

```powershell
docker compose logs --tail 80 db
```

## Day 2 Baseline: Migration and Seed Validation (Current)

Reference checkpoint:

- docs/day2_joint_checkpoint.md
- docs/day3_engineer_b_checkpoint.md

### Migration and Seed Execution Order

```powershell
Get-Content -Raw db/migrations/20260417_core_schema.sql | docker compose exec -T db psql -U ehr -d ehrsystem
Get-Content -Raw db/migrations/20260417_engineer_b_day2_feature_schema.sql | docker compose exec -T db psql -U ehr -d ehrsystem
Get-Content -Raw db/migrations/20260417_seed.sql | docker compose exec -T db psql -U ehr -d ehrsystem
Get-Content -Raw db/migrations/20260417_engineer_b_day2_seed.sql | docker compose exec -T db psql -U ehr -d ehrsystem
```

### Day 2 Sign-Off Queries

Run all verification queries from docs/day2_joint_checkpoint.md.

Expected outcomes:

- Required tables exist: 12 rows.
- Required enum types exist: 5 rows.
- Engineer A seed baseline present: provider_count >= 1, patient_count >= 1, ehr_system_count >= 2, sync_metadata_count >= 1.
- Psoriasis triggers seeded: 8 rows.
- Engineer B workflow fixtures present: pending access requests >= 1 and active missing-data alerts >= 1.
- UTC timestamps present in key Day 2 tables.

### Current Verified Result (2026-04-17)

Validated in this workspace:

- Q1 table count: 12
- Q2 enum count: 5
- Q3 seed baseline: 1|1|2|2
- Q4 trigger count: 8
- Q5 workflow counts: 1|1
- Q6 timestamp counts: 2|2|1|1

## Application-Level Retrieval Validation

Even before full feature APIs are completed, validate retrieval logic in service-layer tests.

Run current unit suite:

```powershell
./.venv/Scripts/python.exe -m pytest tests/unit -q
```

Current verified result (2026-04-17):

- 13 passed

## Frontend Validation (Matching Implementation Plan)

Use this section to validate production frontend behavior as UI features are implemented.

### Core Frontend Data Validation Checklist

- Loading state appears before retrieval completes.
- Empty state appears when no data exists.
- Error state appears on retrieval/write failure and exposes retry action.
- Success state reflects newly stored data after create/update flows.
- UTC-related timestamps are rendered consistently for all users.
- Role-aware navigation and view access are enforced for Patient, Provider, and Admin.

### Milestone-Aligned Frontend Checks

- Day 3: Login + role-aware routing works and unauthorized routes are blocked.
- Day 4: Consent request/approve/deny UI reflects persisted backend state transitions.
- Day 5-6: Dashboard UI shows consolidated sources, missing-data prompts, sync freshness, and conflict alerts.
- Day 7: Symptom logging form enforces psoriasis-specific fields and shows persisted data on retrieval.
- Day 8: Report generation and quick-share UI correctly reflects queued/ready/error states.
- Day 9: Frontend regression and cross-browser smoke checks pass for core user journeys.
- Day 10: Production build verification confirms all release-gate UI journeys are operational.

### Frontend Regression Minimum (Each Checkpoint)

- Consent workflow journey is pass.
- Dashboard retrieval journey is pass.
- Symptom logging journey is pass.
- Provider quick-share journey is pass.

Record each journey result as Pass/Fail with defect links and follow-up owner.

## Ongoing Update Template (Use for Every New Day)

Copy this section and fill it in for each new implementation day.

```markdown
## Day X Validation (YYYY-MM-DD)

### Scope Added
- Feature(s):
- Tables/columns/constraints added:
- API/service retrieval paths added:

### Storage Tests Run
- Migration(s):
- Seed/fixture scripts:
- Write-path checks:

### Retrieval Tests Run
- SQL query checks:
- API checks (if available):
- Service-layer/unit tests:

### Frontend Tests Run
- Screens/components validated:
- Data retrieval journeys validated:
- Data write/update journeys validated:
- Role-based access checks:
- Regression/smoke summary:

### Results
- Pass/Fail summary:
- Any mismatches or defects:
- Follow-up actions:
```

## Day 7 Validation (2026-04-22)

### Scope Added
- Feature(s): Psoriasis-specific symptom logging validation, OTC conditional requirement, trigger checklist enforcement, and symptom retrieval view filtering/summaries.
- Tables/columns/constraints added: No new Day 7 SQL migration recorded in this update; Day 2 schema/seed baseline remains the active foundation for symptom-related fixtures.
- API/service retrieval paths added: `GET /v1/symptoms/triggers` and `GET /v1/symptoms/logs`; write path validated through `POST /v1/symptoms/logs` contract and frontend submission flow.

### Storage Tests Run
- Migration(s): Not re-run in this Day 7 checkpoint entry (no new migration artifact recorded for this update).
- Seed/fixture scripts: Existing psoriasis trigger seed baseline reused (`PSORIASIS_TRIGGER_CHECKLIST`, expected 8 triggers).
- Write-path checks: Symptom form submission path validated via frontend tests that assert payload persistence contract shape and reset/success behavior.

### Retrieval Tests Run
- SQL query checks: Not re-run in this checkpoint entry.
- API checks (if available): Frontend retrieval path validated against symptom endpoints and response normalization for logs/triggers.
- Service-layer/unit tests: Python unit suite available and currently passing in workspace context (`tests/unit`: 40 passed).

### Frontend Tests Run
- Screens/components validated: `SymptomLogPage` and `SymptomHistoryPage`.
- Data retrieval journeys validated: Symptom history retrieval with severity-band filtering, trigger filtering, sort behavior, summary cards, and clear-filters flow.
- Data write/update journeys validated: Symptom log submission success plus psoriasis-specific validation blocks (non-psoriasis description, missing trigger, severity >= 8 without OTC).
- Role-based access checks: Patient-linked symptom flows validated in page tests/mocks; no new role regression noted in this Day 7 checkpoint.
- Regression/smoke summary: Targeted frontend symptom suites passing (`SymptomLogPage.test.tsx`, `SymptomHistoryPage.test.tsx`).

### Results
- Pass/Fail summary: Pass for Day 7 symptom logging and retrieval UI/test scope.
- Any mismatches or defects: None open in current Day 7 symptom test scope.
- Follow-up actions: Add explicit Day 7 DB-level persistence/retrieval SQL verification commands to this document if a migration or schema delta is introduced.

## Suggested Retrieval Test Expansion by Milestone

As implementation progresses, extend this file with specific checks:

- Day 3: Auth/RBAC read access boundaries for Patient/Provider/Admin.
- Day 4: Consent workflow state transitions and document retrieval.
- Day 5-6: Sync metadata read consistency by category and source system.
- Day 7: Psoriasis symptom payload validation and persisted retrieval fidelity.
- Day 8: Report artifact generation persistence and secure message retrieval.
- Day 9-10: Audit-log retrieval for critical actions and release-gate regression checks.

## Ownership

- Primary owner: Engineer B (clinical workflow validation)
- Supporting owner: Engineer A (platform/integration validation)

Both engineers should update this document at each joint checkpoint.