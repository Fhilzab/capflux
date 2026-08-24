# CAPFLUX WorkOS AuthKit — Implementation Gate

> Machine-readable decision state. Updated at Phase 0C (2026-08-23).
> Statuses: CLOSED / OWNER ACTION REQUIRED / BLOCKED.
> `Owner` column records WHOSE authority closed the item. Evidence points into
> `WORKOS_AUTHKIT_PHASE_0C_CLOSURE_REPORT.md` (CR) and
> `WORKOS_AUTHKIT_OWNER_DECISIONS.md` (OD).

## Decision matrix

| ID | Decision | Status | Decision (one line) | Owner | Date | Verification method | Remaining conditions |
|----|----------|--------|---------------------|-------|------|---------------------|----------------------|
| D1 | Password migration | **CLOSED** | Official bcrypt port (`auth.users.encrypted_password` → `passwordHashType:'bcrypt'`), 9-step credential-handling procedure binding | Project owner (Phase 0C directive) + Principal Architect | 2026-08-23 | CR §3; official doc workos.com/docs/migrate/supabase (V7) | Two-person rule on production run; sample sign-ins before cutover |
| D2 | Architecture ratification | **CLOSED** | AuthKit → Supabase third-party auth → `user_identity_links` → existing UUID → shim RLS; UUID/FK/financial tables untouched; `user_*` never enters UUID columns | Project owner (ratified chain) | 2026-08-23 | CR §4 (C1–C4 obligations); V1/V3/V8 checks | C1–C4 proof artifacts due in Phases 3/8; C3/C4 continuous |
| D3 | Privileged JIT linking | **CLOSED** | JIT PROHIBITED for OWNER/ADMIN/BURSAR/SUPER_ADMIN/staff/financial-permission holders; pre-link mandatory; unresolvable ⇒ safe failure, never account creation | Project owner (directive states prohibited set) | 2026-08-23 | CR §5 policy vs AuthorizationService/staffAuth/RLS/roles verified | Privilege computation implemented exactly as specified in Phase 5 |
| D4 | OAuth providers | **CLOSED** | Email+Password + Google only; Microsoft/Apple/GitHub prohibited absent re-approval; OAuth binds to existing WorkOS user, never duplicates CAPFLUX identity | Project owner (approved/prohibited lists) | 2026-08-23 | OD §7; WorkOS AuthKit provider settings | Re-approval required to add any provider |
| D5 | Dual-auth window | **CLOSED** | 45-day DUAL_AUTH; LEGACY_FALLBACK ≤14d (hard stop T0+59d); T0-relative milestones; 10 objective exit criteria incl. webhook/session drills | Project owner (fixed durations) | 2026-08-23 | CR §6 schedule + criteria | Absolute dates recorded by release captain at Phase 11 kickoff |
| D6 | Custom auth domain | **CLOSED** | Default WorkOS AuthKit-hosted authentication URL for initial deployment; custom CAPFLUX domain intentionally DEFERRED (not an implementation blocker); issuer/domain MUST remain environment-config-driven (`AUTH_ISSUER`/`AUTH_REDIRECT_URI`/`WORKOS_CLIENT_ID`/`WORKOS_API_KEY`/`WORKOS_ENVIRONMENT` concerns) so the future default→custom transition changes NO user records, links, roles, memberships, permissions, financial data, RLS, payments, settlements, ledger, or audit history | Project owner (Phase 0D directive) | 2026-08-23 | Owner decision text recorded verbatim; abstraction rule added to checklist + plan; no WorkOS hostname may be hard-coded in source (review grep-gate) | Future custom-domain introduction follows the same ordering rules when the domain exists; $99/mo enters budget only at that time |
| D7 | Duplicate-email adjudication | **CLOSED** | DETECT→AUTO_LINK / REQUIRE_VERIFICATION / MANUAL_REVIEW / DENY_LINK / CREATE_NEW_IDENTITY; Security-Lead adjudication, dual-control for privileged, ESCALATED_OWNER state | Project owner (mandated model) | 2026-08-23 | CR §7 authority model; OD §10 case table | G-OPS-1: named individuals on ops roster before Phase 5 executes |
| D8 | Legacy retirement lifecycle | **CLOSED** | FREEZE→DUAL AUTH→CUTOVER→ARCHIVE→RETIRE; applied migrations immutable; deletion requires backup+evidence+rollback+retention/legal review+owner approval | Project owner (lifecycle approved) | 2026-08-23 | OD §11 inventory/classification | Phase-12 deletion still separately approved |
| D9 | MFA strategy | **CLOSED (requirements)** | Stages: optional → SUPER_ADMIN+staff → OWNER → ADMIN+BURSAR; TOTP > SMS; enrollment/recovery/device-loss/break-glass dual-control defined; implementation deferred per directive | Project owner (stages approved) | 2026-08-23 | OD §12 | Enforcement dates set per stage triggers |
| D10 | Budget | **CLOSED** | Official pricing verified: AuthKit first 1M MAU free ($2,500/mo per additional 1M); custom domain $99/mo optional; staging free; SSO/DirSync/AuditLogs/Radar not required ⇒ $0/mo baseline through ≥1,000 schools | Principal Architect under owner's verify-and-close rule | 2026-08-23 | CR §8 vs workos.com/pricing (fetched 2026-08-23) | If D6 custom domain chosen, $99/mo enters budget |

## Architecture conditions C1–C4

| Cond | Statement | Status | Evidence / verification method | Proof artifact gate |
|---|---|---|---|---|
| C1 | JWT template live + probe green BEFORE any RLS policy swap | **CLOSED** (ratified acceptance criterion) | Method defined & binding: real-token Data-API probe asserts Postgres role `authenticated` | Artifact produced in Phase 3; gates Phase 8 start |
| C2 | Per-role row-count parity before/after swap | **CLOSED** (ratified) | Parity report over seeded staging dataset | Artifact produced in Phase 8 |
| C3 | `requireAuthSupabase` mounted until Phase 12 | **CLOSED** (ratified) | Middleware mount test in every phase PR | Continuous check |
| C4 | Negative suites stay green | **CLOSED** (ratified) | CI: schoolIsolation / financial-authz / requireAuthSupabase suites each phase | Continuous check |

CLOSED here means the condition is ratified with a binding, objective
verification method; the listed artifacts remain mandatory pass/fail evidence
during their phases. A failed artifact re-blocks the affected phase.

Ratified invariant: WorkOS IDs are never written to UUID columns anywhere.

## Operational prerequisites (non-design)

| ID | Item | Blocks |
|---|---|---|
| G-OPS-1 | Named adjudicator(s) on ops roster (D7) | Phase 5 execution only |
| G-OPS-2 | Release captain records absolute window dates at kickoff (D5) | Phase 11 only |
| ~~G-OWNER-D6~~ | RESOLVED 2026-08-23 — default WorkOS AuthKit domain elected; custom domain deferred by owner decision | nothing |

## IMPLEMENTATION STATUS

All decisions D1–D10 CLOSED. All architecture conditions C1–C4 CLOSED as
ratified acceptance criteria with binding verification methods. No unresolved
YES-blocking security, identity, RLS, or account-preservation condition
remains. Operational prerequisites G-OPS-1/G-OPS-2 are scheduling items that
gate individual phase executions, not implementation readiness.

```
============================================================
IMPLEMENTATION STATUS
============================================================
IMPLEMENTATION READY

Decision basis : D6 CLOSED by owner directive 2026-08-23
                 (default WorkOS AuthKit-hosted domain;
                  custom domain intentionally deferred and
                  NOT an implementation blocker)
Standing rule  : Each phase still passes its own acceptance
                 gates; a failed C1–C4 artifact re-blocks the
                 affected phase. This status authorizes the
                 START of implementation, not the skipping of
                 verification.
============================================================
```
