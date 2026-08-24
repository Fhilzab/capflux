# CAPFLUX PHASE 1 — STEP 5 EVIDENCE-GAP REVIEW

> **Date:** 2026-08-24
> **Type:** Evidence-gap closure review (documentation only). No database,
> migration, policy, function, or harness changes performed.
> **Trigger:** Authoritative Step 0b/0c baseline outputs could not be located
> in the repository at closure time.

---

## Historical baseline status

Step 0b: **MISSING**
Step 0c: **MISSING**

Reason: outputs were instructed to be saved but were not persisted.

Historical Step 0b/0c baseline artifacts were not persisted and therefore
cannot be independently diffed. The absence of the historical Step 0b/0c
artifacts prevents a literal before/after diff.

---

## A. VERIFIED EVIDENCE

| # | Evidence | Mechanism |
|---|---|---|
| 1 | Migration sources byte-identical to recorded applied values (`202608230002` = `1aa18366…`, `202608230003` = `c031ea30…`) | sha256 re-computation vs recorded checksums |
| 2 | `requesting_user_id()` = SECURITY DEFINER true · STABLE · owner postgres · `search_path=""` | Step 3 catalog checks + probe preflight (live) |
| 3 | `user_identity_links`: RLS enabled · zero policies · authenticated SELECT denied · anon SELECT denied · service_role SELECT allowed | Preflight + T11–T13 + privilege-matrix assertions (live) |
| 4 | T1–T15 probes passed | Fail-closed harness completed with zero errors |
| 5 | T14 ambiguity: duplicate ACTIVE WorkOS mappings ⇒ TOO_MANY_ROWS (loud deny); NULL/UUID paths hard-fail | Live probe run |
| 6 | T15 live `auth.uid()` policy-expression count across `public` = 24 = owner-recorded baseline | In-session assertion during the same probe run |
| 7 | No production SQL/migration files modified during harness repairs | sha256 verification after every repair cycle |
| 8 | Harness documentation was the only file modified by repair work | git inspection |
| 9 | COMP-044 pre-existing, OPEN/P3, untouched | Backlog record |

## B. MISSING HISTORICAL EVIDENCE

- Step 0b column/constraint signature snapshot for the eight protected tables
  (`payment_transactions`, `payment_accounts`, `ledger_entries`,
  `settlement_records`, `audit_logs`, `users`, `school_members`, `roles`).
- Step 0c full public-function inventory snapshot.
- Consequence: byte-for-byte proof that these objects equal their
  pre-Phase-1 state cannot be produced retroactively.

## C. UNDETECTED DRIFT — NOT PROVEN

The following cannot be *proven* without the lost artifacts, and are stated
as residual risk rather than observed findings:

- A hypothetical modification to protected-table columns/constraints that
  predates or parallels Phase 1 activity.
- A hypothetical policy edit that alters predicate wording while preserving
  the number of `auth.uid()` expressions (T15's count is expression-count
  sensitive, not wording sensitive).

No such drift has been observed, and no plausible actor or write path for it
exists in the Phase 1 timeline (migrations additive + checksummed; harness
strictly `BEGIN … ROLLBACK`; no other sanctioned execution occurred).

## D. PRODUCTION IMPACT — NONE IDENTIFIED

Every directly observable property of production relevant to Phase 1 scope —
bridge isolation, shim configuration, privilege matrix, policy-expression
baseline, function semantics — verifies clean against its recorded target.

## E. COMP-044 — DEFERRED

P3 / OPEN / pre-existing Supabase advisor performance advisory on
`public.users` policy `Users can view own identity`. Predates Phase 1;
outside this closure gate; remains tracked in
`docs/compliance/COMPLIANCE_REMEDIATION_BACKLOG.md`.

---

## Security assessment

Against each failure class Step 5 was designed to detect:

- **Unintended policy modification:** covered indirectly but meaningfully —
  T15 counted auth.uid() policy expressions across all of schema `public`
  live and matched 24 exactly (evidence #6). An added or removed policy
  expression anywhere would have tripped the fail-closed assertion.
- **Unintended financial-table modification:** no write path existed —
  Phase 1 migrations are additive-only and touch none of the eight protected
  tables (checksummed, evidence #1); the entire probe harness executed inside
  a single transaction terminated by unconditional ROLLBACK (evidence #4);
  git confirms no other code changed (evidence #8).
- **Migration drift:** excluded by checksum equality (evidence #1, #7).
- **Function drift:** excluded by live property checks (#2) plus behavioral
  probes T1–T14 (#4, #5).
- **Privilege escalation:** excluded by live grant matrix (#3) — clients
  denied at table level, EXECUTE confined to authenticated + service_role.
- **RLS weakening:** excluded by zero-policies-on-bridge (#3) and the
  expression-count match (#6).
- **Identity-bridge exposure:** excluded — deny-by-default verified live,
  ambiguity fails closed (#5).

## Known limitation

The absence of the historical Step 0b/0c artifacts prevents a literal
before/after diff. This limitation is permanent for the pre-Phase-1 era and
is accepted in exchange for the compensating evidence above.

## Forward requirement (recorded with closure)

A **fresh** Step 0b/0c baseline MUST be captured immediately after closure
(read-only) and stored under version control, becoming the authoritative
reference for all future phases. This converts the lost-artifact incident
into a one-time loss instead of a recurring exposure.

---

## Closure recommendation

Closure is based on compensating evidence, not a historical Step 0b/0c
byte-for-byte diff.

The compensating evidence directly covers every security property within
Phase 1's authority to affect, and no evidence of drift exists in any
observable dimension. Residual risk (section C) is hypothetical, has no
identified actor or mechanism, and is bounded by the forward-baseline
requirement above.

# PHASE 1 — CLOSED ON COMPENSATING EVIDENCE

*Recommendation issued by engineering; subject to owner sign-off.*
