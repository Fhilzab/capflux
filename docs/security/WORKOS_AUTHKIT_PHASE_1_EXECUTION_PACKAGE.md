# CAPFLUX WorkOS AuthKit — PHASE 1 EXECUTION PACKAGE (OWNER)

> **Execution path (sanctioned): Supabase Dashboard → SQL Editor.**
> Status at packaging time: **NOT APPLIED**. Nothing is executed until the
> owner pastes and runs the blocks below in order. Local validation already
> passed (typecheck/typecheck:tests/build/tests 216/216/compliance delta=0).
>
> Files of record (checksums):
> - `supabase/migrations/202608230002_user_identity_links.sql` — sha256 `1aa183667aa31b77e318dd26ed1a2a81626e328f74b9dff39b928cfd79e78f67`
> - `supabase/migrations/202608230003_rls_identity_shim.sql` — sha256 `c031ea30f6981cbfdb313af516bfeb50ecb7b851c33e241f3c25814b6c2864f2`
> Verify the editor contents match these files before running.

---

## STEP 0 — Pre-execution baselines (run once, SAVE OUTPUTS)

Run **before** Step 1 and keep results for comparison:

```sql
-- 0a. Baseline: count of RLS policy expressions using auth.uid() (for T15)
-- CORRECTED v2: parentheses added — the earlier draft let `OR with_check…`
-- escape the `AND schemaname` scope (precedence bug) and would have counted
-- matches across ALL schemas. Expected live value: 24.
SELECT count(*) AS auth_uid_policy_expressions
FROM pg_policies
WHERE schemaname = 'public'
  AND (   coalesce(qual,'')       ILIKE '%auth.uid()%'
       OR coalesce(with_check,'') ILIKE '%auth.uid()%');

-- 0b. Baseline catalog signature for protected objects (save output)
SELECT 'col' AS kind,
       c.relname AS obj,
       a.attnum AS ord,
       a.attname AS detail,
       format_type(a.atttypid, a.atttypmod) AS extra
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
WHERE n.nspname = 'public'
  AND c.relname IN ('payment_transactions','payment_accounts','ledger_entries',
                    'settlement_records','audit_logs','users','school_members','roles')
  AND c.relkind IN ('r','p')
UNION ALL
SELECT 'con', conrelid::regclass::text, 0, conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE connamespace = 'public'::regnamespace
  AND conrelid IN ('payment_transactions','payment_accounts','ledger_entries',
                   'settlement_records','audit_logs','users','school_members','roles')::regclass[]
ORDER BY obj, kind, ord, detail;

-- 0c. Baseline: all public functions (name + flags) (save output)
SELECT p.proname,
       pg_get_function_identity_arguments(p.oid) AS args,
       p.provolatile AS volatility,
       p.prosecdef AS security_definer
FROM pg_proc p
WHERE p.pronamespace = 'public'::regnamespace
ORDER BY p.proname;
```

## STEP 1 — Execute migration 202608230002

Paste the ENTIRE contents of
`supabase/migrations/202608230002_user_identity_links.sql` and Run.

**Expected:** statement completes with `COMMIT`; no errors. Creates table
`public.user_identity_links` (9 columns), 3 named constraints + 3 CHECK
constraints, RLS enabled with **zero** policies, revokes for
`anon`/`authenticated`, trigger `trg_uil_updated_at`.

## STEP 2 — Execute migration 202608230003

Paste the ENTIRE contents of
`supabase/migrations/202608230003_rls_identity_shim.sql` and Run.

**Expected:** `COMMIT`; creates `public.requesting_user_id()` (STABLE,
SECURITY DEFINER, `search_path=''`); EXECUTE granted only to
`authenticated` + `service_role`; revoked from `PUBLIC`/`anon`.

## STEP 3 — Post-execution object verification

```sql
-- Objects exist with correct properties
SELECT c.relrowsecurity AS rls_enabled
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname='user_identity_links';      -- expect t

SELECT proname, prosecdef AS security_definer, provolatile
FROM pg_proc WHERE pronamespace='public'::regnamespace
  AND proname='requesting_user_id';                                 -- expect t, STABLE

-- No policies exist on the bridge (deny-by-default)
SELECT count(*) FROM pg_policies
WHERE schemaname='public' AND tablename='user_identity_links';     -- expect 0

-- Function source has locked search_path
SELECT proconfig FROM pg_proc
WHERE pronamespace='public'::regnamespace AND proname='requesting_user_id';
                                                                   -- expect {search_path=""}
```

## STEP 4 — The 15 approved probes — CORRECTED HARNESS v2

> **Correction v3 (current):** makes T14 fully deterministic and self-contained (dedicated subject, in-transaction claim lifecycle, two-precondition gates). Correction v2 rationale: the original draft used top-level PL/pgSQL
> `PERFORM` statements, which PostgreSQL rejects outside DO/function blocks,
> and T14 would have silently passed because the probe row was left REVOKED by
> T5 (only one ACTIVE row existed at ambiguity time). v2 wraps every assertion
> in legal `DO` blocks, restores ACTIVE state inside T14 before forcing
> duplicate rows, fixes the T15/Step-0a precedence bug, adds a fail-closed
> preflight, and hard-asserts the 24-expression `auth.uid()` baseline.
>
> **How to run:** paste the ENTIRE block below into Supabase SQL Editor in ONE
> session and click Run once. The harness is transaction-wrapped: fixtures,
> the intentional constraint drop, and every mutation are undone by the final
> ROLLBACK. Zero persistent changes; never touches real users. Any failure
> raises `FAIL: …` naming the test. Do not split across tabs (pg_temp helpers
> are session-scoped).

```sql
-- ============================================================
-- PHASE 1 IDENTITY PROBES — corrected harness v2 (15 tests)
-- ============================================================

-- ---------- PREFLIGHT (read-only; fails closed BEFORE any mutation) ----------
DO $preflight$
DECLARE
  v_cols text;
BEGIN
  IF to_regclass('public.user_identity_links') IS NULL THEN
    RAISE EXCEPTION 'PREFLIGHT FAIL: public.user_identity_links missing';
  END IF;
  IF to_regprocedure('public.requesting_user_id()') IS NULL THEN
    RAISE EXCEPTION 'PREFLIGHT FAIL: public.requesting_user_id() missing';
  END IF;
  IF NOT (SELECT c.relrowsecurity FROM pg_class c
           WHERE c.oid = 'public.user_identity_links'::regclass) THEN
    RAISE EXCEPTION 'PREFLIGHT FAIL: RLS not enabled on bridge table';
  END IF;
  IF (SELECT count(*) FROM pg_policies
       WHERE schemaname='public' AND tablename='user_identity_links') <> 0 THEN
    RAISE EXCEPTION 'PREFLIGHT FAIL: unexpected policies on bridge table';
  END IF;
  SELECT coalesce(string_agg(a.attname || ':' || format_type(a.atttypid,a.atttypmod),
                             ',' ORDER BY a.attnum), '')
    INTO v_cols
  FROM pg_attribute a
  WHERE a.attrelid = 'public.users'::regclass AND a.attnum > 0 AND NOT a.attisdropped;
  IF position('id:uuid' in v_cols) = 0 THEN
    RAISE EXCEPTION 'PREFLIGHT FAIL: public.users.id is not uuid; fixture insert unsafe (cols=%)', v_cols;
  END IF;
  IF NOT has_function_privilege('authenticated','public.requesting_user_id()','EXECUTE') THEN
    RAISE EXCEPTION 'PREFLIGHT FAIL: authenticated lacks EXECUTE on shim';
  END IF;
  IF has_function_privilege('anon','public.requesting_user_id()','EXECUTE') THEN
    RAISE EXCEPTION 'PREFLIGHT FAIL: anon holds EXECUTE on shim';
  END IF;
  RAISE NOTICE 'PREFLIGHT OK: Phase 1 objects verified; fixture inserts are safe';
END
$preflight$;

BEGIN;

-- ---------- helpers (session-scoped, transaction-safe) ----------
CREATE OR REPLACE FUNCTION pg_temp.set_claims(t text) RETURNS void
LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', t, true);
$$;

CREATE OR REPLACE FUNCTION pg_temp.expect_uuid(label text, actual uuid, expected uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF actual IS NOT DISTINCT FROM expected THEN
    RAISE NOTICE 'PASS: %', label;
  ELSE
    RAISE EXCEPTION 'FAIL: % (actual=%, expected=%)', label, actual, expected;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION pg_temp.expect_null(label text, actual uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF actual IS NULL THEN
    RAISE NOTICE 'PASS: %', label;
  ELSE
    RAISE EXCEPTION 'FAIL: % (actual=%, expected NULL)', label, actual;
  END IF;
END $$;

-- ---------- fixtures (ephemeral; rolled back) ----------
INSERT INTO public.users (id, email, auth_provider, email_verified) VALUES
 ('00000000-0000-4000-8000-000000000001','phase1-probe-user1@example.invalid','probe',false),
 ('00000000-0000-4000-8000-000000000002','phase1-probe-user2@example.invalid','probe',false);

INSERT INTO public.user_identity_links
  (capflux_user_id, workos_user_id, identity_type, status, migration_source)
VALUES
 ('00000000-0000-4000-8000-000000000001',
  'user_01PROBEACTIVE0000000000','workos_authkit','ACTIVE','PREIMPORT');


-- T14 dedicated ephemeral users (rolled back by final ROLLBACK)
INSERT INTO public.users (id, email, auth_provider, email_verified) VALUES
 ('00000000-0000-4000-8000-000000000011','phase1-t14-user11@example.invalid','probe',false),
 ('00000000-0000-4000-8000-000000000012','phase1-t14-user12@example.invalid','probe',false);
-- ---------- TESTS ----------

-- TEST 1: no JWT claims -> NULL
DO $$
BEGIN
  PERFORM pg_temp.set_claims('');
  PERFORM pg_temp.expect_null('T1 no claims -> NULL', public.requesting_user_id());
END $$;

-- TEST 2: unknown WorkOS subject -> NULL
DO $$
BEGIN
  PERFORM pg_temp.set_claims('{"sub":"user_01UNKNOWN00000000000000"}');
  PERFORM pg_temp.expect_null('T2 unknown workos -> NULL', public.requesting_user_id());
END $$;

-- TEST 3: known WorkOS subject + ACTIVE link -> fixture CAPFLUX uuid
DO $$
BEGIN
  PERFORM pg_temp.set_claims('{"sub":"user_01PROBEACTIVE0000000000"}');
  PERFORM pg_temp.expect_uuid('T3 ACTIVE link resolves',
    public.requesting_user_id(), '00000000-0000-4000-8000-000000000001');
END $$;

-- TEST 4: PENDING -> NULL
UPDATE public.user_identity_links SET status='PENDING'
WHERE workos_user_id='user_01PROBEACTIVE0000000000';

DO $$
BEGIN
  PERFORM pg_temp.set_claims('{"sub":"user_01PROBEACTIVE0000000000"}');
  PERFORM pg_temp.expect_null('T4 PENDING -> NULL', public.requesting_user_id());
END $$;

-- TEST 5: REVOKED -> NULL
UPDATE public.user_identity_links SET status='REVOKED'
WHERE workos_user_id='user_01PROBEACTIVE0000000000';

DO $$
BEGIN
  PERFORM pg_temp.set_claims('{"sub":"user_01PROBEACTIVE0000000000"}');
  PERFORM pg_temp.expect_null('T5 REVOKED -> NULL', public.requesting_user_id());
END $$;

-- TEST 6: malformed WorkOS subjects -> NULL
DO $$
BEGIN
  PERFORM pg_temp.set_claims('{"sub":"user_"}');
  PERFORM pg_temp.expect_null('T6a bare prefix -> NULL', public.requesting_user_id());
END $$;

DO $$
BEGIN
  PERFORM pg_temp.set_claims('{"sub":"user_bad char!"}');
  PERFORM pg_temp.expect_null('T6b illegal chars -> NULL', public.requesting_user_id());
END $$;

-- TEST 7: malformed/invalid UUID subject -> NULL (no unsafe coercion)
DO $$
BEGIN
  PERFORM pg_temp.set_claims('{"sub":"not-a-uuid"}');
  PERFORM pg_temp.expect_null('T7a invalid uuid text -> NULL', public.requesting_user_id());
END $$;

DO $$
BEGIN
  PERFORM pg_temp.set_claims('{"sub":"12345"}');
  PERFORM pg_temp.expect_null('T7b numeric text -> NULL', public.requesting_user_id());
END $$;

-- TEST 8: native Supabase UUID subject passes through unchanged
DO $$
BEGIN
  PERFORM pg_temp.set_claims('{"sub":"00000000-0000-4000-8000-000000000001"}');
  PERFORM pg_temp.expect_uuid('T8 native uuid passthrough',
    public.requesting_user_id(), '00000000-0000-4000-8000-000000000001');
END $$;

-- TEST 9: duplicate CAPFLUX-side mapping rejected
DO $$
BEGIN
  INSERT INTO public.user_identity_links (capflux_user_id, workos_user_id, status)
  VALUES ('00000000-0000-4000-8000-000000000001',
          'user_01SECONDWORKOS000000000','ACTIVE');
  RAISE EXCEPTION 'FAIL: T9 duplicate capflux link accepted';
EXCEPTION WHEN unique_violation THEN
  RAISE NOTICE 'PASS: T9 duplicate capflux link rejected (unique_violation)';
END $$;

-- TEST 10: duplicate WorkOS-side mapping rejected
DO $$
BEGIN
  INSERT INTO public.user_identity_links (capflux_user_id, workos_user_id, status)
  VALUES ('00000000-0000-4000-8000-000000000002',
          'user_01PROBEACTIVE0000000000','ACTIVE');
  RAISE EXCEPTION 'FAIL: T10 duplicate workos link accepted';
EXCEPTION WHEN unique_violation THEN
  RAISE NOTICE 'PASS: T10 duplicate workos link rejected (unique_violation)';
END $$;

-- TEST 11: normal application role CANNOT read the bridge (deny-by-default)
DO $outer$
BEGIN
  SET LOCAL ROLE authenticated;
  BEGIN
    PERFORM 1 FROM public.user_identity_links LIMIT 1;
    RAISE EXCEPTION 'FAIL: T11 authenticated read not denied';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: T11 authenticated SELECT denied (42501)';
  END;
  RESET ROLE;
END
$outer$;

-- TEST 12: normal application role CANNOT create links
DO $outer$
BEGIN
  SET LOCAL ROLE authenticated;
  BEGIN
    INSERT INTO public.user_identity_links (capflux_user_id, workos_user_id, status)
    VALUES ('00000000-0000-4000-8000-000000000002',
            'user_01ROGUELINK0000000000000','ACTIVE');
    RAISE EXCEPTION 'FAIL: T12 authenticated insert not denied';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: T12 authenticated INSERT denied (42501)';
  END;
  RESET ROLE;
END
$outer$;

-- TEST 13: normal application role CANNOT modify links
DO $outer$
BEGIN
  SET LOCAL ROLE authenticated;
  BEGIN
    UPDATE public.user_identity_links SET status='ACTIVE'
    WHERE workos_user_id='user_01PROBEACTIVE0000000000';
    RAISE EXCEPTION 'FAIL: T13 authenticated update not denied';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: T13 authenticated UPDATE denied (42501)';
  END;
  RESET ROLE;
END
$outer$;



-- TEST 14: ambiguous/corrupt mapping fails CLOSED and LOUD.
-- CORRECTED v4: fully isolated. Dedicated T14 CAPFLUX users ...0011/...0012
-- and dedicated WorkOS subject user_01T14ISOLATED0000000000.
-- No coupling to shared ...0001/...0002 fixture rows.
-- Transaction-local GUC (set_config ..., true) consumed in-context.

-- Stale-row cleanup: remove any residual mappings for the dedicated subject
DELETE FROM public.user_identity_links
WHERE workos_user_id = 'user_01T14ISOLATED0000000000';

-- Corruption simulation: drop the WorkOS uniqueness constraint (rolled back at end)
ALTER TABLE public.user_identity_links
  DROP CONSTRAINT uq_uil_workos_per_type;          -- simulate corruption (rolled back)

-- Insert exactly two ACTIVE mappings for the dedicated T14 subject.
-- Each capflux_user_id is unique, satisfying uq_uil_capflux_per_type.
INSERT INTO public.user_identity_links
  (capflux_user_id, workos_user_id, identity_type, status)
VALUES
 ('00000000-0000-4000-8000-000000000011',
  'user_01T14ISOLATED0000000000','workos_authkit','ACTIVE'),
 ('00000000-0000-4000-8000-000000000012',
  'user_01T14ISOLATED0000000000','workos_authkit','ACTIVE');   -- deliberate duplicates for same subject

-- JWT setup (transaction-local; consumed in same context as function invocation)
-- Wrapped in DO/PERFORM so no result grid is emitted; harness output is notices-only.
DO $$
BEGIN
  PERFORM set_config(
    'request.jwt.claims',
    '{"sub":"user_01T14ISOLATED0000000000"}',
    true
  );
END $$;

-- Setup verification: claim + precondition in one DO block.
DO $$
DECLARE
  v_sub text;
  v_count integer;
BEGIN
  v_sub := coalesce(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub';
  IF v_sub IS DISTINCT FROM 'user_01T14ISOLATED0000000000' THEN
    RAISE EXCEPTION 'FAIL: T14 JWT subject mismatch: %', coalesce(v_sub, '<NULL>');
  END IF;

  -- Verify exactly two ACTIVE mappings exist for this dedicated subject
  SELECT count(*) INTO v_count
  FROM public.user_identity_links
  WHERE workos_user_id  = 'user_01T14ISOLATED0000000000'
    AND identity_type   = 'workos_authkit'
    AND status          = 'ACTIVE';

  IF v_count <> 2 THEN
    RAISE EXCEPTION 'FAIL: T14 expected exactly 2 ACTIVE mappings for dedicated subject, got %', v_count;
  END IF;

  RAISE NOTICE 'PASS: T14 setup verified (subject=%; ACTIVE mappings=%)', v_sub, v_count;
END $$;

-- DEBUG EVIDENCE + function-semantics test.
-- Captures context immediately before invoking public.requesting_user_id(),
-- then tests the ambiguity semantics: TOO_MANY_ROWS -> PASS, NULL -> FAIL, UUID -> FAIL, other -> FAIL with SQLSTATE.
DO $$
DECLARE
  v_current_user text;
  v_session_user text;
  v_claims text;
  v_sub text;
  v_row_count integer;
  v_result uuid;
  v_fn_owner text;
  v_fn_security_definer boolean;
  v_fn_unit text;
  v_outcome text;
  v_sqlstate text;
  v_sqlerrm text;
BEGIN
  v_current_user := current_user;
  v_session_user := session_user;
  v_claims := current_setting('request.jwt.claims', true);
  v_sub := coalesce(v_claims, '')::jsonb ->> 'sub';

  SELECT count(*) INTO v_row_count
  FROM public.user_identity_links
  WHERE workos_user_id  = 'user_01T14ISOLATED0000000000'
    AND identity_type   = 'workos_authkit'
    AND status          = 'ACTIVE';

  SELECT pg_get_userbyid(p.proowner), p.prosecdef, p.proconfig
  INTO v_fn_owner, v_fn_security_definer, v_fn_unit
  FROM pg_proc p
  WHERE p.oid = 'public.requesting_user_id()'::regprocedure;

  -- Invoke the function with outcome tracking, NOT caught by harness FAIL assertions
  BEGIN
    v_result := public.requesting_user_id();

    IF v_result IS NULL THEN
      v_outcome := 'NULL';
    ELSIF v_result IS NOT NULL THEN
      v_outcome := 'UUID';
    END IF;
  EXCEPTION
    WHEN too_many_rows THEN
      v_outcome := 'TOO_MANY_ROWS';
    WHEN others THEN
      v_outcome := 'OTHER_EXCEPTION';
      v_sqlstate := SQLSTATE;
      v_sqlerrm := SQLERRM;
  END;

  -- Determine result; harness FAIL assertions are NOT caught by the exception-catching block
  IF v_outcome = 'TOO_MANY_ROWS' THEN
    RAISE NOTICE 'PASS: T14 ambiguous mapping raises TOO_MANY_ROWS (loud deny)';
  ELSIF v_outcome = 'NULL' THEN
    RAISE EXCEPTION 'FAIL: T14 function returned NULL instead of raising TOO_MANY_ROWS.
current_user=%; session_user=%; JWT claims=%; sub=%; ACTIVE row count=%; function owner=%; SECURITY DEFINER=%; proconfig=%',
      v_current_user, v_session_user, v_claims, v_sub, v_row_count, v_fn_owner, v_fn_security_definer, v_fn_unit;
  ELSIF v_outcome = 'UUID' THEN
    RAISE EXCEPTION 'FAIL: T14 function returned UUID instead of raising TOO_MANY_ROWS.
current_user=%; session_user=%; JWT claims=%; sub=%; ACTIVE row count=%; function owner=%; SECURITY DEFINER=%; proconfig=%',
      v_current_user, v_session_user, v_claims, v_sub, v_row_count, v_fn_owner, v_fn_security_definer, v_fn_unit;
  ELSE
    RAISE EXCEPTION 'FAIL: T14 function raised unexpected exception: % (SQLSTATE %) .
current_user=%; session_user=%; JWT claims=%; sub=%; ACTIVE row count=%; function owner=%; SECURITY DEFINER=%; proconfig=%',
      v_sqlerrm, v_sqlstate, v_current_user, v_session_user, v_claims, v_sub, v_row_count, v_fn_owner, v_fn_security_definer, v_fn_unit;
  END IF;
END
$$;

-- Hygiene: clear the JWT claim after T14, since it is transaction-local
-- and must not persist into later test contexts.
DO $$
BEGIN
  PERFORM pg_temp.set_claims('');
END $$;

-- TEST 15: existing RLS untouched; shim referenced by NO policy yet;
--          auth.uid() policy expression count equals the Step 0a baseline (24)
DO $$
DECLARE n_shim int; n_uid int;
BEGIN
  SELECT count(*) INTO n_shim
  FROM pg_policies
  WHERE schemaname='public'
    AND (coalesce(qual,'') || coalesce(with_check,'')) ILIKE '%requesting_user_id%';
  IF n_shim <> 0 THEN
    RAISE EXCEPTION 'FAIL: T15 shim referenced by policies before Phase 8 (%)', n_shim;
  END IF;

  SELECT count(*) INTO n_uid
  FROM pg_policies
  WHERE schemaname='public'
    AND (   coalesce(qual,'')       ILIKE '%auth.uid()%'
         OR coalesce(with_check,'') ILIKE '%auth.uid()%');

  IF n_uid <> 24 THEN
    RAISE EXCEPTION 'FAIL: T15 auth.uid() policy expression count=% expected 24 — if legitimate drift occurred, re-run Step 0a and re-baseline BEFORE proceeding', n_uid;
  END IF;
  RAISE NOTICE 'PASS: T15 sweep clean (shim policy refs=0; auth.uid() expressions=24 == baseline)';
END $$;

-- Privilege-matrix assertions (defense-in-depth evidence)
DO $$
BEGIN
  IF has_table_privilege('authenticated','public.user_identity_links','SELECT')
     OR has_table_privilege('anon','public.user_identity_links','SELECT') THEN
    RAISE EXCEPTION 'FAIL: client-role grant leak on bridge table';
  END IF;
  IF NOT has_table_privilege('service_role','public.user_identity_links','SELECT') THEN
    RAISE EXCEPTION 'FAIL: service_role lost bridge access';
  END IF;
  IF NOT has_function_privilege('authenticated','public.requesting_user_id()','EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: authenticated missing EXECUTE (needed for future RLS)';
  END IF;
  IF has_function_privilege('anon','public.requesting_user_id()','EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: anon holds EXECUTE on shim';
  END IF;
  RAISE NOTICE 'PASS: privilege matrix verified (table: clients denied/service allowed; fn: authenticated+service only)';
END $$;

ROLLBACK;   -- ALWAYS roll back: fixtures, corruption simulation, everything
```

**Expected output:** one `PREFLIGHT OK`, fifteen `PASS:` notices (+ privilege-
matrix PASS), zero `FAIL`. Constraint dropped in T14 is restored by the final
ROLLBACK (verified by re-running Step 3 checks afterwards if desired).

## STEP 5 — Catalog-diff / financial invariance (post-execution)

Re-run **Step 0b** and **Step 0c**; diff against saved outputs.

**Acceptance:** the ONLY acceptable difference anywhere is the presence of
new objects `user_identity_links` and `requesting_user_id()` in fresh
queries; every line for `payment_transactions`, `payment_accounts`,
`ledger_entries`, `settlement_records`, `audit_logs`, `users`,
`school_members`, `roles` (columns/constraints/indexes) and every prior
function row must be byte-identical. Any other delta ⇒ STOP and report — do
not repair automatically.

## ROLLBACK (drop-only; requires owner approval unless emergency condition met)

```sql
BEGIN;
DROP FUNCTION IF EXISTS public.requesting_user_id();
DROP TRIGGER  IF EXISTS trg_uil_updated_at ON public.user_identity_links;
DROP TABLE    IF EXISTS public.user_identity_links;
COMMIT;
```

Touches ONLY objects created by this phase. Never rolls back
`202608230001_guardian_relationships.sql` or any unrelated migration.

---

**Report back to engineering:** outputs/notices of Steps 1–5 (or the exact
error text if anything fails). Engineering will then run the compliance
delta and close Phase 1 formally.

---

## CORRECTION LOG — Harness v2 (documentation-only repair)

| # | What was wrong | Fix |
|---|---|---|
| 1 | Top-level `PERFORM …` statements are illegal outside PL/pgSQL | Every test now runs inside its own `DO $…$ BEGIN … END $…$;` block |
| 2 | **Latent false-pass:** T14 tested ambiguity while the only probe row was REVOKED (left by T5) ⇒ STRICT select saw ≤1 ACTIVE row and could never raise `too_many_rows` | T14 now sets BOTH rows ACTIVE inside the test before inserting the deliberate duplicate |
| 3 | SQL precedence bug in Step 0a/T15: `AND schemaname=… OR with_check ILIKE…` let the OR escape schema scope | Parenthesized predicate; identical semantics in baseline and T15 |
| 4 | No guard against running probes against missing/misconfigured Phase 1 objects or an unsafe `users` shape | New read-only PREFLIGHT block fails closed before any mutation (objects exist, RLS on, zero policies, `users.id` is uuid, EXECUTE grant matrix) |
| 5 | Baseline comparison for `auth.uid()` expressions was advisory | T15 now hard-asserts the owner-recorded value of **24**, failing closed with a re-baseline instruction if drift is legitimate |
| 6 | **T14 nondeterminism (v3):** `set_config(..., true)` is transaction-local; sharing the T5-mutated probe row across test state could leave the claim/rows inconsistent between statement executions | T14 rebuilt self-contained: dedicated subject `user_01T14AMBIGUOUS0000000000`, stale-row DELETE, EXACTLY TWO ACTIVE inserts, in-transaction `set_config` + immediate claim verification + exact-two-row precondition gate, then invocation requiring `too_many_rows`; NULL/UUID results now FAIL explicitly |
| 7 | **T14 fixture isolation:** T14 inserted two ACTIVE mappings for fixture capflux_user_ids 0001/0002, but those rows already existed from the harness fixture insert with `identity_type='workos_authkit'`, violating `uq_uil_capflux_per_type`. Added a fixture-isolation `DELETE` before the deliberate inserts, removing any pre-existing ACTIVE mappings for those capflux_user_ids and identity_type so the corruption simulation does not breach the production uniqueness constraint |

**Unchanged:** all 15 approved tests and their security intent · transaction-wrapped rollback-only execution · `example.invalid` ephemeral fixtures · ambiguity/fail-closed test · privilege tests · final ROLLBACK · migrations 202608230002/003 and every applied database object remain untouched.

| 8 | **T14 fixture isolation (v4):** v3 still coupled T14 to the shared
shared ...0001/...0002 fixture UUIDs, requiring a fixture-isolation DELETE
before the deliberate inserts. v4 eliminates this coupling entirely by using
two dedicated ephemeral CAPFLUX users (...0011/...0012) with a dedicated
WorkOS subject (user_01T14ISOLATED0000000000). The test deletes only stale
rows for that subject, inserts two ACTIVE mappings that satisfy
uq_uil_capflux_per_type (unique capflux_user_ids), and captures full debug
evidence (current_user, session_user, JWT claims, sub, row count, function
owner/SECURITY DEFINER/search_path) on any failure mode. No T1-T13 fixture
rows are updated, deleted, or reused. | T14 rebuilt with dedicated ephemeral users ...0011/...0012,
dedicated subject user_01T14ISOLATED0000000000, no fixture coupling, full
debug evidence on failure, explicit TOO_MANY_ROWS/NULL/UUID/other outcome
distinction, and corrected function-semantics assertion loop.
| 10 | **v5 regression (caught at first runtime paste):** the v5 programmatic splice replaced text up to and including the DEBUG-EVIDENCE DO block's `END $$;` but its replacement ended at `END IF;`, deleting the terminator. The parser then treated the following hygiene `DO $$` as the closing quote and failed with `syntax error at or near "BEGIN"`. The T15 header comment had also been merged onto the hygiene line | v6 restores `END`/`$$;` for the DEBUG-EVIDENCE block, re-forms the T15 comment header as standalone lines per Defect 5 spec; static validation now proves every DO/AS-initiated dollar-quoted body terminates with `;` (24/24) before any further paste |
| 11 | **Latent RAISE arity defect (caught at second runtime paste):** T14 setup notice `RAISE NOTICE 'PASS: T14 setup verified (subject=%; ACTIVE mappings=2)'` contained a `%` placeholder with zero arguments ⇒ PL/pgSQL compile error `too few parameters specified for RAISE` near line 22 of that DO block. Static validation had never checked RAISE placeholder/argument arity | Parameterized the notice as `(subject=%; ACTIVE mappings=%)`, v_sub, v_count`; new static checker now walks ALL 37 RAISE statements in Step 4 counting placeholders vs comma-separated args (paren- and quote-aware) and fails on any mismatch |
| 12 | **Undeclared variables (caught at third runtime paste):** the v5 outcome-tracking splice replaced the DEBUG block's logic but not its DECLARE section, leaving `v_outcome`, `v_sqlstate`, `v_sqlerrm` assigned without declaration ⇒ compile error `"v_outcome" is not a known variable` | Added the three declarations to the block's DECLARE section; new static checker now extracts every PL/pgSQL body's declared symbol table and fails if any `v_*` identifier is used but undeclared (23 bodies verified) |
| 13 | **Cosmetic:** the T14 JWT-setup `SELECT set_config(...)` emitted a one-row result grid in the SQL Editor, which the owner could mistake for the harness verdict | Wrapped in `DO $$ PERFORM ... END $$;` — identical transaction/session semantics, zero result grids; Step 4 output is now notices-only. Owner guidance: verdicts live in the Messages/Notices panel, not the results grid |
| 9 | **T14 v5 harness defect fixes:** DEFECT 1: removed standalone stray hyphen between TEST 13 and TEST 14 to prevent parsing errors. DEFECT 2: replaced invalid `prosearchpath` column with `p.proconfig` via `pg_get_userbyid(p.proowner)` to correctly report function configuration. DEFECT 3: ensured `v_fn_owner` receives `pg_get_userbyid(p.proowner)` not bare `proname`. DEFECT 4: restructured exception-handling so the nested `BEGIN...EXCEPTION` block distinguishing `TOO_MANY_ROWS`/`NULL`/`UUID`/`other` is not conflated with the harness's own `RAISE EXCEPTION 'FAIL: ...'` assertions. DEFECT 5: fixed `END $$;;` to `END $$;` with proper comment boundary after T15. DEFECT 6-9: preserved T14 isolation with dedicated ...0011/...0012 users and `user_01T14ISOLATED0000000000` subject, `uq_uil_capflux_per_type` intact, only `uq_uil_workos_per_type` dropped, JWT same-transaction requirement, and full diagnostic evidence capture (current_user, session_user, claims, sub, row count, owner, SECURITY DEFINER, proconfig). | T14 v5 isolated with dedicated ...0011/...0012 and `user_01T14ISOLATED0000000000`, no stray hyphens, correct `pg_proc` metadata, nested exception distinction, clean `END $$;` boundary, and defects 1–9 documented |