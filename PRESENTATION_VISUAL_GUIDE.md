# EHR System — Technical Visual Guide & Quick Reference

This document provides visual diagrams, data flows, and quick-reference tables to supplement the main presentation.

---

## Part 1: System Component Diagrams

### 1.1 Authentication & Authorization Flow

```
┌─────────────────┐
│   User Login    │
│  (Email + Pass) │
└────────┬────────┘
         │
         ▼
    ┌─────────────────────────────┐
    │  FastAPI JWT Middleware     │
    │  • Validate credentials     │
    │  • Hash password check      │
    │  • Generate JWT token       │
    └─────────┬───────────────────┘
              │
              ▼
    ┌─────────────────────────────┐
    │  TOTP 2FA Challenge         │
    │  • Generate OTP (6-digit)   │
    │  • SMS delivery             │
    │  • 30-second validity       │
    └─────────┬───────────────────┘
              │
              ▼
    ┌─────────────────────────────┐
    │  OTP Verification           │
    │  • Time-sync check          │
    │  • Replay attack prevention │
    │  • Session token issued     │
    └─────────┬───────────────────┘
              │
              ▼
    ┌─────────────────────────────┐
    │  Load User Profile & Roles  │
    │  • Fetch from DB (role)     │
    │  • Set JWT claims           │
    │  • Cache in Redis (1 hr TTL)│
    └─────────┬───────────────────┘
              │
              ▼
    ┌─────────────────────────────┐
    │  Check Route RBAC Guard     │
    │  • Patient routes?          │
    │  • Provider routes?         │
    │  • Admin routes?            │
    └─────────┬───────────────────┘
              │
              ▼
    ┌─────────────────────────────┐
    │ Allowed → Route Handler     │
    │ Denied  → 403 Forbidden     │
    └─────────────────────────────┘
```

### 1.2 Data Synchronization Pipeline

```
┌─────────────────────────────────────────────────────────┐
│            Scheduled Sync Job (Celery Worker)            │
│  Runs every 4 hours or on-demand                         │
└─────────────────────────────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
         ▼               ▼               ▼
    ┌─────────┐    ┌─────────┐    ┌──────────┐
    │ Epic    │    │ NextGen │    │ Other    │
    │ FHIR    │    │ FHIR    │    │ System   │
    │ Endpoint│    │ Endpoint│    │ (Future) │
    └────┬────┘    └────┬────┘    └────┬─────┘
         │              │              │
         ▼              ▼              ▼
    ┌──────────────────────────────────────────┐
    │     External API Adapter Layer           │
    │  • Construct FHIR query (last synced)    │
    │  • Add auth headers                      │
    │  • Handle rate limiting & timeouts       │
    │  • Parse FHIR R4 response                │
    └────────────┬─────────────────────────────┘
                 │
                 ▼
    ┌──────────────────────────────────────────┐
    │   Conflict Detection Logic               │
    │  • Compare external vs local record      │
    │  • Generate conflict alert if diff       │
    │  • Mark as "needs provider review"       │
    │  • Create audit event                    │
    └────────────┬─────────────────────────────┘
                 │
         ┌───────┴───────┐
         │               │
      No Conflict    Conflict Detected
         │               │
         ▼               ▼
    ┌─────────┐    ┌──────────────┐
    │ Store   │    │ Store Conflict
    │ Record  │    │ Alert Record │
    │ + UTC   │    │ + Alert Job  │
    │ Timestamp   │                │
    │         │    │ Notify       │
    └────┬────┘    │ Provider    │
         │         └──────────────┘
         │
         ▼
    ┌──────────────────────────────────┐
    │  Update Sync Metadata            │
    │  • last_synced_at per category   │
    │  • Store UTC timestamp           │
    │  • Log: "Epic allergies synced" │
    │  • Record in audit trail         │
    └────────────┬─────────────────────┘
                 │
                 ▼
    ┌──────────────────────────────────┐
    │  Generate Audit Event            │
    │  • Event: SYNC_COMPLETED         │
    │  • Timestamp: ISO 8601           │
    │  • Source: Epic, Categories: [...] │
    │  • Status: SUCCESS (or CONFLICT) │
    │  • Persist to audit_log table    │
    └──────────────────────────────────┘
```

### 1.3 Consent Workflow with Async Document Generation

```
STEP 1: PROVIDER INITIATES
┌──────────────────────────────────────┐
│ Provider: "Request access from pat-123"   │
└──────────┬───────────────────────────┘
           │
           ▼
┌──────────────────────────────────────┐
│ API POST /v1/consent/request         │
│ Body:                                │
│  patient_id: pat-123                 │
│  provider_id: prov-456               │
│  categories: [allergies, meds, labs] │
│  expires_at: 2026-05-27 (30 days)   │
└──────────┬───────────────────────────┘
           │
           ▼
    ┌────────────────────────────┐
    │ Create access_request Row  │
    │ Status: PENDING            │
    │ Generate request_id        │
    └────────────┬───────────────┘
                 │
                 ▼
    ┌────────────────────────────┐
    │ Enqueue Job:               │
    │ "send_consent_notification"│
    │ Args: {request_id}         │
    └────────────┬───────────────┘
                 │
                 ▼
    ┌────────────────────────────┐
    │ Return HTTP 200            │
    │ {status: "PENDING",        │
    │  expires_at: "..."}        │
    └────────────────────────────┘

STEP 2: BACKGROUND JOB SENDS NOTIFICATION
┌──────────────────────────────────────────┐
│ Celery Worker picks up job               │
└──────────┬───────────────────────────────┘
           │
           ▼
    ┌─────────────────────────────────────┐
    │ Fetch request details from DB       │
    │ Fetch patient + provider details    │
    │ Fetch clinic affiliation, specialty │
    └────────────┬────────────────────────┘
                 │
                 ▼
    ┌─────────────────────────────────────┐
    │ Create in-app notification          │
    │ Message: "Dr. Smith requests access │
    │           to your health records"   │
    │ Insert into notifications table     │
    └────────────┬────────────────────────┘
                 │
                 ▼
    ┌─────────────────────────────────────┐
    │ Enqueue email (optional)            │
    │ Subject: "Your consent is needed"   │
    │ Include secure login link           │
    └─────────────────────────────────────┘

STEP 3: PATIENT REVIEWS & APPROVES
┌──────────────────────────────────────────┐
│ Patient logs in, sees notification       │
│ Clicks "Review" → Details popup:         │
│  • Dr. Smith, Main Clinic, Dermatology  │
│  • Requested: Allergies, Meds, Labs     │
│  • Expiry: May 27, 2026                 │
│  [APPROVE] [DENY] [SHOW MORE]           │
└──────────┬───────────────────────────────┘
           │
           ▼
    ┌──────────────────────────────────┐
    │ API POST /v1/consent/{req_id}/approve │
    │ Requires 2FA verification first! │
    │ (HIPAA requirement)              │
    └──────────┬─────────────────────────┘
               │
               ▼
    ┌──────────────────────────────────┐
    │ 2FA OTP Challenge                │
    │ SMS sent to patient              │
    │ "Enter OTP to approve access"    │
    └──────────┬─────────────────────────┘
               │
               ▼
    ┌──────────────────────────────────┐
    │ Patient enters OTP               │
    │ Verify against Redis cache       │
    │ Check 30-sec validity window     │
    └──────────┬─────────────────────────┘
               │
               ▼
    ┌──────────────────────────────────┐
    │ Update access_request status     │
    │ Status: APPROVED                 │
    │ approved_at: ISO 8601 timestamp  │
    │ approved_by: patient-123         │
    │ otp_verified: true               │
    └──────────┬─────────────────────────┘
               │
               ▼
    ┌──────────────────────────────────┐
    │ Enqueue async job:               │
    │ "generate_authorization_document"│
    │ Args: {request_id, patient_id,   │
    │        provider_id}              │
    │                                  │
    │ Return HTTP 202 ACCEPTED         │
    │ Location: /v1/consent/{req_id}/status
    └──────────┬─────────────────────────┘

STEP 4: BACKGROUND JOB GENERATES DOCUMENT
┌──────────────────────────────────────────┐
│ Celery Worker picks up PDF job           │
└──────────┬───────────────────────────────┘
           │
           ▼
    ┌─────────────────────────────────────┐
    │ Render PDF Template:                │
    │ • Patient name, DOB, ID             │
    │ • Provider name, clinic, specialty  │
    │ • Data categories consented         │
    │ • Expiry date                       │
    │ • Date of approval                  │
    │ • HIPAA privacy notice boilerplate  │
    └────────────┬────────────────────────┘
                 │
                 ▼
    ┌─────────────────────────────────────┐
    │ Generate Digital Signature          │
    │ • Compute SHA-256 hash of PDF      │
    │ • Sign with provider private key    │
    │ • Embed signature in PDF            │
    └────────────┬────────────────────────┘
                 │
                 ▼
    ┌─────────────────────────────────────┐
    │ Store Document                      │
    │ • Encrypt with AES-256              │
    │ • Save to blob storage (S3/Azure)   │
    │ • Record path in DB:                │
    │   authorization_document_path      │
    └────────────┬────────────────────────┘
                 │
                 ▼
    ┌─────────────────────────────────────┐
    │ Create Audit Event:                 │
    │ • Type: CONSENT_APPROVED            │
    │ • Actor: patient-123                │
    │ • Resource: access_request-XYZ      │
    │ • Action_detail: "Data categories:  │
    │             [allergies, meds, ...]" │
    │ • Timestamp: ISO 8601               │
    │ • Signature: hash of PDF            │
    └────────────┬────────────────────────┘
                 │
                 ▼
    ┌─────────────────────────────────────┐
    │ Mark Job Complete                   │
    │ Job result: {"status": "COMPLETED", │
    │             "document_id": "..."}   │
    └─────────────────────────────────────┘

STEP 5: PROVIDER ACCESSES APPROVED DATA
┌──────────────────────────────────────────┐
│ Provider queries dashboard for patient   │
│ API checks: Is provider authorized?      │
│ - Lookup active access_request           │
│ - Status == APPROVED?                    │
│ - Expiry > now?                          │
└──────────┬───────────────────────────────┘
           │
      ┌────┴────┐
      │ (Yes)   │
      ▼         │
  ┌───────────┐ │ (No) → 403 Forbidden
  │ Return    │ │
  │ data +    │ │
  │ freshness │ │
  │ info      │ │
  └───────────┘ │
                │
                ▼
           [Error response]
```

---

## Part 2: Database Schema Quick Reference

### Core Tables

```sql
-- PATIENTS: Core patient identity
CREATE TABLE patients (
    patient_id UUID PRIMARY KEY,
    full_name TEXT NOT NULL,
    dob DATE NOT NULL,
    height_cm DECIMAL,
    weight_kg DECIMAL,
    family_history TEXT,
    vaccination_record TEXT,
    two_factor_enabled BOOLEAN DEFAULT false,
    primary_provider_id UUID REFERENCES providers(provider_id),
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
);

-- PROVIDERS: Clinicians and clinic staff
CREATE TABLE providers (
    provider_id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    specialty TEXT,
    clinic_affiliation TEXT,
    email TEXT UNIQUE,
    phone TEXT,
    created_at TIMESTAMPTZ
);

-- MEDICAL_RECORDS: Aggregated external EHR data
CREATE TABLE medical_records (
    record_id UUID PRIMARY KEY,
    patient_id UUID REFERENCES patients NOT NULL,
    ehr_system_id UUID REFERENCES ehr_systems NOT NULL,
    category TEXT NOT NULL,  -- 'allergies', 'medications', 'labs', etc.
    value_description TEXT NOT NULL,
    external_record_id TEXT,  -- Epic/NextGen reference ID
    last_synced_at TIMESTAMPTZ,  -- UTC timestamp per category
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    UNIQUE(patient_id, ehr_system_id, category, external_record_id)
);

-- EHR_SYSTEMS: External system metadata
CREATE TABLE ehr_systems (
    system_id UUID PRIMARY KEY,
    system_name TEXT NOT NULL,
    system_type TEXT,  -- 'epic', 'nextgen', etc.
    protocol TEXT,  -- 'fhir_r4'
    endpoint_url TEXT,
    last_synced_at TIMESTAMPTZ,
    last_sync_status TEXT,  -- 'success', 'conflict', 'error'
    created_at TIMESTAMPTZ
);

-- SYNC_METADATA: Per-category sync timestamps
CREATE TABLE sync_metadata (
    metadata_id UUID PRIMARY KEY,
    patient_id UUID REFERENCES patients NOT NULL,
    ehr_system_id UUID REFERENCES ehr_systems NOT NULL,
    category TEXT NOT NULL,
    last_synced_at TIMESTAMPTZ NOT NULL,  -- UTC
    last_sync_status TEXT,  -- 'success', 'conflict'
    conflict_summary TEXT,  -- JSON details if conflict
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    UNIQUE(patient_id, ehr_system_id, category)
);

-- SYMPTOM_LOGS: Patient-reported symptoms
CREATE TABLE symptom_logs (
    log_id UUID PRIMARY KEY,
    patient_id UUID REFERENCES patients NOT NULL,
    disease_type TEXT NOT NULL,  -- 'psoriasis', etc. (enforced at app level)
    log_date DATE NOT NULL,
    severity_scale INT CHECK (severity_scale >= 1 AND severity_scale <= 10),
    symptom_description TEXT,
    primary_area TEXT,  -- 'trunk', 'arms', 'legs', etc.
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    INDEX (patient_id, log_date DESC)
);

-- LOG_TRIGGERS: M2M between symptom logs and trigger checklist
CREATE TABLE log_triggers (
    log_id UUID REFERENCES symptom_logs NOT NULL,
    trigger_id UUID REFERENCES triggers NOT NULL,
    PRIMARY KEY (log_id, trigger_id)
);

-- TRIGGERS: Clinical trigger checklist (Psoriasis)
CREATE TABLE triggers (
    trigger_id UUID PRIMARY KEY,
    disease_type TEXT NOT NULL,
    trigger_name TEXT NOT NULL,  -- 'stress', 'weather', 'infection', etc.
    UNIQUE(disease_type, trigger_name)
);

-- LOG_TREATMENTS: M2M between symptom logs and treatments
CREATE TABLE log_treatments (
    log_id UUID REFERENCES symptom_logs NOT NULL,
    treatment_id UUID REFERENCES treatments NOT NULL,
    treatment_type TEXT,  -- 'prescription' or 'otc'
    treatment_notes TEXT,
    PRIMARY KEY (log_id, treatment_id)
);

-- TREATMENTS: Prescribed or OTC treatments
CREATE TABLE treatments (
    treatment_id UUID PRIMARY KEY,
    product_name TEXT NOT NULL,
    treatment_type TEXT,  -- 'prescription' or 'otc'
    created_at TIMESTAMPTZ
);

-- ACCESS_REQUESTS: Consent workflow state
CREATE TABLE access_requests (
    request_id UUID PRIMARY KEY,
    patient_id UUID REFERENCES patients NOT NULL,
    provider_id UUID REFERENCES providers NOT NULL,
    status TEXT NOT NULL,  -- 'pending', 'approved', 'denied', 'expired'
    categories_requested TEXT[],  -- JSON: ['allergies', 'meds', 'labs']
    requested_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    approved_at TIMESTAMPTZ,
    approved_by UUID,
    otp_verified BOOLEAN DEFAULT false,
    authorization_document_path TEXT,  -- Encrypted blob path
    created_at TIMESTAMPTZ,
    INDEX (patient_id, status),
    INDEX (provider_id, status)
);

-- ALERTS: Conflict, trend, and system alerts
CREATE TABLE alerts (
    alert_id UUID PRIMARY KEY,
    alert_type TEXT NOT NULL,  -- 'data_conflict', 'negative_trend', 'sync_error'
    target_patient_id UUID REFERENCES patients,
    target_provider_id UUID REFERENCES providers,
    severity TEXT,  -- 'info', 'warning', 'critical'
    title TEXT NOT NULL,
    description TEXT,
    action_url TEXT,  -- Link to resolve alert (e.g., conflict merge UI)
    is_resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ,
    INDEX (target_patient_id, is_resolved),
    INDEX (target_provider_id, is_resolved)
);

-- AUDIT_LOG: HIPAA-required immutable event log
CREATE TABLE audit_log (
    event_id UUID PRIMARY KEY,
    event_type TEXT NOT NULL,  -- 'LOGIN', 'CONSENT_APPROVED', 'SYNC_COMPLETED', etc.
    actor_id UUID NOT NULL,
    actor_type TEXT NOT NULL,  -- 'patient', 'provider', 'admin', 'system'
    resource_type TEXT,  -- 'access_request', 'patient', 'medical_record', etc.
    resource_id UUID,
    action_description TEXT,
    action_detail TEXT,  -- JSON payload
    ip_address INET,
    user_agent TEXT,
    status TEXT,  -- 'success', 'failure', 'partial'
    error_message TEXT,
    timestamp TIMESTAMPTZ NOT NULL,
    retention_expiry_date DATE,  -- 6 years from event date (HIPAA requirement)
    INDEX (actor_id, timestamp DESC),
    INDEX (resource_type, resource_id),
    INDEX (timestamp DESC)
);
```

---

## Part 3: API Contract Quick Reference

### Authentication

```
POST /v1/auth/login
Request:
  {
    "email": "provider@example.com",
    "password": "secure_password"
  }

Response (200 OK):
  {
    "status": "2fa_required",
    "session_token": "temp_session_xyz",  // Valid for 5 minutes
    "otp_delivery_method": "sms"
  }

---

POST /v1/auth/verify-otp
Request:
  {
    "session_token": "temp_session_xyz",
    "otp": "123456"
  }

Response (200 OK):
  {
    "access_token": "eyJ0eXAi...",  // JWT, expires in 1 hour
    "refresh_token": "refresh_xyz",  // Expires in 7 days
    "user": {
      "id": "prov-456",
      "name": "Dr. Smith",
      "role": "provider",
      "clinic": "Main Clinic"
    }
  }
```

### Sync Status

```
GET /v1/dashboard/sync-status
Headers: Authorization: Bearer <access_token>

Response (200 OK):
  {
    "patient_id": "pat-123",
    "categories": [
      {
        "name": "allergies",
        "last_synced_at": "2026-04-27T14:30:00Z",  // UTC
        "last_sync_status": "success",
        "records_count": 3,
        "freshness_hours": 2
      },
      {
        "name": "medications",
        "last_synced_at": "2026-04-27T12:00:00Z",
        "last_sync_status": "success",
        "records_count": 5,
        "freshness_hours": 4
      },
      {
        "name": "labs",
        "last_synced_at": "2026-02-15T10:30:00Z",
        "last_sync_status": "warning",  // Older than 30 days
        "records_count": 0,
        "freshness_hours": 1440
      }
    ],
    "conflicts": [
      {
        "conflict_id": "conf-789",
        "source": "epic",
        "category": "allergies",
        "local_value": "Penicillin allergy",
        "external_value": "Penicillin sensitivity",
        "alert_id": "alert-111"
      }
    ]
  }
```

### Consent Request

```
POST /v1/consent/request
Headers: Authorization: Bearer <provider_token>

Request:
  {
    "patient_id": "pat-123",
    "categories": ["allergies", "medications", "labs"],
    "expires_in_days": 30
  }

Response (200 OK):
  {
    "request_id": "req-456",
    "status": "pending",
    "patient_id": "pat-123",
    "provider_id": "prov-456",
    "categories": ["allergies", "medications", "labs"],
    "created_at": "2026-04-27T10:00:00Z",
    "expires_at": "2026-05-27T10:00:00Z"
  }

---

POST /v1/consent/{request_id}/approve
Headers: Authorization: Bearer <patient_token>

Request:
  {
    "otp": "123456"  // 2FA verification
  }

Response (202 ACCEPTED):
  {
    "request_id": "req-456",
    "status": "generating_document",
    "polling_url": "/v1/consent/{request_id}/status"
  }

---

GET /v1/consent/{request_id}/status
Headers: Authorization: Bearer <patient_token>

Response (200 OK):
  {
    "request_id": "req-456",
    "status": "approved",
    "approved_at": "2026-04-27T10:15:00Z",
    "document_ready": true,
    "document_id": "doc-789",
    "document_url": "/v1/consent/{request_id}/document"
  }
```

### Symptom Logging

```
POST /v1/symptoms
Headers: Authorization: Bearer <patient_token>

Request:
  {
    "disease_type": "psoriasis",
    "log_date": "2026-04-27",
    "severity_scale": 6,
    "primary_area": "trunk",
    "triggers": ["stress", "weather"],
    "treatments": [
      {
        "treatment_id": "trt-001",  // OTC moisturizer
        "treatment_type": "otc"
      }
    ]
  }

Response (201 CREATED):
  {
    "log_id": "log-123",
    "patient_id": "pat-456",
    "disease_type": "psoriasis",
    "log_date": "2026-04-27",
    "severity_scale": 6,
    "triggers": ["stress", "weather"],
    "created_at": "2026-04-27T14:32:15Z",
    "created_by": "system"
  }

VALIDATION RULES (enforced at API):
- disease_type must be "psoriasis" (Phase 1 scope)
- severity_scale must be 1-10
- triggers must be from approved psoriasis trigger list
- treatment_type must be "prescription" or "otc"
```

### Alerts

```
GET /v1/alerts?status=unresolved
Headers: Authorization: Bearer <provider_token>

Response (200 OK):
  {
    "alerts": [
      {
        "alert_id": "alert-001",
        "alert_type": "negative_trend",
        "patient_id": "pat-123",
        "severity": "warning",
        "title": "Psoriasis worsening for John Doe",
        "description": "3 consecutive logs with severity > 7",
        "action_url": "/dashboard/patients/pat-123/trend-report",
        "created_at": "2026-04-27T06:00:00Z"
      },
      {
        "alert_id": "alert-002",
        "alert_type": "data_conflict",
        "patient_id": "pat-123",
        "severity": "critical",
        "title": "Conflict: Allergy data differs between Epic and local records",
        "description": "External: Penicillin allergy | Local: Penicillin sensitivity",
        "action_url": "/dashboard/patients/pat-123/conflicts/resolve",
        "created_at": "2026-04-27T14:00:00Z"
      }
    ]
  }

---

PUT /v1/alerts/{alert_id}/resolve
Headers: Authorization: Bearer <provider_token>

Request:
  {
    "resolution": "merged_with_external_record"
  }

Response (200 OK):
  {
    "alert_id": "alert-002",
    "status": "resolved",
    "resolved_at": "2026-04-27T14:05:00Z",
    "resolved_by": "prov-456"
  }
```

---

## Part 4: Testing Pyramid & Coverage

```
                          ▲
                         ╱│╲
                        ╱ │ ╲   E2E Tests
                       ╱  │  ╲  (Browser Automation)
                      ╱   │   ╲  • Playwright
                     ╱    │    ╲ • 12 tests
                    ╱─────┼─────╲ • 30-40 min
                   ╱      │      ╲
                  ╱       │       ╲
                 ╱────────┼────────╲ Integration Tests
                ╱         │         ╲ (API Level)
               ╱          │          ╲ • 2 tests
              ╱───────────┼───────────╲ • 15-20 min
             ╱            │            ╲
            ╱             │             ╲
           ╱──────────────┼──────────────╲ Unit Tests
          ╱               │               ╲ (Logic Level)
         ╱────────────────┼────────────────╲ • 62 tests
        ╱                 │                 ╲ • 2-3 min
       ╱___________________│___________________╲

Total Coverage: 76 automated tests, ~60 min full suite
Critical Path: 62 unit tests (2-3 min) before every commit
```

### Test Distribution by Story

| Story | Unit Tests | Integration | E2E | Total |
|-------|-----------|-------------|-----|-------|
| **Sync** | 12 | 1 | 2 | 15 |
| **Dashboard** | 10 | 1 | 2 | 13 |
| **Symptoms** | 15 | 1 | 2 | 18 |
| **Consent** | 18 | 1 | 2 | 21 |
| **Alerts** | 7 | — | 2 | 9 |
| **Security** | 10 | — | — | 10 |
| **Utilities** | 10 | — | — | 10 |
| **TOTAL** | **82** | **4** | **12** | **98** |

---

## Part 5: Deployment & Rollback Strategy

### Pre-Production Validation Checklist

```
┌──────────────────────────────────────┐
│  Staging Deployment Gate             │
├──────────────────────────────────────┤
│ ☑ Database migrations execute        │
│ ☑ Health endpoint: /v1/health → 200  │
│ ☑ Unit tests: 62/62 passing          │
│ ☑ Integration tests: 2/2 passing     │
│ ☑ E2E tests: 12/12 passing           │
│ ☑ RBAC boundary tests: provider role │
│ ☑ 2FA enforcement verified           │
│ ☑ External FHIR endpoints reachable  │
│ ☑ Database connection pool healthy   │
│ ☑ Redis cache healthy                │
│ ☑ Celery workers accepting jobs      │
│ ☑ Secrets injected correctly         │
│ ☑ TLS certificate valid              │
│ ☑ Smoke test: login → sync → consent │
│ ☑ Performance baseline: <2s response │
│ ☑ Sentry error tracking active       │
│ ☑ Monitoring alerts configured       │
│ ☑ Rollback procedures tested         │
└──────────────────────────────────────┘
     ↓ All checks PASS
     │
     ▼
┌──────────────────────────────────────┐
│  Production Deployment (Blue-Green)  │
├──────────────────────────────────────┤
│ 1. Deploy to GREEN environment       │
│ 2. Run validation checks on GREEN    │
│ 3. Switch load balancer:             │
│    BLUE (current) → GREEN (new)      │
│ 4. Monitor error rate for 5 min      │
│ 5. If OK: COMPLETE                   │
│ 6. If ERROR: Switch back BLUE        │
│    (Automatic rollback)              │
│ 7. Investigate failure in GREEN      │
│ 8. Fix & redeploy when ready         │
└──────────────────────────────────────┘
```

### Rollback Decision Tree

```
                    ┌─── Post-Deployment Monitoring ───┐
                    │ (T+5 min, T+15 min, T+30 min)    │
                    └──────────────┬──────────────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    │              │              │
                Error Rate     Response      5xx Errors
                < 0.5%?        Time < 2s?    < 1%?
                    │              │              │
              Yes◄──┴──Yes        ───┴──Yes    ───┴──
              │                                      │
              ▼                                      ▼
        ┌──────────┐                          ┌────────────┐
        │ MONITOR  │                          │  ROLLBACK  │
        │ Continue │◄─ Any metric FAIL ──────│  to BLUE   │
        │monitoring│                          │            │
        │ 30 min   │                          └─────┬──────┘
        └──────────┘                                │
              │                                     ▼
              │                          ┌──────────────────┐
              │                          │ Run validation   │
              │                          │ on BLUE (current)│
              │                          │ Confirm healthy  │
              │                          └──────────────────┘
              │                                     │
              ▼                                     ▼
        ┌──────────────┐                    ┌────────────────┐
        │ Deployment   │                    │ Incident Report│
        │ SUCCESSFUL   │                    │ Root cause     │
        │ Lock GREEN   │                    │ analysis       │
        │ as BLUE      │                    │ Fix & retry    │
        └──────────────┘                    └────────────────┘
```

---

## Part 6: HIPAA Compliance Checklist

| Control | Status | Implementation |
|---------|--------|---|
| **Authentication** | ✓ | Mandatory 2FA (TOTP) on all logins |
| **Authorization** | ✓ | RBAC: Patient/Provider/Admin roles enforced at API level |
| **Encryption (Transit)** | ✓ | TLS 1.2+ for all HTTPS endpoints |
| **Encryption (Rest)** | ✓ | AES-256 for sensitive fields (SSN, medical notes) |
| **Audit Logging** | ✓ | Immutable audit_log table with 6-year retention |
| **Access Control** | ✓ | Consent workflow with digital authorization documents |
| **Session Management** | ✓ | 30-min idle timeout, automatic logout |
| **Password Policy** | ✓ | Min 12 chars, complexity required, hashed with bcrypt |
| **Backup/Recovery** | ✓ | Automated daily backups, tested recovery procedures |
| **Data Integrity** | ✓ | ACID transactions, no data loss guarantees |
| **Error Logging** | ✓ | Sentry integration, no PHI in error messages |
| **Rate Limiting** | ✓ | 100 requests/min per authenticated user |
| **SQL Injection Prevention** | ✓ | ORM parameterized queries only |
| **Secrets Management** | ✓ | AWS Secrets Manager, no hardcoded credentials |
| **Code Review** | ✓ | Peer review gate before all merges |

---

**Document prepared:** April 27, 2026
