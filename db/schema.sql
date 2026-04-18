-- PostgreSQL DDL for EHR Chronic Disease Management Subsystem

-- Extensions for UUID support
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

---
--- 1. ENUM TYPES FOR CONSTRAINTS
---
CREATE TYPE access_request_status AS ENUM ('Pending', 'Approved', 'Denied');
CREATE TYPE alert_status AS ENUM ('Active', 'Resolved', 'Dismissed');
CREATE TYPE alert_type AS ENUM ('Data Conflict', 'Negative Trend', 'Missing Data');
CREATE TYPE protocol_type AS ENUM ('FHIR', 'HL7');
CREATE TYPE sync_direction AS ENUM ('pull', 'push', 'bidirectional');

---
--- 2. CORE ENTITIES
---

-- Healthcare Providers (Specialists and PCPs)
CREATE TABLE providers (
    provider_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    specialty TEXT,
    clinic_affiliation TEXT NOT NULL
);

-- Patients with 2FA and Health Stats
CREATE TABLE patients (
    patient_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name TEXT NOT NULL,
    height NUMERIC(5,2), -- Support for missing data checks
    weight NUMERIC(5,2),
    family_history TEXT,
    vaccination_record TEXT,
    two_factor_enabled BOOLEAN DEFAULT TRUE, -- AC 4: Mandatory 2FA
    primary_provider_id UUID NOT NULL REFERENCES providers(provider_id) ON DELETE RESTRICT
);

-- External EHR Systems (Epic, NextGen, etc.)
CREATE TABLE ehr_systems (
    system_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    system_name TEXT NOT NULL,
    protocol protocol_type NOT NULL, -- AC 1: Standard Protocols
    last_synced_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP -- AC 1: Sync timestamps (UTC-aware)
);

---
--- 3. CLINICAL DATA & SYNCHRONIZATION
---

-- Medical Records aggregated from multiple sources
CREATE TABLE medical_record_items (
    record_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,
    system_id UUID NOT NULL REFERENCES ehr_systems(system_id) ON DELETE RESTRICT, -- AC 2: Tracking source
    category TEXT NOT NULL, -- e.g., 'Medications', 'Labs'
    value_description TEXT NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Per-patient/per-system/per-category sync freshness metadata (UTC timestamps).
CREATE TABLE sync_metadata (
    sync_metadata_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,
    system_id UUID NOT NULL REFERENCES ehr_systems(system_id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    sync_direction sync_direction NOT NULL DEFAULT 'bidirectional',
    last_synced_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (patient_id, system_id, category)
);

-- Patient Symptom Tracking
CREATE TABLE symptom_logs (
    log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,
    symptom_description TEXT NOT NULL, -- e.g., 'Redness', 'Scales'
    severity_scale INT CHECK (severity_scale BETWEEN 1 AND 10),
    log_date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Triggers (Stress, Scented Products, etc.)
CREATE TABLE triggers (
    trigger_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trigger_name TEXT UNIQUE NOT NULL
);

-- Relationship: Log to many Triggers (AC 3)
CREATE TABLE log_triggers (
    log_id UUID REFERENCES symptom_logs(log_id) ON DELETE CASCADE,
    trigger_id UUID REFERENCES triggers(trigger_id),
    PRIMARY KEY (log_id, trigger_id)
);

-- Treatments (OTC, Vitamins, Brands)
CREATE TABLE treatments (
    treatment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_name TEXT NOT NULL,
    treatment_type TEXT -- e.g., 'Skincare', 'Multivitamin'
);

-- Relationship: Log to many Treatments (AC 3)
CREATE TABLE log_treatments (
    log_id UUID REFERENCES symptom_logs(log_id) ON DELETE CASCADE,
    treatment_id UUID REFERENCES treatments(treatment_id),
    PRIMARY KEY (log_id, treatment_id)
);

---
--- 4. WORKFLOWS: CONSENT & ALERTS
---

-- Secure Digital Consent (AC 4)
CREATE TABLE access_requests (
    request_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(patient_id),
    provider_id UUID NOT NULL REFERENCES providers(provider_id),
    status access_request_status DEFAULT 'Pending',
    authorization_document TEXT, -- Path or Base64 HIPAA document
    requested_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    responded_at TIMESTAMPTZ
);

-- Automated Alerts for Conflicts and Trends (AC 1 & 5)
CREATE TABLE alerts (
    alert_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alert_type alert_type NOT NULL,
    description TEXT NOT NULL,
    patient_id UUID REFERENCES patients(patient_id),
    provider_id UUID REFERENCES providers(provider_id), -- Targeted alerts
    system_id UUID REFERENCES ehr_systems(system_id), -- Synchronization conflicts
    status alert_status DEFAULT 'Active',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Generated report metadata for symptom trends and provider sharing
CREATE TABLE report_artifacts (
    artifact_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,
    generated_by_provider_id UUID NOT NULL REFERENCES providers(provider_id) ON DELETE RESTRICT,
    report_type TEXT NOT NULL, -- e.g., 'Symptom Trend Report'
    storage_path TEXT NOT NULL,
    period_start TIMESTAMPTZ,
    period_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Secure in-app messages used for consent/report sharing between providers
CREATE TABLE secure_messages (
    message_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,
    sender_provider_id UUID NOT NULL REFERENCES providers(provider_id) ON DELETE RESTRICT,
    recipient_provider_id UUID NOT NULL REFERENCES providers(provider_id) ON DELETE RESTRICT,
    artifact_id UUID REFERENCES report_artifacts(artifact_id) ON DELETE SET NULL,
    message_body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    delivered_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ
);

---
--- 5. INDEXES FOR PERFORMANCE
---

-- Index for Trend Reporting (AC 3 & 5)
CREATE INDEX idx_symptom_logs_patient_date ON symptom_logs(patient_id, log_date DESC);

-- Index for Dashboard Aggregation (AC 2)
CREATE INDEX idx_medical_records_patient_category ON medical_record_items(patient_id, category);

-- Index for Sync Status (AC 1)
CREATE INDEX idx_ehr_sync ON ehr_systems(last_synced_at);

-- Indexes for sync freshness lookups by patient/system/category (AC 1)
CREATE INDEX idx_sync_metadata_patient_category ON sync_metadata(patient_id, category);
CREATE INDEX idx_sync_metadata_system_last_synced ON sync_metadata(system_id, last_synced_at DESC);

-- Index for provider mailbox retrieval
CREATE INDEX idx_secure_messages_recipient_created
    ON secure_messages(recipient_provider_id, created_at DESC);

-- Index for report lookups by patient and generation time
CREATE INDEX idx_report_artifacts_patient_created
    ON report_artifacts(patient_id, created_at DESC);
