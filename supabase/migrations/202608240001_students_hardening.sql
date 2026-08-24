-- ==========================================================
-- CAPFLUX — Migration: 202608240001_students_hardening.sql
-- Purpose: Students-domain hardening (offline integrity phase) —
--   1. students identity columns: middle_name, date_of_birth, gender,
--      admission_number, admission_date, guardian_phone.
--      The camelCase provider previously INSERTED these columns without
--      them existing in Postgres (runtime failure); they are now real,
--      matching what the offline-first repository writes. admission_number
--      is UNIQUE per school when present (partial unique index).
--   2. students.status widened from enum student_status to TEXT CHECK —
--      the register archives via 'ARCHIVED', which the enum never allowed
--      (archive was a guaranteed runtime failure on sync). Legacy enum
--      values ACTIVE/GRADUATED/LEFT remain valid; no data rewrite.
--   3. academic_sessions: UNIQUE (school_id, name) — duplicate session
--      names were possible at every layer.
--   4. school_divisions: UNIQUE (school_id, name).
--   5. Single-active-session enforced by partial unique index
--      uq_one_current_session ON academic_sessions(school_id)
--      WHERE is_current — two devices can never both mark current.
--   6. activate_academic_session(p_school_id, p_session_id): atomic
--      demote-all → promote-one RPC (replaces the non-atomic two-UPDATE
--      client path). SECURITY DEFINER + tenant self-check, same pattern
--      as set_student_primary_guardian.
-- Additive only. No migration 001–030 modified. No historical data rewritten.
-- ==========================================================

-- ==========================================================
-- 1. STUDENTS IDENTITY COLUMNS
-- ==========================================================

ALTER TABLE public.students
    ADD COLUMN IF NOT EXISTS middle_name TEXT,
    ADD COLUMN IF NOT EXISTS date_of_birth DATE NULL,
    ADD COLUMN IF NOT EXISTS gender TEXT,
    ADD COLUMN IF NOT EXISTS admission_number TEXT,
    ADD COLUMN IF NOT EXISTS admission_date DATE NULL,
    ADD COLUMN IF NOT EXISTS guardian_phone TEXT;

COMMENT ON COLUMN public.students.middle_name IS 'Optional middle name.';
COMMENT ON COLUMN public.students.date_of_birth IS 'Date of birth. PII — never exported outside the allowlisted fields.';
COMMENT ON COLUMN public.students.admission_number IS 'School-local student identifier. Unique per school when present.';

CREATE UNIQUE INDEX IF NOT EXISTS uq_students_school_admission_number
    ON public.students (school_id, admission_number)
    WHERE admission_number IS NOT NULL AND admission_number <> '';

CREATE INDEX IF NOT EXISTS idx_students_admission_number
    ON public.students (school_id, admission_number);

-- ==========================================================
-- 2. STATUS WIDENING (enum → TEXT CHECK, keeps legacy values)
-- ==========================================================

ALTER TABLE public.students
    ALTER COLUMN status TYPE TEXT,
    ALTER COLUMN status SET DEFAULT 'ACTIVE';

ALTER TABLE public.students
    DROP CONSTRAINT IF EXISTS students_status_check;

ALTER TABLE public.students
    ADD CONSTRAINT students_status_check
        CHECK (status IN ('ACTIVE', 'ARCHIVED', 'GRADUATED', 'LEFT'));

-- ==========================================================
-- 3/4. UNIQUE SESSION & SECTION NAMES PER SCHOOL
-- Dedup-safe: if pre-existing duplicates exist the unique indexes below
-- would fail loudly rather than silently pick winners. Repair first by
-- suffixing duplicates (only touches rows that violate uniqueness).
-- ==========================================================

DO $$
DECLARE
    r RECORD;
    v_suffix INTEGER;
BEGIN
    FOR r IN
        SELECT school_id, name, COUNT(*) AS c
        FROM public.academic_sessions
        GROUP BY school_id, name
        HAVING COUNT(*) > 1
    LOOP
        v_suffix := 1;
        LOOP
            UPDATE public.academic_sessions s
            SET name = format('%s (%s)', r.name, v_suffix)
            WHERE s.ctid IN (
                SELECT ctid FROM public.academic_sessions
                WHERE school_id = r.school_id AND name = r.name
                OFFSET 1 LIMIT 1
            );
            EXIT WHEN NOT FOUND;
            v_suffix := v_suffix + 1;
        END LOOP;
    END LOOP;

    FOR r IN
        SELECT school_id, name, COUNT(*) AS c
        FROM public.school_divisions
        GROUP BY school_id, name
        HAVING COUNT(*) > 1
    LOOP
        v_suffix := 1;
        LOOP
            UPDATE public.school_divisions d
            SET name = format('%s (%s)', r.name, v_suffix)
            WHERE d.ctid IN (
                SELECT ctid FROM public.school_divisions
                WHERE school_id = r.school_id AND name = r.name
                OFFSET 1 LIMIT 1
            );
            EXIT WHEN NOT FOUND;
            v_suffix := v_suffix + 1;
        END LOOP;
    END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_academic_sessions_school_name
    ON public.academic_sessions (school_id, name);

CREATE UNIQUE INDEX IF NOT EXISTS uq_school_divisions_school_name
    ON public.school_divisions (school_id, name);

-- ==========================================================
-- 5. ONE CURRENT SESSION PER SCHOOL (partial unique index)
-- Demote-all-first happens inside activate_academic_session; this index
-- makes any other path fail loudly instead of silently allowing two.
-- If legacy data already has multiple current sessions, keep only the
-- most recently updated one.
-- ==========================================================

WITH ranked AS (
    SELECT id,
           ROW_NUMBER() OVER (
               PARTITION BY school_id
               ORDER BY updated_at DESC, created_at DESC
           ) AS rn
    FROM public.academic_sessions
    WHERE is_current
)
UPDATE public.academic_sessions s
SET is_current = false, status = 'COMPLETED'
FROM ranked r
WHERE s.id = r.id AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_one_current_session
    ON public.academic_sessions (school_id)
    WHERE is_current;

-- ==========================================================
-- 6. ATOMIC SESSION ACTIVATION RPC
-- ==========================================================

CREATE OR REPLACE FUNCTION public.activate_academic_session(
    p_school_id UUID,
    p_session_id UUID
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    -- Definer functions bypass RLS: tenant self-check mirrors RLS predicate.
    IF current_school_id() IS NULL OR current_school_id() <> p_school_id THEN
        RAISE EXCEPTION 'TENANT_MISMATCH';
    END IF;

    UPDATE public.academic_sessions
    SET is_current = false, status = CASE WHEN is_current THEN 'COMPLETED' ELSE status END
    WHERE school_id = p_school_id AND is_current AND id <> p_session_id;

    UPDATE public.academic_sessions
    SET is_current = true, status = 'ACTIVE', updated_at = now()
    WHERE id = p_session_id AND school_id = p_school_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'SESSION_NOT_FOUND';
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'session_id', p_session_id
    );
END;
$$;

-- ==========================================================
-- 7. ENROLLMENT COMPOUND INDEXES (mirror Dexie v5)
-- Active roster per level and active enrollment per student are the hot
-- paths for bulk movement / promotion planning.
-- ==========================================================

CREATE INDEX IF NOT EXISTS idx_enrollments_student_status
    ON public.student_enrollments (student_id, status);

CREATE INDEX IF NOT EXISTS idx_enrollments_level_status
    ON public.student_enrollments (level_id, status);

CREATE INDEX IF NOT EXISTS idx_enrollments_session_status
    ON public.student_enrollments (academic_session_id, status);
