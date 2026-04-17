-- Day 2 Engineer A seed script
-- Usage:
--   psql -d <database_name> -f db/migrations/20260417_day2_engineer_a_seed.sql

BEGIN;

INSERT INTO providers (name, specialty, clinic_affiliation)
SELECT
    'Dr. Ada Platform',
    'Primary Care',
    'North Clinic'
WHERE NOT EXISTS (
    SELECT 1
    FROM providers
    WHERE name = 'Dr. Ada Platform'
      AND clinic_affiliation = 'North Clinic'
);

INSERT INTO ehr_systems (system_name, protocol)
SELECT
    candidate.system_name,
    candidate.protocol::protocol_type
FROM (
    VALUES
        ('Epic', 'FHIR'),
        ('NextGen', 'HL7')
) AS candidate(system_name, protocol)
WHERE NOT EXISTS (
    SELECT 1
    FROM ehr_systems existing
    WHERE existing.system_name = candidate.system_name
);

WITH provider_selected AS (
    SELECT provider_id
    FROM providers
    WHERE name = 'Dr. Ada Platform'
      AND clinic_affiliation = 'North Clinic'
    ORDER BY provider_id
    LIMIT 1
)
INSERT INTO patients (
    full_name,
    height,
    weight,
    family_history,
    vaccination_record,
    two_factor_enabled,
    primary_provider_id
)
SELECT
    'Jordan Patient',
    175.50,
    70.25,
    'No significant family history',
    'Influenza 2025',
    TRUE,
    provider_id
FROM provider_selected
WHERE NOT EXISTS (
    SELECT 1
    FROM patients
    WHERE full_name = 'Jordan Patient'
);

WITH patient_selected AS (
    SELECT patient_id
    FROM patients
    WHERE full_name = 'Jordan Patient'
    ORDER BY patient_id
    LIMIT 1
), ehr_selected AS (
    SELECT system_id, system_name
    FROM ehr_systems
    WHERE system_name IN ('Epic', 'NextGen')
)
INSERT INTO medical_record_items (
    patient_id,
    system_id,
    category,
    value_description,
    recorded_at
)
SELECT
    p.patient_id,
    e.system_id,
    'Medication',
    CASE WHEN e.system_name = 'Epic' THEN 'Aspirin 81mg' ELSE 'Topical steroid' END,
    CURRENT_TIMESTAMP
FROM patient_selected p
CROSS JOIN ehr_selected e
WHERE NOT EXISTS (
    SELECT 1
    FROM medical_record_items mri
    WHERE mri.patient_id = p.patient_id
      AND mri.system_id = e.system_id
      AND mri.category = 'Medication'
);

WITH patient_selected AS (
    SELECT patient_id
    FROM patients
    WHERE full_name = 'Jordan Patient'
    ORDER BY patient_id
    LIMIT 1
), ehr_selected AS (
    SELECT system_id
    FROM ehr_systems
    WHERE system_name IN ('Epic', 'NextGen')
)
INSERT INTO sync_metadata (
    patient_id,
    system_id,
    category,
    sync_direction,
    last_synced_at
)
SELECT
    p.patient_id,
    e.system_id,
    'Medication',
    'bidirectional',
    CURRENT_TIMESTAMP
FROM patient_selected p
CROSS JOIN ehr_selected e
ON CONFLICT (patient_id, system_id, category)
DO UPDATE SET
    sync_direction = EXCLUDED.sync_direction,
    last_synced_at = EXCLUDED.last_synced_at,
    updated_at = CURRENT_TIMESTAMP;

COMMIT;
