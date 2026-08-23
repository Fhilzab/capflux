-- ==========================================================
-- CAPFLUX — FHILZAB NIG LTD
-- Migration: 202608220001_students_academic_structure.sql
-- Purpose: Students & Academic Structure system.
--   1. Formalize drifted tables already queried by the frontend
--      providers (academic_sessions, academic_terms, school_divisions,
--      fees, billing_profiles, billing_snapshots, student_charges).
--   2. Introduce academic_levels (levels under a section/division),
--      student_enrollments (immutable placement history) and
--      student_guardians (multi-guardian relationships).
--   3. Backfill enrollment/guardian data from existing students rows.
--
-- SAFETY: purely additive. students.class_name and existing financial
-- tables (ledger_entries, payment_transactions, ...) are NOT altered.
-- ==========================================================

BEGIN;

-- ==========================================================
-- 1. ACADEMIC SESSIONS (formalized)
-- Columns mirror src/shared/academic/SupabaseAcademicProvider.ts
-- ==========================================================

CREATE TABLE IF NOT EXISTS academic_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools (id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    start_date DATE,
    end_date DATE,
    is_current BOOLEAN NOT NULL DEFAULT false,
    status TEXT NOT NULL DEFAULT 'UPCOMING'
        CHECK (status IN ('UPCOMING', 'ACTIVE', 'COMPLETED', 'ARCHIVED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==========================================================
-- 2. ACADEMIC TERMS (formalized)
-- Columns mirror src/shared/academic/SupabaseAcademicProvider.ts
-- ==========================================================

CREATE TABLE IF NOT EXISTS academic_terms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES academic_sessions (id) ON DELETE CASCADE,
    school_id UUID NOT NULL REFERENCES schools (id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    term_number INTEGER NOT NULL DEFAULT 1,
    display_order INTEGER NOT NULL DEFAULT 1,
    start_date DATE,
    end_date DATE,
    is_current BOOLEAN NOT NULL DEFAULT false,
    status TEXT NOT NULL DEFAULT 'UPCOMING'
        CHECK (status IN ('UPCOMING', 'ACTIVE', 'COMPLETED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==========================================================
-- 3. SCHOOL DIVISIONS = ACADEMIC SECTIONS (formalized)
-- Columns mirror src/shared/divisions/SupabaseDivisionProvider.ts
-- ("Nursery", "Primary", "Secondary" ...)
-- ==========================================================

CREATE TABLE IF NOT EXISTS school_divisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools (id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==========================================================
-- 4. ACADEMIC LEVELS (new)
-- Levels belong to a section (school_divisions).
-- display_order drives promotion progression (never string sort).
-- ==========================================================

CREATE TABLE IF NOT EXISTS academic_levels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools (id) ON DELETE CASCADE,
    section_id UUID NOT NULL REFERENCES school_divisions (id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT,
    display_order INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (section_id, name)
);

-- ==========================================================
-- 5. STUDENTS.DIVISION_ID (formalized — was live-only drift)
-- Kept as the denormalized "current section" pointer; historical
-- truth lives in student_enrollments.
-- ==========================================================

ALTER TABLE students
    ADD COLUMN IF NOT EXISTS division_id UUID REFERENCES school_divisions (id) ON DELETE SET NULL;

-- ==========================================================
-- 6. FEES (formalized + new academic_level_id)
-- Columns mirror src/shared/fees/SupabaseFeeProvider.ts
-- ==========================================================

CREATE TABLE IF NOT EXISTS fees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner TEXT NOT NULL DEFAULT 'SCHOOL'
        CHECK (owner IN ('SCHOOL', 'PLATFORM')),
    school_id UUID REFERENCES schools (id) ON DELETE CASCADE,
    division_id UUID REFERENCES school_divisions (id) ON DELETE SET NULL,
    academic_level_id UUID REFERENCES academic_levels (id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    is_mandatory BOOLEAN NOT NULL DEFAULT true,
    is_active BOOLEAN NOT NULL DEFAULT true,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==========================================================
-- 7. BILLING PROFILES (formalized)
-- ==========================================================

CREATE TABLE IF NOT EXISTS billing_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students (id) ON DELETE CASCADE,
    school_id UUID NOT NULL REFERENCES schools (id) ON DELETE CASCADE,
    academic_session_id UUID NOT NULL REFERENCES academic_sessions (id) ON DELETE RESTRICT,
    discount_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
    billing_cycle TEXT NOT NULL DEFAULT 'SESSION'
        CHECK (billing_cycle IN ('TERM', 'SEMESTER', 'SESSION')),
    initialization_status TEXT NOT NULL DEFAULT 'PENDING'
        CHECK (initialization_status IN ('PENDING', 'ACTIVE', 'LOCKED', 'ARCHIVED', 'FAILED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (student_id, academic_session_id)
);

-- ==========================================================
-- 8. BILLING SNAPSHOTS (formalized — immutable)
-- ==========================================================

CREATE TABLE IF NOT EXISTS billing_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fee_id UUID REFERENCES fees (id) ON DELETE SET NULL,
    fee_name TEXT NOT NULL,
    fee_code TEXT NOT NULL,
    amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'NGN',
    owner TEXT NOT NULL DEFAULT 'SCHOOL'
        CHECK (owner IN ('SCHOOL', 'PLATFORM')),
    is_mandatory BOOLEAN NOT NULL DEFAULT true,
    division_id UUID,
    academic_session_id UUID,
    academic_term_id UUID,
    discount_applied NUMERIC(5,2) NOT NULL DEFAULT 0,
    net_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    billing_version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==========================================================
-- 9. STUDENT CHARGES (formalized — immutable financial context)
-- ==========================================================

CREATE TABLE IF NOT EXISTS student_charges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    billing_profile_id UUID NOT NULL REFERENCES billing_profiles (id) ON DELETE CASCADE,
    snapshot_id UUID REFERENCES billing_snapshots (id) ON DELETE SET NULL,
    student_id UUID NOT NULL REFERENCES students (id) ON DELETE RESTRICT,
    academic_session_id UUID,
    academic_term_id UUID,
    charge_source TEXT NOT NULL DEFAULT 'MANDATORY'
        CHECK (charge_source IN ('MANDATORY', 'OPTIONAL', 'PLATFORM')),
    status TEXT NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('ACTIVE', 'WAIVED', 'VOID', 'PAID', 'PARTIALLY_PAID')),
    ledger_locked BOOLEAN NOT NULL DEFAULT false,
    payment_plan_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==========================================================
-- 10. STUDENT ENROLLMENTS (new — immutable placement history)
-- One row per (student, session, period-of-placement). Movement
-- SUPERSEDES the previous row; it never updates it in place.
-- Financial records are never touched by this table's lifecycle.
-- ==========================================================

CREATE TABLE IF NOT EXISTS student_enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools (id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students (id) ON DELETE RESTRICT,
    academic_session_id UUID NOT NULL REFERENCES academic_sessions (id) ON DELETE RESTRICT,
    section_id UUID NOT NULL REFERENCES school_divisions (id) ON DELETE RESTRICT,
    level_id UUID NOT NULL REFERENCES academic_levels (id) ON DELETE RESTRICT,
    status TEXT NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('ACTIVE', 'SUPERSEDED', 'COMPLETED', 'WITHDRAWN')),
    effective_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at TIMESTAMPTZ,
    reason TEXT
        CHECK (reason IS NULL OR reason IN ('INITIAL', 'MOVEMENT', 'PROMOTION', 'IMPORT', 'MIGRATION')),
    source TEXT,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- At most one ACTIVE enrollment per student per session.
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_enrollment_per_session
    ON student_enrollments (student_id, academic_session_id)
    WHERE status = 'ACTIVE';

-- ==========================================================
-- 11. STUDENT GUARDIANS (new — multi-guardian relationships)
-- students.guardian_id remains the primary guardian pointer used
-- by notifications/billing; this join adds additional links.
-- ==========================================================

CREATE TABLE IF NOT EXISTS student_guardians (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools (id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students (id) ON DELETE CASCADE,
    guardian_id UUID NOT NULL REFERENCES guardians (id) ON DELETE CASCADE,
    relationship guardian_relationship NOT NULL DEFAULT 'GUARDIAN',
    is_primary BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (student_id, guardian_id)
);

-- At most one primary guardian per student.
CREATE UNIQUE INDEX IF NOT EXISTS uq_primary_guardian_per_student
    ON student_guardians (student_id)
    WHERE is_primary;

-- ==========================================================
-- 12. INDEXES
-- ==========================================================

CREATE INDEX IF NOT EXISTS idx_academic_sessions_school ON academic_sessions (school_id);
CREATE INDEX IF NOT EXISTS idx_academic_terms_session ON academic_terms (session_id);
CREATE INDEX IF NOT EXISTS idx_academic_terms_school ON academic_terms (school_id);
CREATE INDEX IF NOT EXISTS idx_school_divisions_school ON school_divisions (school_id);
CREATE INDEX IF NOT EXISTS idx_academic_levels_section ON academic_levels (section_id, display_order);
CREATE INDEX IF NOT EXISTS idx_academic_levels_school ON academic_levels (school_id);
CREATE INDEX IF NOT EXISTS idx_fees_school ON fees (school_id);
CREATE INDEX IF NOT EXISTS idx_fees_division ON fees (division_id);
CREATE INDEX IF NOT EXISTS idx_fees_level ON fees (academic_level_id);
CREATE INDEX IF NOT EXISTS idx_billing_profiles_student ON billing_profiles (student_id);
CREATE INDEX IF NOT EXISTS idx_billing_profiles_school ON billing_profiles (school_id);
CREATE INDEX IF NOT EXISTS idx_billing_snapshots_fee ON billing_snapshots (fee_id);
CREATE INDEX IF NOT EXISTS idx_student_charges_student ON student_charges (student_id);
CREATE INDEX IF NOT EXISTS idx_student_charges_profile ON student_charges (billing_profile_id);
CREATE INDEX IF NOT EXISTS idx_student_enrollments_student ON student_enrollments (student_id);
CREATE INDEX IF NOT EXISTS idx_student_enrollments_school ON student_enrollments (school_id);
CREATE INDEX IF NOT EXISTS idx_student_enrollments_session ON student_enrollments (academic_session_id);
CREATE INDEX IF NOT EXISTS idx_student_enrollments_level ON student_enrollments (level_id);
CREATE INDEX IF NOT EXISTS idx_student_guardians_student ON student_guardians (student_id);
CREATE INDEX IF NOT EXISTS idx_student_guardians_guardian ON student_guardians (guardian_id);
CREATE INDEX IF NOT EXISTS idx_students_division ON students (division_id);

-- ==========================================================
-- 13. BACKFILL — GUARDIAN LINKS
-- Mirror existing students.guardian_id into student_guardians.
-- ==========================================================

INSERT INTO student_guardians (school_id, student_id, guardian_id, relationship, is_primary)
SELECT s.school_id, s.id, s.guardian_id, COALESCE(g.relationship, 'GUARDIAN'), true
FROM students s
JOIN guardians g ON g.id = s.guardian_id
WHERE s.guardian_id IS NOT NULL
ON CONFLICT (student_id, guardian_id) DO NOTHING;

-- ==========================================================
-- 14. BACKFILL — ENROLLMENTS FROM LEGACY PLACEMENT
-- Students with a division get a MIGRATION enrollment in the
-- current active session at a hidden "__UNASSIGNED__" placeholder
-- level (kept INACTIVE so it never appears in normal pickers or
-- promotion paths). Ambiguous students (no division or no current
-- session) intentionally receive NO enrollment — nothing invented.
-- ==========================================================

-- Placeholder level per division (idempotent via unique (section_id, name)).
INSERT INTO academic_levels (school_id, section_id, name, code, display_order, status)
SELECT d.school_id, d.id, '__UNASSIGNED__', '__UNASSIGNED__', 999999, 'INACTIVE'
FROM school_divisions d
ON CONFLICT (section_id, name) DO NOTHING;

INSERT INTO student_enrollments (
    school_id, student_id, academic_session_id, section_id, level_id,
    status, effective_date, reason, source
)
SELECT s.school_id, s.id, sess.id, s.division_id, lvl.id,
       'ACTIVE', s.created_at, 'MIGRATION', 'MIGRATION'
FROM students s
JOIN school_divisions d ON d.id = s.division_id
JOIN academic_sessions sess
     ON sess.school_id = s.school_id AND sess.is_current = true AND sess.status = 'ACTIVE'
JOIN academic_levels lvl ON lvl.section_id = d.id AND lvl.name = '__UNASSIGNED__'
WHERE s.division_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- ==========================================================
-- 15. ROW LEVEL SECURITY
-- Same convention as tuition_configuration / fee_rules /
-- payment_accounts (migration 202607100013): tenant-scoped via
-- current_school_id(). Platform-owned fees stay readable.
-- ==========================================================

ALTER TABLE academic_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_divisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_guardians ENABLE ROW LEVEL SECURITY;

-- Policies are created idempotently (no CREATE POLICY IF NOT EXISTS);
-- if the live DB already carries an equivalent manual policy, keep it.
DO $$ BEGIN
    CREATE POLICY allow_authenticated_academic_sessions ON academic_sessions
        FOR ALL
        USING (current_school_id() = academic_sessions.school_id)
        WITH CHECK (current_school_id() = academic_sessions.school_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY allow_authenticated_academic_terms ON academic_terms
        FOR ALL
        USING (current_school_id() = academic_terms.school_id)
        WITH CHECK (current_school_id() = academic_terms.school_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY allow_authenticated_school_divisions ON school_divisions
        FOR ALL
        USING (current_school_id() = school_divisions.school_id)
        WITH CHECK (current_school_id() = school_divisions.school_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY allow_authenticated_academic_levels ON academic_levels
        FOR ALL
        USING (current_school_id() = academic_levels.school_id)
        WITH CHECK (current_school_id() = academic_levels.school_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY allow_authenticated_school_fees ON fees
        FOR ALL
        USING (current_school_id() = fees.school_id)
        WITH CHECK (current_school_id() = fees.school_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Platform-owned fee templates (school_id IS NULL) are read-only
-- shared catalog rows visible to every authenticated school user.
DO $$ BEGIN
    CREATE POLICY allow_authenticated_platform_fees_read ON fees
        FOR SELECT
        USING (fees.owner = 'PLATFORM');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY allow_authenticated_billing_profiles ON billing_profiles
        FOR ALL
        USING (current_school_id() = billing_profiles.school_id)
        WITH CHECK (current_school_id() = billing_profiles.school_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY allow_authenticated_billing_snapshots ON billing_snapshots
        FOR ALL
        USING (true)
        WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY allow_authenticated_student_charges ON student_charges
        FOR ALL
        USING (EXISTS (
            SELECT 1 FROM billing_profiles bp
            WHERE bp.id = student_charges.billing_profile_id
              AND current_school_id() = bp.school_id
        ))
        WITH CHECK (EXISTS (
            SELECT 1 FROM billing_profiles bp
            WHERE bp.id = student_charges.billing_profile_id
              AND current_school_id() = bp.school_id
        ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY allow_authenticated_student_enrollments ON student_enrollments
        FOR ALL
        USING (current_school_id() = student_enrollments.school_id)
        WITH CHECK (current_school_id() = student_enrollments.school_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY allow_authenticated_student_guardians ON student_guardians
        FOR ALL
        USING (current_school_id() = student_guardians.school_id)
        WITH CHECK (current_school_id() = student_guardians.school_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMIT;
