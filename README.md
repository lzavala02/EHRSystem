# EHRSystem
Patient Health Record (EHR) System for Chronic Disease Management in a Small Outpatient Clinic

The rising prevalence of chronic diseases and official diagnoses makes long-term treatment and management outside of hospitals critical. However, it is a challenge to remember all of the healthcare providers involved in chronic disease management, especially for those with multiple diagnoses. This web application presents a platform for both patients, their caregivers, and their healthcare providers to store and access patient information, demographics, medical history, diagnostics, prescriptions, and treatment plans, regardless of whether hospitals use large-scale EHR systems like Epic, Oracle Cerner, athenahealth, and NextGen. A critical aspect of this application would be updating patient information databases both at small clinics and at hospitals that use these large-scale EHR system, similar to updating remote and local repositories of GitHub.

---

# Logical Data Design

```mermaid
erDiagram
    providers ||--o{ patients : "is primary provider for"
    patients ||--o{ medical_record_items : "has"
    ehr_systems ||--o{ medical_record_items : "is source for"
    
    patients ||--o{ symptom_logs : "records"
    symptom_logs ||--o{ log_triggers : "contains"
    triggers ||--o{ log_triggers : "observed in"
    
    symptom_logs ||--o{ log_treatments : "contains"
    treatments ||--o{ log_treatments : "applied in"
    
    patients ||--o{ access_requests : "approves/denies"
    providers ||--o{ access_requests : "initiates"
    
    patients ||--o{ alerts : "notified of"
    providers ||--o{ alerts : "notified of"
    ehr_systems ||--o{ alerts : "generates sync"

    patients {
        uuid patient_id PK
        text full_name
        numeric height
        numeric weight
        text family_history
        text vaccination_record
        boolean two_factor_enabled
        uuid primary_provider_id FK
    }

    providers {
        uuid provider_id PK
        text name
        text specialty
        text clinic_affiliation
    }

    ehr_systems {
        uuid system_id PK
        text system_name
        protocol_type protocol
        timestamptz last_synced_at
    }

    medical_record_items {
        uuid record_id PK
        uuid patient_id FK
        uuid system_id FK
        text category
        text value_description
        timestamptz recorded_at
    }

    symptom_logs {
        uuid log_id PK
        uuid patient_id FK
        text symptom_description
        int severity_scale
        timestamptz log_date
    }

    triggers {
        uuid trigger_id PK
        text trigger_name
    }

    log_triggers {
        uuid log_id PK, FK
        uuid trigger_id PK, FK
    }

    treatments {
        uuid treatment_id PK
        text product_name
        text treatment_type
    }

    log_treatments {
        uuid log_id PK, FK
        uuid treatment_id PK, FK
    }

    access_requests {
        uuid request_id PK
        uuid patient_id FK
        uuid provider_id FK
        access_request_status status
        text authorization_document
        timestamptz requested_at
    }

    alerts {
        uuid alert_id PK
        alert_type alert_type
        text description
        uuid patient_id FK
        uuid provider_id FK
        uuid system_id FK
        alert_status status
    }
```

---

# Day 1 Platform Bootstrap (Engineer A)

This repository now includes a Day 1 platform foundation for shared, Docker-based development across devices.

## Quick Start

1. Copy environment variables:

```powershell
Copy-Item .env.example .env
```

2. Start API + PostgreSQL + Redis + worker:

```powershell
docker compose up --build
```

3. Validate health probes:

```powershell
curl http://localhost:8000/health/live
curl http://localhost:8000/health/ready
```

## Testing Command Formats (Terminal)

Use the project virtual environment interpreter directly for reliable results across machines and shells.

### Why this format

- Preferred: `./.venv/Scripts/python.exe`
- Avoid for this repo: `python.exe` (often resolves to global Python and misses project dependencies)

### Current implementation (Day 1 and unit tests)

Run the full unit baseline:

```powershell
./.venv/Scripts/python.exe -m pytest tests/unit -q
```

Rerun failed tests only:

```powershell
./.venv/Scripts/python.exe -m pytest tests/unit -q --lf
```

Rerun failures first, then continue with the rest:

```powershell
./.venv/Scripts/python.exe -m pytest tests/unit -q --ff
```

Run a single test module:

```powershell
./.venv/Scripts/python.exe -m pytest tests/unit/test_alerts.py -q
```

Run one named test:

```powershell
./.venv/Scripts/python.exe -m pytest tests/unit/test_consent.py -k "approves_and_generates_document" -q
```

### Story-focused rerun formats

Story 1 (Sync + conflict alert behavior):

```powershell
./.venv/Scripts/python.exe -m pytest tests/unit/test_sync.py tests/unit/test_alerts.py -q
```

Story 2 (Dashboard):

```powershell
./.venv/Scripts/python.exe -m pytest tests/unit/test_dashboard.py -q
```

Story 3 (Symptoms and triggers):

```powershell
./.venv/Scripts/python.exe -m pytest tests/unit/test_symptoms.py -q
```

Story 4 (Consent):

```powershell
./.venv/Scripts/python.exe -m pytest tests/unit/test_consent.py -q
```

Story 5 (Provider efficiency and alerts):

```powershell
./.venv/Scripts/python.exe -m pytest tests/unit/test_alerts.py -q
```

### Future implementation formats

Use these as additional test layers are introduced.

Run API contract tests (example folder):

```powershell
./.venv/Scripts/python.exe -m pytest tests/api -q
```

Run integration tests (example folder):

```powershell
./.venv/Scripts/python.exe -m pytest tests/integration -q
```

Run all tests in project:

```powershell
./.venv/Scripts/python.exe -m pytest tests -q
```

Run with coverage for implementation progress tracking:

```powershell
./.venv/Scripts/python.exe -m pytest tests -q --cov=ehrsystem --cov-report=term-missing
```

### Optional activated-shell format

If you activate the environment first, you can use `python` instead of the full path.

```powershell
. ./.venv/Scripts/Activate.ps1
python -m pytest tests/unit -q
```

Verification command:

```powershell
python -c "import sys; print(sys.executable)"
```

Expected output should include `.venv/Scripts/python.exe`.

Detailed Day 1 Engineer A Checkpoint Output is available in [docs/day1_engineer_a_checkpoint.md](docs/day1_engineer_a_checkpoint.md).

Detailed Day 1 Engineer B Checkpoint Output is available in [docs/day1_engineer_b_checkpoint.md](docs/day1_engineer_b_checkpoint.md).

Living data storage/retrieval testing instructions are available in [docs/data_storage_retrieval_testing.md](docs/data_storage_retrieval_testing.md).

Day 2 joint migration and seed sign-off run order and verification queries are available in [docs/day2_joint_checkpoint.md](docs/day2_joint_checkpoint.md).

Detailed Day 2 Engineer A Checkpoint Output is available in [docs/day2_engineer_a_checkpoint.md](docs/day2_engineer_a_checkpoint.md).

Detailed Day 2 Engineer B Checkpoint Output is available in [docs/day2_engineer_b_checkpoint.md](docs/day2_engineer_b_checkpoint.md).

Docker deploy, uptime monitoring, and CD setup instructions are available in [docs/deployment_render_uptimerobot.md](docs/deployment_render_uptimerobot.md).
