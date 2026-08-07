-- ==========================================================
-- CAPFLUX — FHILZAB NIG LTD
-- Migration: 202607100009_guardians.sql
-- Purpose: Guardian entity for normalized parent/guardian data
-- ==========================================================

BEGIN;

-- ==========================================================
-- GUARDIAN RELATIONSHIP ENUM TYPE
-- ==========================================================

DO $$ BEGIN
    CREATE TYPE guardian_relationship AS ENUM (
        'FATHER',
        'MOTHER',
        'GUARDIAN',
        'OTHER'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ==========================================================
-- CREATE GUARDIANS TABLE
-- ==========================================================

CREATE TABLE IF NOT EXISTS guardians (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools (id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    primary_phone TEXT NOT NULL,
    secondary_phone TEXT,
    email TEXT,
    relationship guardian_relationship NOT NULL DEFAULT 'GUARDIAN',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (school_id, primary_phone)
);

-- ==========================================================
-- LINK STUDENTS TO GUARDIANS
-- ==========================================================

-- Add guardian_id to students BEFORE referencing it in the UPDATE below.
ALTER TABLE students ADD COLUMN IF NOT EXISTS guardian_id UUID REFERENCES guardians (id) ON DELETE RESTRICT;

-- ==========================================================
-- MIGRATE EXISTING GUARDIAN PHONE TO GUARDIAN RECORDS
-- ==========================================================

-- Create guardian records from existing unique guardian_phone values
INSERT INTO guardians (school_id, full_name, primary_phone, relationship)
SELECT DISTINCT ON (school_id, guardian_phone)
    school_id,
    'Parent/Guardian' AS full_name,
    guardian_phone AS primary_phone,
    'GUARDIAN' AS relationship
FROM students
WHERE guardian_phone IS NOT NULL AND guardian_phone != ''
ON CONFLICT (school_id, primary_phone) DO NOTHING;

-- Update students to link to their guardians
UPDATE students s
SET guardian_id = g.id
FROM guardians g
WHERE s.school_id = g.school_id
    AND s.guardian_phone = g.primary_phone
    AND s.guardian_id IS NULL;

-- ==========================================================
-- CREATE INDEXES FOR GUARDIANS
-- ==========================================================

CREATE INDEX IF NOT EXISTS idx_guardians_school_id 
    ON guardians (school_id);

CREATE INDEX IF NOT EXISTS idx_guardians_primary_phone 
    ON guardians (school_id, primary_phone);

CREATE INDEX IF NOT EXISTS idx_students_guardian_id 
    ON students (guardian_id);

-- ==========================================================
-- ENABLE RLS ON GUARDIANS TABLE
-- ==========================================================

ALTER TABLE guardians ENABLE ROW LEVEL SECURITY;

COMMIT;