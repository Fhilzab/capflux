-- ===============================================================
-- CAPFLUX — SUPABASE AUTH MIGRATION
-- Migration: 202607100028_supabase_rls_migration.sql
-- Purpose: Update RLS policies for Supabase Auth identity model.
--
-- LIVE DATABASE STATUS (Phase 5 verified):
--   - school_members.user_id is TEXT (contains WorkOS IDs)
--   - public.users.id is TEXT (mixed UUID and WorkOS IDs)
--   - If migration 027's UUID conversion succeeded → columns are UUID
--   - If migration 027's UUID conversion was skipped → columns remain TEXT
--
-- This migration uses auth.uid()::text which works for BOTH UUID and
-- TEXT column types (auth.uid() returns UUID; ::text casts it to a
-- string that matches either UUID::text or TEXT column values).
-- ===============================================================

BEGIN;

-- ============================================================
-- 1. public.users — "Users can view own identity"
-- ============================================================
DROP POLICY IF EXISTS "Users can view own identity" ON public.users;
CREATE POLICY "Users can view own identity"
    ON public.users FOR SELECT
    USING (auth.uid()::text = id::text);

-- ============================================================
-- 2. public.user_profiles — "Users can view own profile"
-- ============================================================
DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
CREATE POLICY "Users can view own profile"
    ON public.user_profiles FOR SELECT
    USING (auth.uid()::text = user_id::text);

-- ============================================================
-- 3. public.user_profiles — "Users can update own profile"
-- ============================================================
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
CREATE POLICY "Users can update own profile"
    ON public.user_profiles FOR UPDATE
    USING (auth.uid()::text = user_id::text)
    WITH CHECK (auth.uid()::text = user_id::text);

-- ============================================================
-- 4. public.permissions — "Authenticated users can view permissions"
--    auth.uid() IS NOT NULL works for both UUID and TEXT contexts.
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can view permissions" ON public.permissions;
CREATE POLICY "Authenticated users can view permissions"
    ON public.permissions FOR SELECT
    USING (auth.uid() IS NOT NULL);

-- ============================================================
-- 5. public.school_members — "Users can view their own school memberships"
-- ============================================================
DROP POLICY IF EXISTS "Users can view their own school memberships" ON public.school_members;
CREATE POLICY "Users can view their own school memberships"
    ON public.school_members FOR SELECT
    USING (
        auth.uid() IS NOT NULL AND
        user_id::text = auth.uid()::text
    );

-- ============================================================
-- 6. public.school_members — "School admins can view school members"
-- ============================================================
DROP POLICY IF EXISTS "School admins can view school members" ON public.school_members;
CREATE POLICY "School admins can view school members"
    ON public.school_members FOR SELECT
    USING (
        auth.uid() IS NOT NULL AND
        EXISTS (
            SELECT 1 FROM public.school_members sm2
            JOIN public.roles r2 ON sm2.role_id = r2.id
            WHERE sm2.user_id::text = auth.uid()::text
            AND sm2.school_id = school_members.school_id
            AND sm2.is_active = true
            AND r2.system_role IN ('OWNER', 'ADMIN', 'BURSAR')
        )
    );

-- ============================================================
-- 7. public.school_members — "SUPER_ADMIN can view all members"
-- ============================================================
DROP POLICY IF EXISTS "SUPER_ADMIN can view all members" ON public.school_members;
CREATE POLICY "SUPER_ADMIN can view all members"
    ON public.school_members FOR SELECT
    USING (
        auth.uid() IS NOT NULL AND
        EXISTS (
            SELECT 1 FROM public.school_members sm3
            JOIN public.roles r3 ON sm3.role_id = r3.id
            WHERE sm3.user_id::text = auth.uid()::text
            AND sm3.is_active = true
            AND r3.system_role = 'SUPER_ADMIN'
        )
    );

-- ============================================================
-- 8. public.school_members — "Authorized users can manage memberships"
-- ============================================================
DROP POLICY IF EXISTS "Authorized users can manage memberships" ON public.school_members;
CREATE POLICY "Authorized users can manage memberships"
    ON public.school_members FOR ALL
    USING (
        auth.uid() IS NOT NULL AND
        (
            EXISTS (
                SELECT 1 FROM public.school_members sm4
                JOIN public.roles r4 ON sm4.role_id = r4.id
                WHERE sm4.user_id::text = auth.uid()::text
                AND sm4.school_id = school_members.school_id
                AND sm4.is_active = true
                AND r4.system_role IN ('OWNER', 'ADMIN')
            )
            OR
            EXISTS (
                SELECT 1 FROM public.school_members sm5
                JOIN public.roles r5 ON sm5.role_id = r5.id
                WHERE sm5.user_id::text = auth.uid()::text
                AND sm5.is_active = true
                AND r5.system_role = 'SUPER_ADMIN'
            )
        )
    );

-- ============================================================
-- 9. public.profiles — "School members can view profiles"
-- ============================================================
DROP POLICY IF EXISTS "School members can view profiles" ON profiles;
CREATE POLICY "School members can view profiles"
    ON profiles FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.school_members sm
            WHERE sm.user_id::text = auth.uid()::text
            AND sm.school_id = profiles.school_id
            AND sm.is_active = true
        )
    );

-- ============================================================
-- 10. public.profiles — "Users can view own profile"
-- ============================================================
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile"
    ON profiles FOR SELECT
    USING (auth.uid()::text = profiles.user_id::text);

-- ============================================================
-- 11. public.profiles — "School admins can manage profiles"
-- ============================================================
DROP POLICY IF EXISTS "School admins can manage profiles" ON profiles;
CREATE POLICY "School admins can manage profiles"
    ON profiles FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.school_members sm
            JOIN public.roles r ON r.id = sm.role_id
            WHERE sm.user_id::text = auth.uid()::text
            AND sm.school_id = profiles.school_id
            AND sm.is_active = true
            AND r.system_role IN ('OWNER', 'ADMIN')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.school_members sm
            JOIN public.roles r ON r.id = sm.role_id
            WHERE sm.user_id::text = auth.uid()::text
            AND sm.school_id = profiles.school_id
            AND sm.is_active = true
            AND r.system_role IN ('OWNER', 'ADMIN')
        )
    );

-- ============================================================
-- 12. public.organizations — "Users can view own organizations"
-- ============================================================
DROP POLICY IF EXISTS "Users can view own organizations" ON public.organizations;
CREATE POLICY "Users can view own organizations"
    ON public.organizations FOR SELECT
    USING (
        auth.uid() IS NOT NULL AND
        (
            owner_user_id::text = auth.uid()::text
            OR id IN (
                SELECT organization_id FROM public.organization_members
                WHERE user_id::text = auth.uid()::text
                AND is_active = true
            )
        )
    );

-- ============================================================
-- 13. public.organization_members — "Users can view own org memberships"
-- ============================================================
DROP POLICY IF EXISTS "Users can view own org memberships" ON public.organization_members;
CREATE POLICY "Users can view own org memberships"
    ON public.organization_members FOR SELECT
    USING (
        auth.uid() IS NOT NULL AND
        (
            user_id::text = auth.uid()::text
            OR organization_id IN (
                SELECT organization_id FROM public.organization_members om2
                WHERE om2.user_id::text = auth.uid()::text
                AND om2.is_active = true
            )
        )
    );

-- ============================================================
-- 14. public.onboarding_progress — "School members can view onboarding progress"
-- ============================================================
DROP POLICY IF EXISTS "School members can view onboarding progress" ON public.onboarding_progress;
CREATE POLICY "School members can view onboarding progress"
    ON public.onboarding_progress FOR SELECT
    USING (
        auth.uid() IS NOT NULL AND
        school_id IN (
            SELECT school_id FROM public.school_members
            WHERE user_id::text = auth.uid()::text
            AND is_active = true
        )
    );

-- ============================================================
-- 15. public.kyc_records — "School members can view masked KYC"
-- ============================================================
DROP POLICY IF EXISTS "School members can view masked KYC" ON public.kyc_records;
CREATE POLICY "School members can view masked KYC"
    ON public.kyc_records FOR SELECT
    USING (
        auth.uid() IS NOT NULL AND
        school_id IN (
            SELECT school_id FROM public.school_members
            WHERE user_id::text = auth.uid()::text
            AND is_active = true
        )
    );

-- ============================================================
-- 16. public.roles — "Users can view roles in their organization"
-- ============================================================
DROP POLICY IF EXISTS "Users can view roles in their organization" ON public.roles;
CREATE POLICY "Users can view roles in their organization"
    ON public.roles FOR SELECT
    USING (
        auth.uid() IS NOT NULL AND
        (
            organization_id IS NULL -- system roles
            OR
            organization_id IN (
                SELECT organization_id FROM public.organization_members
                WHERE user_id::text = auth.uid()::text
                AND is_active = true
            )
        )
    );

-- ============================================================
-- 17. public.roles — "SUPER_ADMIN can manage roles"
-- ============================================================
DROP POLICY IF EXISTS "SUPER_ADMIN can manage roles" ON public.roles;
CREATE POLICY "SUPER_ADMIN can manage roles"
    ON public.roles FOR ALL
    USING (
        auth.uid() IS NOT NULL AND
        EXISTS (
            SELECT 1 FROM public.school_members sm
            JOIN public.roles r ON sm.role_id = r.id
            WHERE sm.user_id::text = auth.uid()::text
            AND sm.is_active = true
            AND r.system_role = 'SUPER_ADMIN'
        )
    );

-- ============================================================
-- 18. public.role_permissions — "Users can view role permissions in their org"
-- ============================================================
DROP POLICY IF EXISTS "Users can view role permissions in their org" ON public.role_permissions;
CREATE POLICY "Users can view role permissions in their org"
    ON public.role_permissions FOR SELECT
    USING (
        auth.uid() IS NOT NULL AND
        role_id IN (
            SELECT id FROM public.roles
            WHERE organization_id IS NULL
            OR organization_id IN (
                SELECT organization_id FROM public.organization_members
                WHERE user_id::text = auth.uid()::text
                AND is_active = true
            )
        )
    );

-- ============================================================
-- 19. public.role_permissions — "SUPER_ADMIN can manage role permissions"
-- ============================================================
DROP POLICY IF EXISTS "SUPER_ADMIN can manage role permissions" ON public.role_permissions;
CREATE POLICY "SUPER_ADMIN can manage role permissions"
    ON public.role_permissions FOR ALL
    USING (
        auth.uid() IS NOT NULL AND
        EXISTS (
            SELECT 1 FROM public.school_members sm
            JOIN public.roles r ON sm.role_id = r.id
            WHERE sm.user_id::text = auth.uid()::text
            AND sm.is_active = true
            AND r.system_role = 'SUPER_ADMIN'
        )
    );

-- ============================================================
-- 20. Function: log_admin_status_change()
--     Updated to use auth.uid()::text for TEXT-compatible actor ID.
-- ============================================================
CREATE OR REPLACE FUNCTION log_admin_status_change()
RETURNS TRIGGER AS $$
DECLARE
    v_actor_id TEXT;
BEGIN
    -- Under Supabase Auth, auth.uid() returns the authenticated user's UUID.
    -- Cast to TEXT for compatibility with both UUID and TEXT column types.
    v_actor_id := auth.uid()::text;
    IF v_actor_id IS NULL OR v_actor_id = '' THEN
        v_actor_id := NEW.user_id::text;
    END IF;
    IF v_actor_id IS NULL OR v_actor_id = '' THEN
        v_actor_id := '00000000-0000-0000-0000-000000000000';
    END IF;

    IF OLD.admin_status IS DISTINCT FROM NEW.admin_status THEN
        INSERT INTO audit_logs (school_id, actor_id, action, entity, entity_id, metadata)
        VALUES (NEW.school_id, v_actor_id, 'ADMIN_' || UPPER(NEW.admin_status), 'profile', NEW.id,
            jsonb_build_object('previous_status', OLD.admin_status));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
