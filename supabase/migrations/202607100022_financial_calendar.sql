-- ==========================================================
-- CAPSTONE SOFTWARE SOLUTIONS LTD
-- Migration: 202607100022_financial_calendar.sql
-- Purpose: Academic sessions and terms as financial calendar entities
-- ==========================================================

BEGIN;

-- ==========================================================
-- ACADEMIC SESSIONS TABLE (Financial Calendar)
-- ==========================================================

CREATE TABLE IF NOT EXISTS academic_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools (id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_current BOOLEAN NOT NULL DEFAULT false,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'CLOSED')),
    created_by UUID REFERENCES profiles (id),
    closed_by UUID REFERENCES profiles (id),
    closed_at TIMESTAMPTZ,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (school_id, name),
    CONSTRAINT valid_dates CHECK (end_date > start_date)
);

-- ==========================================================
-- ACADEMIC TERMS TABLE (Financial Calendar)
-- ==========================================================

CREATE TABLE IF NOT EXISTS academic_terms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools (id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES academic_sessions (id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_current BOOLEAN NOT NULL DEFAULT false,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'CLOSED')),
    created_by UUID REFERENCES profiles (id),
    closed_by UUID REFERENCES profiles (id),
    closed_at TIMESTAMPTZ,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (session_id, name),
    CONSTRAINT valid_term_dates CHECK (end_date > start_date)
);

-- ==========================================================
-- ADD FOREIGN KEY CONSTRAINTS TO SCHOOLS
-- (Adding AFTER academic tables are created)
-- ==========================================================

ALTER TABLE schools 
    ADD CONSTRAINT fk_schools_current_session 
    FOREIGN KEY (current_session_id) REFERENCES academic_sessions (id);

ALTER TABLE schools 
    ADD CONSTRAINT fk_schools_current_term 
    FOREIGN KEY (current_term_id) REFERENCES academic_terms (id);

-- ==========================================================
-- HELPER FUNCTIONS
-- ==========================================================

CREATE OR REPLACE FUNCTION current_session_id()
RETURNS UUID LANGUAGE SQL STABLE AS $$
    SELECT current_session_id FROM schools WHERE id = current_school_id();
$$;

CREATE OR REPLACE FUNCTION current_term_id()
RETURNS UUID LANGUAGE SQL STABLE AS $$
    SELECT current_term_id FROM schools WHERE id = current_school_id();
$$;

CREATE OR REPLACE FUNCTION current_academic_context()
RETURNS TABLE (session_id UUID, term_id UUID) LANGUAGE SQL STABLE AS $$
    SELECT current_session_id, current_term_id
    FROM schools
    WHERE id = current_school_id();
$$;

-- ==========================================================
-- UPDATED_AT + VERSION TRIGGERS FOR ACADEMIC TABLES
-- ==========================================================

CREATE OR REPLACE FUNCTION update_academic_session_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    NEW.version = OLD.version + 1;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS academic_session_updated_at ON academic_sessions;
CREATE TRIGGER academic_session_updated_at
    BEFORE UPDATE ON academic_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_academic_session_timestamp();

CREATE OR REPLACE FUNCTION update_academic_term_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    NEW.version = OLD.version + 1;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS academic_term_updated_at ON academic_terms;
CREATE TRIGGER academic_term_updated_at
    BEFORE UPDATE ON academic_terms
    FOR EACH ROW
    EXECUTE FUNCTION update_academic_term_timestamp();

-- ==========================================================
-- INDEXES FOR PERFORMANCE
-- ==========================================================

CREATE INDEX IF NOT EXISTS idx_academic_sessions_school ON academic_sessions (school_id);
CREATE INDEX IF NOT EXISTS idx_academic_sessions_current ON academic_sessions (school_id, is_current);
CREATE INDEX IF NOT EXISTS idx_academic_terms_school ON academic_terms (school_id);
CREATE INDEX IF NOT EXISTS idx_academic_terms_session ON academic_terms (session_id);
CREATE INDEX IF NOT EXISTS idx_academic_terms_current ON academic_terms (session_id, is_current);

-- ==========================================================
-- RLS FOR ACADEMIC TABLES
-- ==========================================================

ALTER TABLE academic_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_terms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "academic_sessions_select" ON academic_sessions
    FOR SELECT USING (tenant_has_access(academic_sessions.school_id));

CREATE POLICY "academic_sessions_insert" ON academic_sessions
    FOR INSERT WITH CHECK (tenant_has_access(academic_sessions.school_id));

CREATE POLICY "academic_sessions_update" ON academic_sessions
    FOR UPDATE USING (tenant_has_access(academic_sessions.school_id));

CREATE POLICY "academic_terms_select" ON academic_terms
    FOR SELECT USING (tenant_has_access(academic_terms.school_id));

CREATE POLICY "academic_terms_insert" ON academic_terms
    FOR INSERT WITH CHECK (tenant_has_access(academic_terms.school_id));

CREATE POLICY "academic_terms_update" ON academic_terms
    FOR UPDATE USING (tenant_has_access(academic_terms.school_id));

COMMIT;