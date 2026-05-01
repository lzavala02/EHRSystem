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

# Render Host Link

https://ehrsystem-1gtp.onrender.com/

---

# Render, Sentry, UpTimeRobot Screenshots

![RenderHost Deployment](docs/RenderHost.png)
![Sentry Monitoring](docs/Sentry.png)
![UpTimeRobot Monitoring](docs/UpTimeRobot.png)