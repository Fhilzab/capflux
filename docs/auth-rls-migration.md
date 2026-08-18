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
directly. Policies can and should use `auth.uid()` natively — no `::text` cast.

## Prerequisites

Migration `027_supabase_auth_uuid.sql` must have run first, converting
`school_members.user_id` from TEXT back to UUID. Without that step,
`auth.uid()` (UUID) would fail to compare against `user_id` (TEXT) without
an explicit cast.

## Policies Requiring Migration

### Tables with `auth.uid()::text` → `auth.uid()`

| # | Table | Policy Name | Migration Origin | Change |
|---|-------|-------------|------------------|--------|
| 1 | `public.users` | Users can view own identity | 021 | `auth.uid()::text = id` → `auth.uid() = id` |
| 2 | `public.user_profiles` | Users can view own profile | 021 | `auth.uid()::text = user_id` → `auth.uid() = user_id` |
| 3 | `public.user_profiles` | Users can update own profile | 021 | Both `USING` and `WITH CHECK` updated |
| 4 | `public.permissions` | Authenticated users can view permissions | 020 | `auth.uid()::text IS NOT NULL` → `auth.uid() IS NOT NULL` |
| 5 | `public.school_members` | Users can view their own school memberships | 020 | All `::text` removed |
| 6 | `public.school_members` | School admins can view school members | 020 | All `::text` removed from subquery |
| 7 | `public.school_members` | SUPER_ADMIN can view all members | 020 | All `::text` removed from subquery |
| 8 | `public.school_members` | Authorized users can manage memberships | 020 | All `::text` removed from subqueries |
| 9 | `public.profiles` | School members can view profiles | 018 | `sm.user_id = auth.uid()::text` → `auth.uid()` |
| 10 | `public.profiles` | Users can view own profile | 018 | `auth.uid()::text = profiles.user_id` → `auth.uid() = profiles.user_id` |
| 11 | `public.profiles` | School admins can manage profiles | 018 | Both `USING` and `WITH CHECK` subqueries updated |
| 12 | `public.organizations` | Users can view own organizations | 022 | All `::text` removed from conditions and subqueries |
| 13 | `public.organization_members` | Users can view own org memberships | 022 | All `::text` removed |
| 14 | `public.onboarding_progress` | School members can view onboarding progress | 022 | All `::text` removed |
| 15 | `public.kyc_records` | School members can view masked KYC | 022 | All `::text` removed |
| 16 | `public.roles` | Users can view roles in their organization | 022 | All `::text` removed from conditions and subqueries |
| 17 | `public.roles` | SUPER_ADMIN can manage roles | 022 | `auth.uid()::text` → `auth.uid()` |
| 18 | `public.role_permissions` | Users can view role permissions in their org | 022 | All `::text` removed |
| 19 | `public.role_permissions` | SUPER_ADMIN can manage role permissions | 022 | `auth.uid()::text` → `auth.uid()` |

### Functions

| Function | Migration Origin | Change |
|----------|-----------------|--------|
| `log_admin_status_change()` | 018 | `auth.uid()::text` → `auth.uid()` in actor ID assignment |

## Tenant Isolation Guarantees

Every policy follows the same pattern:

```sql
USING (
    auth.uid() IS NOT NULL AND           -- reject unauthenticated
    ... membership check anchored to auth.uid() ...
)
```

- `auth.uid()` ties identity to the Supabase Auth JWT — no client-supplied IDs.
- `school_members.user_id` is now UUID, matching `auth.uid()`.
- Subquery-based membership lookups scope every query to the requesting user's
  school. Unauthenticated and cross-school access are structurally impossible
  through these policies.

## Verification Checklist

- [ ] All `auth.uid()::text` references removed (grep returns 0 results)
- [ ] All `auth.uid()::text` → `auth.uid()` in subqueries
- [ ] `log_admin_status_change()` function updated
- [ ] `auth.uid() IS NOT NULL` gates preserved on all "authenticated users" policies
- [ ] `school_members.user_id` is UUID (migration 027 prerequisite)
- [ ] No `USING (true)` or equivalent wildcard policies
- [ ] RLS remains ENABLED on all tables
- [ ] Cross-school access test passes (see `backend/tests/schoolIsolation.test.js`)

## Migration SQL

File: `supabase/migrations/202607100028_supabase_rls_migration.sql`

This migration drops and recreates every affected policy. It is designed to
run atomically in a single transaction — if any policy fails to recreate, the
entire transaction rolls back.
