# RLS Migration — WorkOS to Supabase Auth

## Overview

This document describes the Row Level Security (RLS) policy migration from the
WorkOS era to the Supabase Auth era.

Under WorkOS, `auth.uid()` returned `NULL` inside PostgreSQL because WorkOS
AuthKit uses sealed session cookies, not Supabase JWTs. Policies used
`auth.uid()::text` with `IS NOT NULL` guards so that they effectively became
permissive (no-op) filters. The backend bypassed RLS entirely using the
Supabase service-role client.

Under Supabase Auth, `auth.uid()` returns the authenticated user's UUID
directly. Policies use `auth.uid()::text` for comparisons against user_id
columns — this works for both UUID and TEXT column types (UUID is cast to
TEXT for comparison), ensuring compatibility whether migration 027's UUID
conversion succeeded or was skipped due to existing WorkOS IDs.

## Prerequisites

Migration `027_supabase_auth_uuid.sql` must have run first. If it encounters
non-UUID WorkOS IDs, it skips the TEXT→UUID conversion and logs a warning.
In that case, columns remain TEXT and `auth.uid()::text` comparisons work
directly.

## Strategy: `auth.uid()::text` for universal compatibility

The migration uses `auth.uid()::text` with explicit `::text` casts on column
references (e.g., `user_id::text = auth.uid()::text`). This approach works for
**both** column types:

- If `school_members.user_id` is UUID (migration 027 succeeded): `auth.uid()::text` casts the UUID to TEXT, and `user_id::text` casts the UUID column to TEXT for comparison.
- If `school_members.user_id` is TEXT (migration 027 was skipped due to WorkOS IDs): `auth.uid()::text` returns TEXT, and `user_id::text` is a no-op on TEXT. Both are TEXT.

This eliminates the `operator does not exist: text = uuid` error that currently
occurs when the `is_super_admin` function (which takes `p_user_id UUID`) compares
against the TEXT `school_members.user_id` column.

### Tables with `::text` casts added to column references

| # | Table | Policy Name | Migration Origin | Change |
|---|-------|-------------|------------------|--------|
| 1 | `public.users` | Users can view own identity | 021 | `auth.uid()::text = id::text` |
| 2 | `public.user_profiles` | Users can view own profile | 021 | `auth.uid()::text = user_id::text` |
| 3 | `public.user_profiles` | Users can update own profile | 021 | Both `USING` and `WITH CHECK` use `user_id::text` |
| 4 | `public.permissions` | Authenticated users can view permissions | 020 | `auth.uid() IS NOT NULL` (unchanged — no comparison) |
| 5 | `public.school_members` | Users can view their own school memberships | 020 | `user_id::text = auth.uid()::text` |
| 6 | `public.school_members` | School admins can view school members | 020 | All subquery comparisons use `sm2.user_id::text` |
| 7 | `public.school_members` | SUPER_ADMIN can view all members | 020 | All subquery comparisons use `sm3.user_id::text` |
| 8 | `public.school_members` | Authorized users can manage memberships | 020 | All subquery comparisons use `sm4/sm5.user_id::text` |
| 9 | `public.profiles` | School members can view profiles | 018 | `sm.user_id::text = auth.uid()::text` |
| 10 | `public.profiles` | Users can view own profile | 018 | `auth.uid()::text = profiles.user_id::text` |
| 11 | `public.profiles` | School admins can manage profiles | 018 | All subquery comparisons use `sm.user_id::text` |
| 12 | `public.organizations` | Users can view own organizations | 022 | All conditions and subqueries use `::text` |
| 13 | `public.organization_members` | Users can view own org memberships | 022 | All conditions and subqueries use `::text` |
| 14 | `public.onboarding_progress` | School members can view onboarding progress | 022 | Subquery uses `sm.user_id::text` |
| 15 | `public.kyc_records` | School members can view masked KYC | 022 | Subquery uses `sm.user_id::text` |
| 16 | `public.roles` | Users can view roles in their organization | 022 | All conditions and subqueries use `::text` |
| 17 | `public.roles` | SUPER_ADMIN can manage roles | 022 | Subquery uses `sm.user_id::text` |
| 18 | `public.role_permissions` | Users can view role permissions in their org | 022 | All subqueries use `::text` |
| 19 | `public.role_permissions` | SUPER_ADMIN can manage role permissions | 022 | Subquery uses `sm.user_id::text` |

### Functions requiring `::text` update

| Function | Migration Origin | Change |
|----------|-----------------|--------|
| `log_admin_status_change()` | 018 | `auth.uid()::text` for actor ID (parameter changed to TEXT) |
| `is_super_admin(p_user_id)` | 020 | Parameter changed from `UUID` to `TEXT`; `sm.user_id::text = p_user_id` |

## Tenant Isolation Guarantees

Every policy follows the same pattern:

```sql
USING (
    auth.uid() IS NOT NULL AND           -- reject unauthenticated
    ... membership check anchored to auth.uid()::text ...
)
```

- `auth.uid()` ties identity to the Supabase Auth JWT — no client-supplied IDs.
- `auth.uid()::text` casts the UUID to TEXT for universal column comparison.
- Subquery-based membership lookups scope every query to the requesting user's
  school. Unauthenticated and cross-school access are structurally impossible
  through these policies.

## Verification Checklist

- [ ] All column references use `::text` cast (grep for `auth.uid()` without `::text`)
- [ ] `auth.uid() IS NOT NULL` gates preserved on all "authenticated users" policies
- [ ] `school_members.user_id` type checked (UUID or TEXT)
- [ ] `is_super_admin` function accepts TEXT parameter
- [ ] `log_admin_status_change()` function uses TEXT actor ID
- [ ] No `USING (true)` or equivalent wildcard policies
- [ ] RLS remains ENABLED on all tables
- [ ] Cross-school access test passes (see `backend/tests/schoolIsolation.test.js`)

## Migration SQL

File: `supabase/migrations/202607100028_supabase_rls_migration.sql`

This migration drops and recreates every affected policy and function. It is
designed to run atomically in a single transaction — if any policy fails to
recreate, the entire transaction rolls back.

**Not yet applied** — awaiting migration 027 and live database validation.
The SQL has been statically reviewed for correctness.
