# EHRSystem
Patient Health Record (EHR) System for Chronic Disease Management in a Small Outpatient Clinic

The rising prevalence of chronic diseases and official diagnoses makes long-term treatment and management outside of hospitals critical. However, it is a challenge to remember all of the healthcare providers involved in chronic disease management, especially for those with multiple diagnoses. This web application presents a platform for both patients, their caregivers, and their healthcare providers to store and access patient information, demographics, medical history, diagnostics, prescriptions, and treatment plans, regardless of whether hospitals use large-scale EHR systems like Epic, Oracle Cerner, athenahealth, and NextGen. A critical aspect of this application would be updating patient information databases both at small clinics and at hospitals that use these large-scale EHR system, similar to updating remote and local repositories of GitHub.

---

# Logical Data Design

```mermaid
erDiagram
    PATIENT ||--o{ MEDICAL_RECORD_ITEM : "has"
    PATIENT ||--o{ SYMPTOM_LOG : "records"
    PATIENT ||--o{ ACCESS_REQUEST : "manages"
    PATIENT ||--o{ ALERT : "receives"
    
    HEALTHCARE_PROVIDER ||--o{ PATIENT : "manages"
    HEALTHCARE_PROVIDER ||--o{ ACCESS_REQUEST : "requests"
    HEALTHCARE_PROVIDER ||--o{ ALERT : "receives"
    
    EHR_SYSTEM ||--o{ MEDICAL_RECORD_ITEM : "provides"
    EHR_SYSTEM ||--o{ ALERT : "triggers"
    
    SYMPTOM_LOG ||--o{ TRIGGER : "includes"
    SYMPTOM_LOG ||--o{ TREATMENT : "includes"

    PATIENT {
        string patient_id PK
        string full_name
        float height
        float weight
        text family_history
        text vaccination_record
        boolean two_factor_enabled
    }

    HEALTHCARE_PROVIDER {
        string provider_id PK
        string name
        string specialty
        string clinic_affiliation
    }

    EHR_SYSTEM {
        string system_id PK
        string system_name
        string protocol
        datetime last_synced
    }

    MEDICAL_RECORD_ITEM {
        string record_id PK
        string category
        text description
        string source_system
        datetime timestamp
    }

    SYMPTOM_LOG {
        string log_id PK
        text description
        int severity_scale
        datetime log_date
    }

    TRIGGER {
        string trigger_id PK
        string trigger_name
    }

    TREATMENT {
        string treatment_id PK
        string product_name
        string treatment_type
    }

    ACCESS_REQUEST {
        string request_id PK
        string status
        blob authorization_doc
        datetime timestamp
    }

    ALERT {
        string alert_id PK
        string alert_type
        text description
        string resolution_status
    }
```
