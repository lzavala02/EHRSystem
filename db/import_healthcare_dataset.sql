-- Import script for db/healthcare_dataset.csv into the EHR schema
-- Run with psql from the project root:
--   psql -d <database_name> -f db/import_healthcare_dataset.sql
--
-- If your CSV is in a different location, update the \copy path below.

BEGIN;

-- 1) Stage flat-file data
CREATE TEMP TABLE stg_healthcare_raw (
    name TEXT,
    age INT,
    gender TEXT,
    blood_type TEXT,
    medical_condition TEXT,
    date_of_admission DATE,
    doctor TEXT,
    hospital TEXT,
    insurance_provider TEXT,
    billing_amount NUMERIC(18,6),
    room_number TEXT,
    admission_type TEXT,
    discharge_date DATE,
    medication TEXT,
    test_results TEXT
);

\copy stg_healthcare_raw FROM 'db/healthcare_dataset.csv' WITH (FORMAT csv, HEADER true)

-- 2) Upsert-like insert for providers (doctor + hospital)
INSERT INTO providers (name, specialty, clinic_affiliation)
SELECT DISTINCT
    TRIM(s.doctor) AS name,
    'General Practice' AS specialty,
    TRIM(s.hospital) AS clinic_affiliation
FROM stg_healthcare_raw s
WHERE NULLIF(TRIM(s.doctor), '') IS NOT NULL
  AND NULLIF(TRIM(s.hospital), '') IS NOT NULL
  AND NOT EXISTS (
      SELECT 1
      FROM providers p
      WHERE LOWER(p.name) = LOWER(TRIM(s.doctor))
        AND LOWER(p.clinic_affiliation) = LOWER(TRIM(s.hospital))
  );

-- 3) Insert one patient record per name (latest admission determines primary provider)
WITH latest_patient_row AS (
    SELECT DISTINCT ON (LOWER(TRIM(s.name)))
        TRIM(s.name) AS patient_name,
        s.age,
        s.gender,
        s.blood_type,
        s.insurance_provider,
        TRIM(s.doctor) AS doctor,
        TRIM(s.hospital) AS hospital,
        s.date_of_admission
    FROM stg_healthcare_raw s
    WHERE NULLIF(TRIM(s.name), '') IS NOT NULL
    ORDER BY LOWER(TRIM(s.name)), s.date_of_admission DESC NULLS LAST
)
INSERT INTO patients (
    full_name,
    family_history,
    vaccination_record,
    two_factor_enabled,
    primary_provider_id
)
SELECT
    lpr.patient_name,
    CONCAT(
        'Imported demographics: age=', COALESCE(lpr.age::TEXT, 'NA'),
        '; gender=', COALESCE(lpr.gender, 'NA'),
        '; blood_type=', COALESCE(lpr.blood_type, 'NA')
    ) AS family_history,
    CONCAT('Insurance: ', COALESCE(lpr.insurance_provider, 'Unknown')) AS vaccination_record,
    TRUE AS two_factor_enabled,
    p.provider_id
FROM latest_patient_row lpr
JOIN providers p
    ON LOWER(p.name) = LOWER(lpr.doctor)
   AND LOWER(p.clinic_affiliation) = LOWER(lpr.hospital)
WHERE NOT EXISTS (
    SELECT 1
    FROM patients pt
    WHERE LOWER(pt.full_name) = LOWER(lpr.patient_name)
);

-- 4) Create EHR system entries from insurance providers
INSERT INTO ehr_systems (system_name, protocol)
SELECT DISTINCT
    TRIM(s.insurance_provider) AS system_name,
    'HL7'::protocol_type AS protocol
FROM stg_healthcare_raw s
WHERE NULLIF(TRIM(s.insurance_provider), '') IS NOT NULL
  AND NOT EXISTS (
      SELECT 1
      FROM ehr_systems e
      WHERE LOWER(e.system_name) = LOWER(TRIM(s.insurance_provider))
  );

-- Ensure there is a fallback local source for rows missing insurance provider.
INSERT INTO ehr_systems (system_name, protocol)
SELECT
    'Clinic Repository' AS system_name,
    'FHIR'::protocol_type AS protocol
WHERE NOT EXISTS (
    SELECT 1 FROM ehr_systems WHERE LOWER(system_name) = 'clinic repository'
);

-- 5) Insert medical record items as categorized facts
WITH mapped AS (
    SELECT
        s.*,
        pt.patient_id,
        COALESCE(e.system_id, fallback.system_id) AS system_id,
        (
            COALESCE(
                s.date_of_admission::TIMESTAMP,
                CURRENT_TIMESTAMP AT TIME ZONE 'UTC'
            ) AT TIME ZONE 'UTC'
        ) AS recorded_at_ts
    FROM stg_healthcare_raw s
    JOIN patients pt
      ON LOWER(pt.full_name) = LOWER(TRIM(s.name))
    LEFT JOIN ehr_systems e
      ON LOWER(e.system_name) = LOWER(TRIM(s.insurance_provider))
    CROSS JOIN LATERAL (
        SELECT system_id
        FROM ehr_systems
        WHERE LOWER(system_name) = 'clinic repository'
        LIMIT 1
    ) AS fallback
)
INSERT INTO medical_record_items (
    patient_id,
    system_id,
    category,
    value_description,
    recorded_at
)
SELECT
    m.patient_id,
    m.system_id,
    v.category,
    v.value_description,
    m.recorded_at_ts
FROM mapped m
CROSS JOIN LATERAL (
    VALUES
        ('Medical Condition', NULLIF(TRIM(m.medical_condition), '')),
        ('Medication', NULLIF(TRIM(m.medication), '')),
        ('Test Results', NULLIF(TRIM(m.test_results), '')),
        ('Admission Type', NULLIF(TRIM(m.admission_type), '')),
        ('Room Number', NULLIF(TRIM(m.room_number), '')),
        ('Billing Amount', CASE WHEN m.billing_amount IS NULL THEN NULL ELSE m.billing_amount::TEXT END),
        ('Discharge Date', CASE WHEN m.discharge_date IS NULL THEN NULL ELSE m.discharge_date::TEXT END),
        ('Demographics', CONCAT(
            'age=', COALESCE(m.age::TEXT, 'NA'),
            '; gender=', COALESCE(m.gender, 'NA'),
            '; blood_type=', COALESCE(m.blood_type, 'NA')
        ))
) AS v(category, value_description)
WHERE v.value_description IS NOT NULL
  AND NOT EXISTS (
      SELECT 1
      FROM medical_record_items mr
      WHERE mr.patient_id = m.patient_id
        AND COALESCE(mr.system_id, '00000000-0000-0000-0000-000000000000'::UUID)
            = COALESCE(m.system_id, '00000000-0000-0000-0000-000000000000'::UUID)
        AND mr.category = v.category
        AND mr.value_description = v.value_description
        AND mr.recorded_at = m.recorded_at_ts
  );

COMMIT;
