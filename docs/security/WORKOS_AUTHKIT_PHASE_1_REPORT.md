# CAPFLUX WorkOS AuthKit — PHASE 1 REPORT

> **PHASE 1 STATUS: CLOSED ON COMPENSATING EVIDENCE (owner sign-off pending)**
> Step 4 probes passed live (owner-executed, zero errors). Historical Step 0b/0c
> baseline artifacts were not persisted and therefore cannot be independently
> diffed; closure rests on the compensating-evidence review in
> `WORKOS_AUTHKIT_PHASE_1_STEP5_EVIDENCE_GAP_REVIEW.md`. A fresh 0b/0c baseline
> must be captured and committed as the immediate post-closure action.
> **Date:** 2026-08-23 (updated after blocker resolution)
> **Scope honored:** no WorkOS authentication implemented; no users migrated;
> no financial data touched.

---

## 0. Blocker Resolution Record

### SC-1 RESOLVED — numbering
Owner approved renumbering. Phase 1 artifacts are now:
- `supabase/migrations/202608230002_user_identity_links.sql`
  sha256 `1aa183667aa31b77e318dd26ed1a2a81626e328f74b9dff39b928cfd79e78f67`
- `supabase/migrations/202608230003_rls_identity_shim.sql`
  sha256 `c031ea30f6981cbfdb313af516bfeb50ecb7b851c33e241f3c25814b6c2864f2`

Verified before creation: target filenames did not exist; zero prior
definitions of `user_identity_links`/`requesting_user_id` anywhere in
`supabase/`; lexicographic ordering after committed
`202608230001_guardian_relationships.sql` confirmed (`LC_ALL=C sort -c` OK).
The guardian migration was NOT modified, renamed, reordered, or read beyond
its header for collision analysis.

### SC-2 RESOLVED — sanctioned execution path
Supabase **Dashboard → SQL Editor** by the owner. No Postgres password or
direct connection string was sought, used, or fabricated; service-role
credentials were not used as a DDL substitute.
Owner-facing package: `docs/security/WORKOS_AUTHKIT_PHASE_1_EXECUTION_PACKAGE.md`
containing both exact SQL blocks, execution order, expected results, rollback,
post-execution verification, all 15 probes as runnable SQL, catalog-diff and
financial-invariance queries.

### Static SQL review performed (checklist evidence)
Qualified relation references only · `SET search_path=''` with implicit
pg_catalog reliance limited to operators/functions · STRICT-select semantics
(`no_data_found`→NULL deny, `too_many_rows`→loud raise) · exception coverage
for malformed claims/UUID casts · STABLE volatility · SECURITY DEFINER with
narrow EXECUTE grants (authenticated+service_role; PUBLIC/anon revoked) ·
deny-by-default RLS (ENABLE + zero policies) + explicit REVOKE from
anon/authenticated · idempotent DDL (`IF NOT EXISTS`/`OR REPLACE`) · fully
transactional · regex anchored subject validation on BOTH insert (CHECK) and
resolution paths · probe harness transaction-wrapped with mandatory ROLLBACK.

## 0b. Status machine for this phase

| State | Condition |
|---|---|
| **BLOCKED** ← current | Files exist & validated; owner has not yet executed Steps 1–5 of the package |
| EXECUTED — VERIFICATION PENDING | Owner confirms both migrations ran |
| CLOSED | All 15 probes pass + catalog diff clean + compliance delta=0 + tests/typecheck/build green |

Gate file intentionally NOT updated yet — evidence does not exist until
execution completes ("do not mark a gate CLOSED based on intention").

---

## 1. Objective

Implement Phase 1 of the approved plan only: create the
`user_identity_links` bridge table and the fail-closed
`public.requesting_user_id()` shim, verify them, and report. The existing
CAPFLUX UUID identity model remains canonical throughout.

## 2. Pre-Flight Results

| Check | Result |
|---|---|
| Git status inspected | 6 modified frontend files + 1 new untracked frontend file — ALL unrelated concurrent student/guardian-domain work; **untouched** (list §17) |
| Decision package confirmed | D1–D10 CLOSED, C1–C4 CLOSED, gate = IMPLEMENTATION READY (`IMPLEMENTATION_GATE.md:59`) verified |
| Repo search for prior art | `user_identity_links` / `requesting_user_id`: **0 occurrences** under `supabase/`, `backend/`, `frontend/src/` — neither object exists |
| Live schema (read-only, via existing service config) | HTTP 200 introspection: `users.id`=uuid, `user_profiles.user_id`=uuid, `school_members.user_id`=uuid; financial tables present (`payment_transactions` 19 cols, `payment_accounts` 22, `ledger_entries` 14, `settlement_records` 12, `audit_logs` 8); `/rpc/requesting_user_id` NOT exposed ⇒ object absent |
| Migration history inspected | Latest applied-by-file series ends `202607100030`; committed `202608220001_students_academic_structure.sql`; **committed `202608230001_guardian_relationships.sql` exists at HEAD `d56a250`** |

## 3. STOP CONDITIONS ENCOUNTERED (per protocol — reported, not worked around)

### SC-1 — Mandated migration number collides with a committed migration
The tasking mandates `supabase/migrations/202608230001_user_identity_links.sql`
and `.../202608230002_rls_identity_shim.sql`. Investigation:

- `202608230001_guardian_relationships.sql` is **tracked at HEAD (`d56a250`,
  "Add TS migration working tree…")** and implements the owner's separate
  Guardian Relationships phase (`student_guardians.updated_at`, enum widening,
  `set_student_primary_guardian` RPC). It is unrelated to identity work.
- Creating my file at that number would collide; renaming THEIR file would
  modify committed owner work; overwriting is forbidden.
- The two mandates ("use these exact filenames" ∧ "migration numbers do not
  collide") are mutually unsatisfiable as written.

**Proposed resolution (requires one-line owner approval):**
re-number Phase 1 artifacts to the next free ordinals —
`202608230002_user_identity_links.sql` and
`202608230003_rls_identity_shim.sql` — leaving the guardian migration
absolutely untouched. All content below is ordinal-independent.

### SC-2 — Live application cannot be executed with available secrets
Local configuration exposes PostgREST-level access only
(`SUPABASE_URL` + `SUPABASE_SECRET_KEY`; variable NAMES listed in §18, values
never printed). There is no direct Postgres connection string
(`SUPABASE_DB_URL`/`DATABASE_URL` absent) and no authenticated Supabase CLI
session, so DDL cannot be executed from this environment through any
sanctioned mechanism.

**Required designation (owner):** either (a) an operator applies §5–§6 SQL +
runs §7 probes via the Supabase dashboard SQL editor / linked CLI after SC-1
resolution, or (b) a direct Postgres connection secret is provisioned through
the normal secret channel for automated execution.

Per instructions ("a secret is required but unavailable" ⇒ STOP), no execution
was attempted or simulated.

## 4. Application Verification (executed — environment unaffected by Phase 1)

| Gate | Command | Result |
|---|---|---|
| Typecheck | `npm run typecheck` | PASS |
| Typecheck tests | `npm run typecheck:tests` | PASS |
| Build | `npm run build` | PASS |
| Backend suite | `npm test` | **216/216 pass**, 49 suites, 0 fail/cancelled/skipped |
| Compliance audit | `npm run compliance:audit` | PASS=2 PARTIAL=7 FAIL=1 — the single FAIL is `check-secrets` = **pre-existing COMP-001** (lookalike credential text in historical `docs/auth-migration-audit.md:250,680,688`, tracked since Phase 0A). **Zero new failures; zero regressions.** |

## 5–8. Drafted Artifacts (PENDING SC-1 approval — not created as files)

### 5. `*_user_identity_links.sql` (proposed content)

```sql
-- ==========================================================
-- CAPFLUX — WorkOS AuthKit Migration — Phase 1 (identity bridge)
-- Purpose: additive mapping table between immutable WorkOS identities
--          and the CANONICAL CAPFLUX UUID identity (public.users.id).
-- Invariants:
--   * One row per (workos_user_id, identity_type)  -- no duplicate external maps
--   * One row per (capflux_user_id, identity_type) -- no duplicate internal maps
--   * WorkOS IDs are TEXT; CAPFLUX IDs remain UUID (never mixed)
--   * Only status='ACTIVE' may ever resolve (enforced again in the shim)
--   * Deny-by-default RLS: no policies => anon/authenticated see nothing
--   * No financial table touched; no existing row modified
-- Rollback: see WORKOS_AUTHKIT_PHASE_1_REPORT.md §14 (drop-only).
-- ==========================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.user_identity_links (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    capflux_user_id  uuid NOT NULL
                     REFERENCES public.users(id) ON DELETE CASCADE,
    workos_user_id   text NOT NULL
                     CHECK (workos_user_id ~ '^user_[0-9A-Za-z]{10,}$'),
    identity_type    text NOT NULL DEFAULT 'workos_authkit'
                     CHECK (identity_type IN ('workos_authkit')),
    status           text NOT NULL DEFAULT 'PENDING'
                     CHECK (status IN ('PENDING','ACTIVE','SUSPENDED','REVOKED','REVIEW')),
    migration_source text NOT NULL DEFAULT 'PREIMPORT'
                     CHECK (migration_source IN ('PREIMPORT','JIT_VERIFIED_EMAIL','MANUAL','WEBHOOK')),
    verified_at      timestamptz,
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT uq_uil_workos_per_type  UNIQUE (workos_user_id,  identity_type),
    CONSTRAINT uq_uil_capflux_per_type UNIQUE (capflux_user_id, identity_type),
    CONSTRAINT uq_uil_ids_distinct     CHECK (capflux_user_id::text <> workos_user_id)
);

COMMENT ON TABLE  public.user_identity_links IS
  'WorkOS-to-CAPFLUX identity bridge. Fail-closed: only ACTIVE rows may resolve. Service-role managed; no client policies by design.';
COMMENT ON COLUMN public.user_identity_links.status IS
  'Lifecycle: PENDING (not yet proven) / ACTIVE (resolvable) / SUSPENDED / REVOKED / REVIEW (manual adjudication queue). Non-ACTIVE never authenticates.';
COMMENT ON CONSTRAINT uq_uil_workos_per_type  ON public.user_identity_links IS 'Invariant 2: one WorkOS identity maps to at most one CAPFLUX user per type.';
COMMENT ON CONSTRAINT uq_uil_capflux_per_type ON public.user_identity_links IS 'Invariant 1: one CAPFLUX user has at most one WorkOS identity per type.';

-- Deny-by-default: ENABLE RLS and deliberately create NO policies.
ALTER TABLE public.user_identity_links ENABLE ROW LEVEL SECURITY;

-- Defense-in-depth on top of RLS (Supabase default privileges grant wide):
REVOKE ALL ON public.user_identity_links FROM anon, authenticated;

-- Keep updated_at fresh using the existing project trigger function (021).
DROP TRIGGER IF EXISTS trg_uil_updated_at ON public.user_identity_links;
CREATE TRIGGER trg_uil_updated_at
    BEFORE UPDATE ON public.user_identity_links
    FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

COMMIT;
```

Notes: the two UNIQUE constraints double as the lookup indexes (leading
columns); no extra indexes needed. FK CASCADE guarantees no orphan link can
reference a deleted user (supports TEST 14 fail-closed).

### 6. `*_rls_identity_shim.sql` (proposed content)

```sql
-- ==========================================================
-- CAPFLUX — WorkOS AuthKit Migration — Phase 1 (RLS identity shim)
-- Purpose: resolve the JWT subject to the CANONICAL CAPFLUX uuid for use by
--          FUTURE RLS policies (Phase 8). Fail-closed by construction:
--          every unresolvable/malformed/unauthorized input returns NULL.
-- Security model:
--   * SECURITY DEFINER owned by postgres; reads ONLY public.user_identity_links
--   * SET search_path = '' : caller search_path cannot hijack resolution;
--     pg_catalog remains implicitly first; all relations schema-qualified
--   * STRICT select: unknown => NO_DATA_FOUND => NULL (deny);
--     multiple rows (constraint corruption) => TOO_MANY_ROWS raised loudly
--   * Malformed claims/subjects return NULL (expected attack surface);
--     infrastructure errors (missing relation) RAISE (loud deny, surfaces corruption)
-- ==========================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.requesting_user_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_claims jsonb;
    v_sub    text;
    v_linked uuid;
BEGIN
    -- 1) Read JWT claims GUC (unset/empty => anonymous => NULL).
    BEGIN
        IF current_setting('request.jwt.claims', true) IS NULL THEN
            RETURN NULL;
        END IF;
        v_claims := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
    EXCEPTION WHEN OTHERS THEN
        RETURN NULL;                       -- malformed claims JSON => deny
    END;

    IF v_claims IS NULL OR jsonb_typeof(v_claims) <> 'object' THEN
        RETURN NULL;
    END IF;

    v_sub := btrim(coalesce(v_claims ->> 'sub', ''));
    IF v_sub = '' THEN RETURN NULL; END IF; -- missing/empty subject => deny

    -- 2) WorkOS subjects: prefixed strings ('user_...'), resolve via bridge.
    IF left(v_sub, 5) = 'user_' THEN
        IF v_sub !~ '^user_[0-9A-Za-z]{10,}$' THEN
            RETURN NULL;                   -- malformed WorkOS id => deny
        END IF;

        BEGIN
            SELECT l.capflux_user_id INTO v_linked
              FROM public.user_identity_links l
             WHERE l.workos_user_id  = v_sub
               AND l.identity_type   = 'workos_authkit'
               AND l.status          = 'ACTIVE';   -- PENDING/REVOKED/etc => no row
        EXCEPTION
            WHEN no_data_found  THEN RETURN NULL;  -- unknown / non-ACTIVE => deny
            WHEN too_many_rows  THEN
                RAISE;   -- constraint corruption: loud deny, never pick "first"
        END;
        RETURN v_linked;                   -- FK guarantees the user exists
    END IF;

    -- 3) Native Supabase subjects: must be a valid UUID (dual-auth window).
    BEGIN
        RETURN v_sub::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
        RETURN NULL;                       -- invalid UUID claim => deny
    END;
END;
$$;

COMMENT ON FUNCTION public.requesting_user_id() IS
  'Fail-closed JWT-subject -> canonical CAPFLUX uuid resolver. NULL means DENY. Never infers from email; never creates links; never mutates data.';

-- Narrow privilege boundary: only roles that evaluate RLS need EXECUTE.
REVOKE ALL ON FUNCTION public.requesting_user_id() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.requesting_user_id() TO authenticated, service_role;

COMMIT;
```

### 7. Probes (proposed `supabase/probes/phase1_identity_bridge_probes.sql`)
Transaction-wrapped harness: each test runs inside its own SAVEPOINT, uses
`set_config('request.jwt.claims', …, true)` to simulate tokens, creates an
EPHEMERAL fixture user (fixed test uuid) inside the transaction, asserts via
`RAISE EXCEPTION` on mismatch (script fails loudly), and finally ROLLBACKs —
leaving zero persistent state and zero real-user modifications.

| Test | Setup | Expected |
|---|---|---|
| 1 | no claims GUC | NULL |
| 2 | sub=`user_01UNKNOWN0000000000000000` | NULL |
| 3 | fixture user + ACTIVE link | fixture uuid |
| 4 | same link set PENDING | NULL |
| 5 | same link REVOKED | NULL |
| 6 | sub=`user_ has space!` / `user_` | NULL |
| 7 | sub=`not-a-uuid` | NULL |
| 8 | sub=fixture uuid (native) | same uuid |
| 9 | second ACTIVE link, same capflux id | unique violation rejected |
| 10 | second link, same workos id | unique violation rejected |
| 11 | `SET ROLE authenticated; SELECT … links` | permission denied |
| 12 | `SET ROLE authenticated; INSERT/UPDATE links` | permission denied |
| 13 | lookup other user's workos id w/o link | NULL (no cross-user path) |
| 14 | corrupt-state simulation: STRICT multi-row forced via temp override table in txn | raises TOO_MANY_ROWS (loud deny) |
| 15 | sweep `pg_policies`: zero policies reference `requesting_user_id()` yet & count of `auth.uid()` policies unchanged vs pre-migration baseline | pass ⇒ native behavior untouched |

TEST 15's baseline count is captured immediately before applying migration 002
and re-checked after (documented command included in the probe header).

### Financial-safety snapshot queries (run before & after application)
Catalog-only diff for `payment_transactions`, `payment_accounts`,
`ledger_entries`, `settlement_records`, `audit_logs`, `users`,
`school_members`, `roles`: columns/constraints/indexes/triggers hashes via
`pg_catalog` (query text included in probe appendix). Any delta ⇒ STOP.
Application code paths (payments/webhooks/settlements/ledger services) show
zero diffs in §17 — verified by git.

## 9–13. Results obtained so far

- Native identity regression: application suites green (216/216) including
  schoolIsolation / financial-authz / requireAuthSupabase negatives ⇒ existing
  UUID-based authorization unchanged (no DB objects were altered).
- Financial integrity: no financial file touched (git evidence §17); live
  catalog introspection shows expected shapes; post-application catalog diff
  pending SC-1/SC-2.
- Compliance: pre-existing FAIL distinguished (COMP-001); no new findings.
- Migration history: collision documented (SC-1); no files written.

## 14. Rollback procedure (verified design; executes only objects this phase owns)

```sql
BEGIN;
DROP FUNCTION IF EXISTS public.requesting_user_id();
DROP TRIGGER IF EXISTS trg_uil_updated_at ON public.user_identity_links;
DROP TABLE  IF EXISTS public.user_identity_links;
COMMIT;
```

Safe because: no dependent policies exist until Phase 8; the function is
referenced by nothing else; the table holds no production rows during Phase 1
(no backfill authorized). Rollback touches ZERO existing CAPFLUX objects.
Reverse-order verification: run rollback in staging copy → confirm
`to_regclass('public.user_identity_links') IS NULL` and
`to_regprocedure('public.requesting_user_id()') IS NULL` → re-apply → probes
green.

## 15. Known limitations
- Function returns NULL for valid-but-unlinked WorkOS sessions by design
  (authorization comes later phases).
- Native-UUID passthrough is intentional for the dual-auth window; retirement
  of that branch is a Phase 12 concern.
- Probe harness assumes Supabase default roles (`anon`,`authenticated`,
  `service_role`) exist.

## 16. Phase 2 prerequisites
SC-1 resolution (numbering approval), SC-2 execution-path designation, then:
apply → probes 15/15 → catalog diff clean → compliance re-run unchanged →
Phase 2 (WorkOS staging configuration) may start.

## 17. Exact change summary (git evidence)
- Created: `supabase/migrations/202608230002_user_identity_links.sql`
- Created: `supabase/migrations/202608230003_rls_identity_shim.sql`
- Created: `docs/security/WORKOS_AUTHKIT_PHASE_1_EXECUTION_PACKAGE.md` (owner runbook)
- Updated: this report (SC resolutions, checksums, status machine)
- Modified: NOTHING in `frontend/`, `backend/`; NO existing migration touched.
- Intentionally untouched unrelated concurrent work:
  `frontend/src/features/students/composables/useStudentManagement.ts`,
  `frontend/src/offline/localDb.ts`,
  `frontend/src/offline/studentsDownloadSync.ts` (new, untracked),
  `frontend/src/shared/enrollment/EnrollmentService.ts`,
  `frontend/src/shared/repositories/StudentRepository.ts`,
  `frontend/src/shared/services/SyncService.ts`,
  `frontend/src/shared/students/{StudentService,StudentValidator}.ts`,
  and committed `supabase/migrations/202608230001_guardian_relationships.sql`.

Explicit statements required by the tasking:
- **Phase 1 does not authenticate WorkOS users yet.**
- **Phase 1 does not migrate existing users yet.**
- **Phase 1 does not modify financial data.**

## 18. Secrets hygiene
Only variable NAMES were read (SUPABASE_URL, SUPABASE_SECRET_KEY used for
read-only introspection via the project's own configured client semantics);
no secret values printed, logged, or committed.
