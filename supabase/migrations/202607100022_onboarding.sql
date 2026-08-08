-- ==========================================================
-- CAPFLUX
-- Migration: 202607100022_onboarding.sql
-- Purpose: Enterprise School & Organization Onboarding + KYC Records
-- Hierarchy: User → Organization → School → Students
-- Two independent lifecycles: Operational (school.status) &
-- Payment (school.payment_status), tracked separately from KYC.
-- ==========================================================

BEGIN;

-- ==========================================================
-- ENUM TYPES
-- ==========================================================

-- School operational lifecycle
DO $$ BEGIN
    CREATE TYPE school_status AS ENUM (
        'PENDING_SETUP',
        'ACTIVE',
        'SUSPENDED',
        'ARCHIVED'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Payment activation lifecycle (separate from school status)
DO $$ BEGIN
    CREATE TYPE payment_status AS ENUM (
        'NOT_READY',
        'PENDING_KYC',
        'UNDER_REVIEW',
        'READY',
        'REJECTED',
        'SUSPENDED'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- KYC verification lifecycle
DO $$ BEGIN
    CREATE TYPE kyc_status AS ENUM (
        'PENDING',
        'UNDER_REVIEW',
        'VERIFIED',
        'REJECTED'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ==========================================================
-- ORGANIZATIONS TABLE
-- One organization may own many schools
-- ==========================================================

CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    owner_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_organizations_owner ON public.organizations(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON public.organizations(slug);

COMMENT ON TABLE public.organizations IS 'Organizations own one or more schools. Hierarchy: User → Organization → School → Students.';
COMMENT ON COLUMN public.organizations.slug IS 'Immutable auto-generated slug. Only the display name changes.';

-- ==========================================================
-- ORGANIZATION MEMBERS TABLE
-- Links users to organizations with RBAC roles
-- ==========================================================

CREATE TABLE IF NOT EXISTS public.organization_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE RESTRICT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(organization_id, user_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_org_members_org ON public.organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user ON public.organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_active ON public.organization_members(is_active) WHERE is_active = true;

COMMENT ON TABLE public.organization_members IS 'User memberships within organizations. OWNER membership created automatically when organization is created.';

-- ==========================================================
-- EXTEND SCHOOLS TABLE
-- Add organization link, operational fields, and lifecycle status columns
-- ==========================================================

-- Add organization/owner columns (plain; FKs added below after tables exist)
ALTER TABLE schools ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS owner_user_id UUID;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS lga TEXT;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'Nigeria';
ALTER TABLE schools ADD COLUMN IF NOT EXISTS school_type TEXT;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS academic_calendar JSONB DEFAULT '{}'::jsonb;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS slug TEXT;

-- Convert the temporary TEXT status columns to the canonical enum types.
-- (002 created status/payment_status as TEXT to avoid an enum-before-type
-- ordering problem; this migration defines the enums above and casts.)
-- Drop defaults before type conversion (TEXT defaults can't auto-cast to enum).
ALTER TABLE schools ALTER COLUMN status DROP DEFAULT;
ALTER TABLE schools ALTER COLUMN payment_status DROP DEFAULT;
-- Now convert to enum types.
ALTER TABLE schools ALTER COLUMN status TYPE school_status USING status::school_status;
ALTER TABLE schools ALTER COLUMN payment_status TYPE payment_status USING payment_status::payment_status;
-- Restore defaults with proper enum casting.
ALTER TABLE schools ALTER COLUMN status SET DEFAULT 'PENDING_SETUP'::school_status;
ALTER TABLE schools ALTER COLUMN payment_status SET DEFAULT 'NOT_READY'::payment_status;

-- Deferred FKs (referenced tables are created earlier in this migration)
ALTER TABLE schools DROP CONSTRAINT IF EXISTS schools_organization_id_fkey;
ALTER TABLE schools ADD CONSTRAINT schools_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE SET NULL;
ALTER TABLE schools DROP CONSTRAINT IF EXISTS schools_owner_user_id_fkey;
ALTER TABLE schools ADD CONSTRAINT schools_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES public.users(id) ON DELETE SET NULL;

-- Ensure schools.slug is unique (canonical)
CREATE UNIQUE INDEX IF NOT EXISTS uq_schools_slug ON schools(slug) WHERE slug IS NOT NULL;

-- Link profiles.user_id to public.users (deferred FK from 002)
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_user_id_fkey;
ALTER TABLE profiles ADD CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Link roles.organization_id to public.organizations (deferred FK from 020)
ALTER TABLE public.roles DROP CONSTRAINT IF EXISTS roles_organization_id_fkey;
ALTER TABLE public.roles ADD CONSTRAINT roles_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_schools_organization ON schools(organization_id);
CREATE INDEX IF NOT EXISTS idx_schools_owner_user ON schools(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_schools_status ON schools(status);
CREATE INDEX IF NOT EXISTS idx_schools_payment_status ON schools(payment_status);

COMMENT ON COLUMN schools.status IS 'Operational lifecycle: PENDING_SETUP to ACTIVE to SUSPENDED to ARCHIVED';
COMMENT ON COLUMN schools.payment_status IS 'Payment lifecycle: NOT_READY to PENDING_KYC to UNDER_REVIEW to READY; can also be REJECTED or SUSPENDED';
COMMENT ON COLUMN schools.slug IS 'Immutable auto-generated slug. Never asked from user.';

-- ==========================================================
-- EXTEND ONBOARDING_PROGRESS TABLE
-- Add checklist fields for the new onboarding flow
-- KYC is NOT tracked here — it is a compliance process tracked in kyc_records
-- ==========================================================

ALTER TABLE onboarding_progress ADD COLUMN IF NOT EXISTS profile_completed BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE onboarding_progress ADD COLUMN IF NOT EXISTS organization_completed BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE onboarding_progress ADD COLUMN IF NOT EXISTS school_completed BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE onboarding_progress ADD COLUMN IF NOT EXISTS owner_completed BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE onboarding_progress ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE onboarding_progress ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ;


-- ==========================================================
-- KYC RECORDS TABLE
-- Compliance records for financial activation.
-- KYC is a SEPARATE domain from onboarding.
-- Required for payment activation, NOT for school activation.
-- BVN/NIN stored encrypted at rest — never plaintext.
-- ==========================================================

CREATE TABLE IF NOT EXISTS public.kyc_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    -- School details
    official_email TEXT,
    official_phone TEXT,
    -- Principal
    principal_name TEXT,
    principal_phone TEXT,
    -- Organization
    cac_registration_number TEXT,
    cac_certificate_path TEXT,
    -- Owner identity (NEVER stored in plaintext)
    bvn_encrypted TEXT,
    nin_encrypted TEXT,
    bvn_last4 TEXT,
    nin_last4 TEXT,
    bvn_verification_status kyc_status DEFAULT 'PENDING',
    nin_verification_status kyc_status DEFAULT 'PENDING',
    verification_provider TEXT,
    verification_reference TEXT,
    verified_at TIMESTAMPTZ,
    -- Overall KYC status
    status kyc_status NOT NULL DEFAULT 'PENDING',
    submitted_at TIMESTAMPTZ,
    reviewed_at TIMESTAMPTZ,
    reviewed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(school_id)
);

CREATE INDEX IF NOT EXISTS idx_kyc_school ON public.kyc_records(school_id);
CREATE INDEX IF NOT EXISTS idx_kyc_status ON public.kyc_records(status);
CREATE INDEX IF NOT EXISTS idx_kyc_bvn_status ON public.kyc_records(bvn_verification_status);
CREATE INDEX IF NOT EXISTS idx_kyc_nin_status ON public.kyc_records(nin_verification_status);

COMMENT ON TABLE public.kyc_records IS 'KYC compliance records. Separate from onboarding. Required for payment activation, not for school activation. BVN/NIN stored encrypted — never plaintext.';
COMMENT ON COLUMN public.kyc_records.bvn_encrypted IS 'AES-256-GCM encrypted BVN. Only decryptable by backend compliance service.';
COMMENT ON COLUMN public.kyc_records.nin_encrypted IS 'AES-256-GCM encrypted NIN. Only decryptable by backend compliance service.';

-- Trigger to update kyc_records timestamp
CREATE OR REPLACE FUNCTION public.update_kyc_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS kyc_records_updated_at ON public.kyc_records;
CREATE TRIGGER kyc_records_updated_at
    BEFORE UPDATE ON public.kyc_records
    FOR EACH ROW
    EXECUTE FUNCTION public.update_kyc_timestamp();


-- ==========================================================
-- HELPER FUNCTIONS
-- ==========================================================

-- Generate a slug from a name (server-side, auto-generated, immutable)
CREATE OR REPLACE FUNCTION public.generate_slug(p_name TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN lower(
        regexp_replace(
            regexp_replace(p_name, '[^a-zA-Z0-9\s]', '', 'g'),
            '\s+', '-', 'g'
        )
    );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create organization with OWNER membership in one transaction
CREATE OR REPLACE FUNCTION public.create_organization_with_owner(
    p_name TEXT,
    p_owner_user_id UUID
) RETURNS UUID AS $$
DECLARE
    v_org_id UUID;
    v_slug TEXT;
    v_owner_role_id UUID;
    v_base_slug TEXT;
    v_counter INTEGER := 0;
BEGIN
    -- Generate unique slug
    v_base_slug := public.generate_slug(p_name);
    v_slug := v_base_slug;

    -- Ensure slug uniqueness
    WHILE EXISTS (SELECT 1 FROM public.organizations WHERE slug = v_slug) LOOP
        v_counter := v_counter + 1;
        v_slug := v_base_slug || '-' || v_counter;
    END LOOP;

    -- Create organization
    INSERT INTO public.organizations (name, slug, owner_user_id)
    VALUES (p_name, v_slug, p_owner_user_id)
    RETURNING id INTO v_org_id;

    -- Get OWNER system role
    SELECT id INTO v_owner_role_id FROM public.roles WHERE system_role = 'OWNER' AND is_system_role = true LIMIT 1;

    IF v_owner_role_id IS NULL THEN
        RAISE EXCEPTION 'OWNER system role not found';
    END IF;

    -- Create OWNER membership
    INSERT INTO public.organization_members (organization_id, user_id, role_id, is_active)
    VALUES (v_org_id, p_owner_user_id, v_owner_role_id, true);

    RETURN v_org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create school with onboarding progress and OWNER membership
CREATE OR REPLACE FUNCTION public.create_school_with_onboarding(
    p_organization_id UUID,
    p_name TEXT,
    p_owner_user_id UUID,
    p_address TEXT DEFAULT NULL,
    p_state TEXT DEFAULT NULL,
    p_lga TEXT DEFAULT NULL,
    p_country TEXT DEFAULT 'Nigeria',
    p_school_type TEXT DEFAULT 'MIXED',
    p_academic_calendar JSONB DEFAULT '{}'::jsonb
) RETURNS UUID AS $$
DECLARE
    v_school_id UUID;
    v_slug TEXT;
    v_owner_role_id UUID;
    v_base_slug TEXT;
    v_counter INTEGER := 0;
BEGIN
    -- Generate unique slug
    v_base_slug := public.generate_slug(p_name);
    v_slug := v_base_slug;

    WHILE EXISTS (SELECT 1 FROM schools WHERE slug = v_slug) LOOP
        v_counter := v_counter + 1;
        v_slug := v_base_slug || '-' || v_counter;
    END LOOP;

    -- Create school with PENDING_SETUP status and NOT_READY payment status
    INSERT INTO schools (
        name, slug, organization_id, owner_user_id,
        address, state, lga, country, school_type, academic_calendar,
        status, payment_status, created_at
    ) VALUES (
        p_name, v_slug, p_organization_id, p_owner_user_id,
        p_address, p_state, p_lga, p_country, p_school_type, p_academic_calendar,
        'PENDING_SETUP', 'NOT_READY', now()
    )
    RETURNING id INTO v_school_id;

    -- Get OWNER system role
    SELECT id INTO v_owner_role_id FROM public.roles WHERE system_role = 'OWNER' AND is_system_role = true LIMIT 1;

    IF v_owner_role_id IS NULL THEN
        RAISE EXCEPTION 'OWNER system role not found';
    END IF;

    -- Create OWNER school membership
    INSERT INTO public.school_members (user_id, school_id, role_id, is_active)
    VALUES (p_owner_user_id, v_school_id, v_owner_role_id, true);

    -- Create onboarding progress record
    INSERT INTO onboarding_progress (school_id, stage)
    VALUES (v_school_id, 1)
    ON CONFLICT (school_id) DO NOTHING;

    RETURN v_school_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Complete onboarding: validate checklist and activate school
CREATE OR REPLACE FUNCTION public.complete_onboarding(
    p_school_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
    v_progress onboarding_progress%ROWTYPE;
BEGIN
    -- Load onboarding progress
    SELECT * INTO v_progress FROM onboarding_progress WHERE school_id = p_school_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Onboarding progress not found for school %', p_school_id;
    END IF;

    -- Validate checklist (KYC is NOT required for onboarding completion)
    IF NOT v_progress.profile_completed THEN
        RAISE EXCEPTION 'Profile step not completed';
    END IF;

    IF NOT v_progress.organization_completed THEN
        RAISE EXCEPTION 'Organization step not completed';
    END IF;

    IF NOT v_progress.school_completed THEN
        RAISE EXCEPTION 'School step not completed';
    END IF;

    IF NOT v_progress.owner_completed THEN
        RAISE EXCEPTION 'Owner information step not completed';
    END IF;

    -- Activate school — operational lifecycle transitions to ACTIVE
    -- Payment lifecycle transitions to PENDING_KYC (not READY, not active payment)
    UPDATE schools SET
        status = 'ACTIVE',
        payment_status = 'PENDING_KYC'
    WHERE id = p_school_id;

    -- Mark onboarding as complete
    UPDATE onboarding_progress SET
        completed_at = now(),
        activated_at = now(),
        stage = 4
    WHERE school_id = p_school_id;

    -- Log activation
    INSERT INTO audit_logs (school_id, actor_id, action, entity, entity_id, metadata)
    VALUES (
        p_school_id, NULL, 'ONBOARDING_COMPLETED', 'school', p_school_id,
        jsonb_build_object('activated_at', now(), 'payment_status', 'PENDING_KYC')
    );

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Get onboarding status for a user (used by GET /api/onboarding/status)
CREATE OR REPLACE FUNCTION public.get_onboarding_status(
    p_user_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_org_member RECORD;
    v_school_member RECORD;
    v_progress onboarding_progress%ROWTYPE;
    v_school RECORD;
    v_kyc RECORD;
    v_result JSONB;
BEGIN
    -- Find user's organization membership
    SELECT om.organization_id, o.name as org_name, o.slug as org_slug
    INTO v_org_member
    FROM public.organization_members om
    JOIN public.organizations o ON o.id = om.organization_id
    WHERE om.user_id = p_user_id AND om.is_active = true
    LIMIT 1;

    -- Find user's school membership
    SELECT sm.school_id, s.name as school_name, s.slug as school_slug,
           s.status, s.payment_status, s.organization_id
    INTO v_school_member
    FROM public.school_members sm
    JOIN schools s ON s.id = sm.school_id
    WHERE sm.user_id = p_user_id AND sm.is_active = true
    LIMIT 1;

    -- Load school details, onboarding progress, and KYC record if school exists
    IF v_school_member.school_id IS NOT NULL THEN
        SELECT * INTO v_school FROM schools WHERE id = v_school_member.school_id;
        SELECT * INTO v_progress FROM onboarding_progress WHERE school_id = v_school_member.school_id;
        SELECT id, status, submitted_at, reviewed_at, rejection_reason
        INTO v_kyc FROM public.kyc_records WHERE school_id = v_school_member.school_id;
    END IF;

    v_result := jsonb_build_object(
        'user_id', p_user_id,
        'organization', CASE
            WHEN v_org_member.organization_id IS NOT NULL THEN jsonb_build_object(
                'id', v_org_member.organization_id,
                'name', v_org_member.org_name,
                'slug', v_org_member.org_slug
            )
            ELSE NULL
        END,
        'school', CASE
            WHEN v_school_member.school_id IS NOT NULL THEN jsonb_build_object(
                'id', v_school_member.school_id,
                'name', v_school_member.school_name,
                'slug', v_school_member.school_slug,
                'status', v_school_member.status::text,
                'payment_status', v_school_member.payment_status::text,
                'organization_id', v_school_member.organization_id
            )
            ELSE NULL
        END,
        'onboarding', CASE
            WHEN v_progress.school_id IS NOT NULL THEN jsonb_build_object(
                'school_id', v_progress.school_id,
                'profile_completed', v_progress.profile_completed,
                'organization_completed', v_progress.organization_completed,
                'school_completed', v_progress.school_completed,
                'owner_completed', v_progress.owner_completed,
                'completed_steps', v_progress.completed_steps,
                'completed_at', v_progress.completed_at,
                'activated_at', v_progress.activated_at
            )
            ELSE NULL
        END,
        'kyc', CASE
            WHEN v_kyc.id IS NOT NULL THEN jsonb_build_object(
                'id', v_kyc.id,
                'status', v_kyc.status::text,
                'submitted_at', v_kyc.submitted_at,
                'reviewed_at', v_kyc.reviewed_at,
                'rejection_reason', v_kyc.rejection_reason
            )
            ELSE NULL
        END
    );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================================
-- ROW LEVEL SECURITY (RLS)
-- ==========================================================

-- Enable RLS on new tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kyc_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_progress ENABLE ROW LEVEL SECURITY;

-- Organizations: users can view organizations they own or belong to
CREATE POLICY "Users can view own organizations" ON public.organizations
    FOR SELECT USING (
        auth.uid()::text IS NOT NULL AND
        (
            owner_user_id = auth.uid()::text
            OR id IN (
                SELECT organization_id FROM public.organization_members
                WHERE user_id = auth.uid()::text AND is_active = true
            )
        )
    );

-- Organization members can view their own memberships
CREATE POLICY "Users can view own org memberships" ON public.organization_members
    FOR SELECT USING (
        auth.uid()::text IS NOT NULL AND
        (
            user_id = auth.uid()::text
            OR organization_id IN (
                SELECT organization_id FROM public.organization_members om2
                WHERE om2.user_id = auth.uid()::text AND om2.is_active = true
            )
        )
    );

-- Onboarding progress: accessible to school members
CREATE POLICY "School members can view onboarding progress" ON public.onboarding_progress
    FOR SELECT USING (
        auth.uid()::text IS NOT NULL AND
        school_id IN (
            SELECT school_id FROM public.school_members
            WHERE user_id = auth.uid()::text AND is_active = true
        )
    );

-- KYC records: school members can view their school's KYC — but NEVER see encrypted BVN/NIN
CREATE POLICY "School members can view masked KYC" ON public.kyc_records
    FOR SELECT USING (
        auth.uid()::text IS NOT NULL AND
        school_id IN (
            SELECT school_id FROM public.school_members
            WHERE user_id = auth.uid()::text AND is_active = true
        )
    );

-- ==========================================================
-- RBAC RLS POLICIES (moved from migration 020)
-- These depend on public.organizations / public.organization_members,
-- which are created in THIS migration.
-- ==========================================================

-- ROLES: Readable by authenticated users; writable by SUPER_ADMIN.
CREATE POLICY "Users can view roles in their organization" ON public.roles
    FOR SELECT USING (
        auth.uid()::text IS NOT NULL AND
        (
            organization_id IS NULL -- system roles
            OR
            organization_id IN (
                SELECT organization_id FROM public.organization_members
                WHERE user_id = auth.uid()::text AND is_active = true
            )
        )
    );

CREATE POLICY "SUPER_ADMIN can manage roles" ON public.roles
    FOR ALL USING (
        auth.uid()::text IS NOT NULL AND
        EXISTS (
            SELECT 1 FROM public.school_members sm
            JOIN public.roles r ON sm.role_id = r.id
            WHERE sm.user_id = auth.uid()::text
            AND sm.is_active = true
            AND r.system_role = 'SUPER_ADMIN'
        )
    );

-- ROLE_PERMISSIONS: Follow role policies.
CREATE POLICY "Users can view role permissions in their org" ON public.role_permissions
    FOR SELECT USING (
        auth.uid()::text IS NOT NULL AND
        role_id IN (
            SELECT id FROM public.roles
            WHERE organization_id IS NULL
            OR organization_id IN (
                SELECT organization_id FROM public.organization_members
                WHERE user_id = auth.uid()::text AND is_active = true
            )
        )
    );

CREATE POLICY "SUPER_ADMIN can manage role permissions" ON public.role_permissions
    FOR ALL USING (
        auth.uid()::text IS NOT NULL AND
        EXISTS (
            SELECT 1 FROM public.school_members sm
            JOIN public.roles r ON sm.role_id = r.id
            WHERE sm.user_id = auth.uid()::text
            AND sm.is_active = true
            AND r.system_role = 'SUPER_ADMIN'
        )
    );

-- Service role (backend) has full access via service role key (bypasses RLS)

COMMIT;

