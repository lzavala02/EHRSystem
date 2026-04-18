-- Day 2 Engineer B seed script
-- Scope: psoriasis trigger checklist + minimal workflow fixtures.
--
-- Apply after schema migrations:
--   psql -d <database_name> -f db/migrations/20260417_core_schema.sql
--   psql -d <database_name> -f db/migrations/20260417_engineer_b_day2_feature_schema.sql
--   psql -d <database_name> -f db/migrations/20260417_engineer_b_day2_seed.sql

BEGIN;

INSERT INTO triggers (trigger_name)
VALUES
    ('Stress'),
    ('Lack of Sleep'),
    ('Scented Products'),
    ('Dry Weather'),
    ('Skin Injury'),
    ('Infection'),
    ('Smoking'),
    ('Alcohol')
ON CONFLICT (trigger_name) DO NOTHING;

WITH patient_selected AS (
    SELECT patient_id
    FROM patients
    WHERE full_name = 'Jordan Patient'
    ORDER BY patient_id
    LIMIT 1
), provider_selected AS (
    SELECT provider_id
    FROM providers
    WHERE name = 'Dr. Ada Platform'
      AND clinic_affiliation = 'North Clinic'
    ORDER BY provider_id
    LIMIT 1
)
INSERT INTO access_requests (patient_id, provider_id, status)
SELECT patient_selected.patient_id, provider_selected.provider_id, 'Pending'
FROM patient_selected
CROSS JOIN provider_selected
WHERE NOT EXISTS (
    SELECT 1
    FROM access_requests existing
    WHERE existing.patient_id = patient_selected.patient_id
      AND existing.provider_id = provider_selected.provider_id
      AND existing.status = 'Pending'
);

WITH patient_selected AS (
    SELECT patient_id
    FROM patients
    WHERE full_name = 'Jordan Patient'
    ORDER BY patient_id
    LIMIT 1
), provider_selected AS (
    SELECT provider_id
    FROM providers
    WHERE name = 'Dr. Ada Platform'
      AND clinic_affiliation = 'North Clinic'
    ORDER BY provider_id
    LIMIT 1
)
INSERT INTO alerts (alert_type, description, patient_id, provider_id, status)
SELECT
    'Missing Data',
    'Vaccination record needs confirmation before next visit.',
    patient_selected.patient_id,
    provider_selected.provider_id,
    'Active'
FROM patient_selected
CROSS JOIN provider_selected
WHERE NOT EXISTS (
    SELECT 1
    FROM alerts existing
    WHERE existing.patient_id = patient_selected.patient_id
      AND existing.provider_id = provider_selected.provider_id
      AND existing.alert_type = 'Missing Data'
      AND existing.status = 'Active'
);

COMMIT;
