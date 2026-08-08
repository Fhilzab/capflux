-- ==========================================================
-- FHILZAB NIG LTD
-- Migration: 202607100021_workos_auth.sql
-- Purpose: Add WorkOS authentication tables and user/profile mapping
-- ==========================================================

BEGIN;

-- Users table for external authentication records
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    auth_provider TEXT NOT NULL DEFAULT 'workos',
    email_verified BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.users IS 'Application user records mapped from WorkOS IDs.';
COMMENT ON COLUMN public.users.auth_provider IS 'The external auth provider used to create the user.';

CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);

-- User profiles for extended metadata
CREATE TABLE IF NOT EXISTS public.user_profiles (
    user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    full_name TEXT,
    phone TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.user_profiles IS 'Profile metadata for application users.';

-- Extend school_members and organization_members to reference public.users
ALTER TABLE public.school_members
    DROP CONSTRAINT IF EXISTS school_members_user_id_fkey;

ALTER TABLE public.school_members
    ADD COLUMN IF NOT EXISTS user_id TEXT;

-- user_id column on school_members is TEXT to match public.users (WorkOS string IDs).
-- No conversion needed; the column was aligned to TEXT in the deployment fix.
-- ALTER COLUMN TYPE is blocked by RLS policy dependencies, so skip if already TEXT.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'school_members'
          AND column_name = 'user_id' AND data_type = 'uuid'
    ) THEN
        ALTER TABLE public.school_members ALTER COLUMN user_id TYPE TEXT USING user_id::text;
    END IF;
END $$;

ALTER TABLE public.school_members
    ADD CONSTRAINT school_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Ensure organization_members references public.users when present
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'organization_members'
          AND column_name = 'user_id'
          AND data_type = 'uuid'
    ) THEN
        EXECUTE 'ALTER TABLE public.organization_members DROP CONSTRAINT IF EXISTS organization_members_user_id_fkey;';
        EXECUTE 'ALTER TABLE public.organization_members ALTER COLUMN user_id TYPE TEXT USING user_id::text;';
        EXECUTE 'ALTER TABLE public.organization_members ADD CONSTRAINT organization_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update timestamps on users and profiles
CREATE OR REPLACE FUNCTION public.update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS users_updated_at ON public.users;
CREATE TRIGGER users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.update_timestamp();

DROP TRIGGER IF EXISTS user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER user_profiles_updated_at
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_timestamp();

-- ==========================================================
-- ROW LEVEL SECURITY
-- ==========================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Users may read their own identity row
CREATE POLICY "Users can view own identity"
    ON public.users FOR SELECT
    USING (auth.uid()::text = id);

-- Users may read/update their own profile
CREATE POLICY "Users can view own profile"
    ON public.user_profiles FOR SELECT
    USING (auth.uid()::text = user_id);

CREATE POLICY "Users can update own profile"
    ON public.user_profiles FOR UPDATE
    USING (auth.uid()::text = user_id)
    WITH CHECK (auth.uid()::text = user_id);

-- Service role writes are handled by the backend (no anon/authenticated insert needed).

-- ==========================================================
-- DATA MIGRATION: Map existing Supabase users to app users
-- ==========================================================
-- Existing users who authenticated through Supabase are migrated into
-- public.users + public.user_profiles keyed by their Supabase auth.users id.
-- Their email is preserved so WorkOS identities can be linked later.

INSERT INTO public.users (id, email, auth_provider, email_verified, created_at, updated_at)
SELECT
    au.id::UUID,
    au.email,
    'supabase',
    COALESCE(au.email_confirmed_at IS NOT NULL, false),
    COALESCE(au.created_at, now()),
    COALESCE(au.updated_at, now())
FROM auth.users au
ON CONFLICT (id) DO NOTHING;

-- Seed: create app users for existing profiles (legacy profiles have no
-- matching auth.users row on a fresh database). Uses the profile id as the
-- user id so that user_profiles FK (user_id → users.id) is satisfied.
INSERT INTO public.users (id, email, auth_provider, email_verified, created_at, updated_at)
SELECT
    p.id,
    COALESCE(p.email, 'legacy-' || p.id::text),
    'legacy',
    false,
    COALESCE(p.created_at, now()),
    COALESCE(p.updated_at, now())
FROM profiles p
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_profiles (user_id, full_name, phone, avatar_url, created_at, updated_at)
SELECT
    p.id::UUID,
    p.full_name,
    p.phone,
    NULL,
    COALESCE(p.created_at, now()),
    now()
FROM profiles p
ON CONFLICT (user_id) DO NOTHING;

COMMIT;
