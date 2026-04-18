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