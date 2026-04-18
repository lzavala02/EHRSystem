-- Day 2 Engineer B migration pack
-- Scope: consent, alerts, symptom logs, triggers, treatments,
-- report artifacts, and secure messaging.
--
-- Apply after Engineer A base migration:
--   psql -d <database_name> -f db/migrations/20260417_core_schema.sql
--   psql -d <database_name> -f db/migrations/20260417_engineer_b_day2_feature_schema.sql

BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'access_request_status') THEN
        CREATE TYPE access_request_status AS ENUM ('Pending', 'Approved', 'Denied');
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'alert_status') THEN
        CREATE TYPE alert_status AS ENUM ('Active', 'Resolved', 'Dismissed');
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'alert_type') THEN
        CREATE TYPE alert_type AS ENUM ('Data Conflict', 'Negative Trend', 'Missing Data');
    END IF;
END
$$;

CREATE TABLE IF NOT EXISTS symptom_logs (
    log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,
    symptom_description TEXT NOT NULL,
    severity_scale INT CHECK (severity_scale BETWEEN 1 AND 10),
    log_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS triggers (
    trigger_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trigger_name TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS log_triggers (
    log_id UUID NOT NULL REFERENCES symptom_logs(log_id) ON DELETE CASCADE,
    trigger_id UUID NOT NULL REFERENCES triggers(trigger_id) ON DELETE RESTRICT,
    PRIMARY KEY (log_id, trigger_id)
);

CREATE TABLE IF NOT EXISTS treatments (
    treatment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_name TEXT NOT NULL,
    treatment_type TEXT
);

CREATE TABLE IF NOT EXISTS log_treatments (
    log_id UUID NOT NULL REFERENCES symptom_logs(log_id) ON DELETE CASCADE,
    treatment_id UUID NOT NULL REFERENCES treatments(treatment_id) ON DELETE RESTRICT,
    PRIMARY KEY (log_id, treatment_id)
);

CREATE TABLE IF NOT EXISTS access_requests (
    request_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(patient_id) ON DELETE RESTRICT,
    provider_id UUID NOT NULL REFERENCES providers(provider_id) ON DELETE RESTRICT,
    status access_request_status NOT NULL DEFAULT 'Pending',
    authorization_document TEXT,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    responded_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS alerts (
    alert_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alert_type alert_type NOT NULL,
    description TEXT NOT NULL,
    patient_id UUID REFERENCES patients(patient_id) ON DELETE SET NULL,
    provider_id UUID REFERENCES providers(provider_id) ON DELETE SET NULL,
    system_id UUID REFERENCES ehr_systems(system_id) ON DELETE SET NULL,
    status alert_status NOT NULL DEFAULT 'Active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS report_artifacts (
    artifact_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,
    generated_by_provider_id UUID NOT NULL REFERENCES providers(provider_id) ON DELETE RESTRICT,
    report_type TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    period_start TIMESTAMPTZ,
    period_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS secure_messages (
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

CREATE INDEX IF NOT EXISTS idx_symptom_logs_patient_date
    ON symptom_logs(patient_id, log_date DESC);

CREATE INDEX IF NOT EXISTS idx_access_requests_patient_status
    ON access_requests(patient_id, status);

CREATE INDEX IF NOT EXISTS idx_alerts_provider_status_created
    ON alerts(provider_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_report_artifacts_patient_created
    ON report_artifacts(patient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_secure_messages_recipient_created
    ON secure_messages(recipient_provider_id, created_at DESC);

COMMIT;
