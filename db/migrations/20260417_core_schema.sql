-- Day 2 Engineer A migration pack
-- Scope: provider/patient/ehr/medical records + sync metadata
-- Usage:
--   psql -d <database_name> -f db/migrations/20260417_day2_engineer_a_core_schema.sql

BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'protocol_type') THEN
        CREATE TYPE protocol_type AS ENUM ('FHIR', 'HL7');
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sync_direction') THEN
        CREATE TYPE sync_direction AS ENUM ('pull', 'push', 'bidirectional');
    END IF;
END
$$;

CREATE TABLE IF NOT EXISTS providers (
    provider_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    specialty TEXT,
    clinic_affiliation TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS patients (
    patient_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name TEXT NOT NULL,
    height NUMERIC(5,2),
    weight NUMERIC(5,2),
    family_history TEXT,
    vaccination_record TEXT,
    two_factor_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    primary_provider_id UUID NOT NULL REFERENCES providers(provider_id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS ehr_systems (
    system_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    system_name TEXT NOT NULL,
    protocol protocol_type NOT NULL,
    last_synced_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS medical_record_items (
    record_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,
    system_id UUID NOT NULL REFERENCES ehr_systems(system_id) ON DELETE RESTRICT,
    category TEXT NOT NULL,
    value_description TEXT NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sync_metadata (
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

CREATE INDEX IF NOT EXISTS idx_medical_records_patient_category
    ON medical_record_items(patient_id, category);

CREATE INDEX IF NOT EXISTS idx_ehr_sync
    ON ehr_systems(last_synced_at);

CREATE INDEX IF NOT EXISTS idx_sync_metadata_patient_category
    ON sync_metadata(patient_id, category);

CREATE INDEX IF NOT EXISTS idx_sync_metadata_system_last_synced
    ON sync_metadata(system_id, last_synced_at DESC);

COMMIT;
