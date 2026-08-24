# CAPFLUX WorkOS AuthKit — Phase 0C Closure Report

> **Phase:** 0C (decision closure + implementation unlock verification)
> **Date:** 2026-08-23
> **Mode:** Documentation-only. Zero modifications to application code,
> migrations, schema, dashboards, environment variables, or secrets.
> **Inputs:** Phase 0A audit, Phase 0B decision package, owner directives in
> the Phase 0C tasking, live-code inspection, current official WorkOS and
> Supabase documentation.

---

## 1. Verification Log (what was checked, what was found)

| # | Check | Method | Result |
|---|---|---|---|
| V1 | `auth.users.id ≡ public.users.id` invariant | Prior audit (migrations 027/028 trace) re-read | CONFIRMED unchanged; no new migrations since `202608220001` |
| V2 | SDK currency for target design | `backend/package.json` | `@workos-inc/node ^10.9.0` present (legacy path proven against it); `@supabase/supabase-js ^2.110.0`; `express ^4.18.4` |
| V3 | Request identity type contract | `backend/types/http.ts:88-110` | `AuthUser` already unifies Supabase-row and WorkOS-normalized shapes (`id: string`) ⇒ dual-auth middleware requires NO breaking type change |
| V4 | Frontend authorization surface | filesystem | `frontend/src/shared/services/AuthorizationService*` DOES NOT EXIST (tasking listed it); frontend authorization = `shared/rbac/` (RouteGuard, RBAC providers). Backend authority = `services/AuthorizationService.ts`. Recorded as correction |
| V5 | Production domain evidence | repo-wide grep (configs/docs/scripts) | **NONE conclusive.** Only artifacts: test emails `@capflux.dev` in gitignored local tooling history (`.commandcode/settings.json`, local-only) and GitHub org `capflux-ssng`. Neither constitutes a registered production domain ⇒ D6 cannot be closed from evidence |
| V6 | Live WorkOS project existence | `.commandcode/settings.json` (local tooling history, gitignored) | A staging/dev WorkOS environment was previously exercised end-to-end (real user IDs, sealed-cookie smoke tests incl. cross-tenant negatives). Useful confidence signal; NOT production config; no secret values read or printed |
| V7 | D1 hash compatibility | Official WorkOS doc “Migrate from Supabase Auth” | CONFIRMED: export `auth.users.encrypted_password` (bcrypt) via SQL/pg_dump; import via Create User API / migrations CLI with `passwordHashType: 'bcrypt'` |
| V8 | D2 RLS mechanics | Supabase third-party docs + `auth.uid()` definition | CONFIRMED: WorkOS issuer registration + JWT template `role:"authenticated"`; `auth.uid()` breaks on non-UUID subs ⇒ shim mandatory (fail-closed) |
| V9 | D10 pricing | workos.com/pricing fetched 2026-08-23 | VERIFIED figures recorded §8 below |

## 2. Decision Dispositions (D1–D10)

| ID | Decision | Disposition | Owner authority used |
|---|---|---|---|
| D1 | Password migration via official bcrypt port | **CLOSED** (procedure §3) | Owner directive: “Use WorkOS's supported password migration mechanism” |
| D2 | Bridge architecture | **CLOSED** (ratified; conditions C1–C4 binding, §4) | Owner directive ratifies chain + invariants |
| D3 | Privileged JIT prohibition | **CLOSED** (policy §5) | Owner directive states prohibited set verbatim |
| D4 | Providers = Email+Password + Google only | **CLOSED** | Owner directive lists approved/prohibited sets |
| D5 | 45-day window, ≤14-day fallback | **CLOSED** (T0-relative schedule §6; absolute kickoff date set at Phase 0 execution by release captain) | Owner directive fixes durations |
| D6 | Custom auth domain | **CLOSED** (initially resolved OWNER ACTION REQUIRED; owner then elected default WorkOS AuthKit domain 2026-08-23 — see §10) | Owner directive recorded verbatim in §10 |
| D7 | Duplicate-email adjudication model | **CLOSED** (model + escalation §7; named adjudicator recorded on ops roster before Phase 5 executes — operational prerequisite, not a design gap) | Owner directive mandates the model |
| D8 | FREEZE→DUAL AUTH→CUTOVER→ARCHIVE→RETIRE | **CLOSED** (definitions §8 of decisions doc addendum) | Owner directive approves lifecycle |
| D9 | MFA staged TOTP-first strategy | **CLOSED** as approved requirements (implementation explicitly deferred per directive) | Owner directive approves stages |
| D10 | Budget | **CLOSED** with officially verified pricing (§8); optional items flagged | Owner directive: close if pricing conclusively verified from official source — done |

## 3. D1 — Credential-Handling Procedure (binding)

Principle: hashes move machine-to-machine over TLS, memory-resident only.

1. **Export:** streaming SQL cursor `SELECT id, email, encrypted_password,
   email_confirmed_at FROM auth.users` executed ON THE BACKEND HOST (or
   ephemeral CI job) using injected `SUPABASE_SECRET_KEY`. Batch size ≤500
   rows in memory. No files written to disk; no dumps to laptops.
2. **Transfer:** direct HTTPS POST per batch to `api.workos.com`
   (`POST /user_management/users` with `passwordHash`,
   `passwordHashType:'bcrypt'`) or official migrations CLI run in the same
   environment. TLS only; no intermediary storage.
3. **Temporary storage:** none beyond process memory. If a crash-recovery
   checkpoint is unavoidable, it stores ONLY (supabase_uuid → workos_user_id)
   pairs — never hash material.
4. **Access control:** script runs under a deploy role; secrets injected via
   platform env (Render environment group / CI secrets). Never CLI args,
   never logs. Two-person rule for production run initiation.
5. **Encryption:** in transit TLS 1.2+; at rest nothing exists to encrypt
   (memory-only design).
6. **Import:** idempotent create-or-adopt; email-exists conflicts route to
   REVIEW (never overwrite an existing WorkOS credential); returned
   `user_…` ids written to `user_identity_links`.
7. **Verification:** N≥20 random sample + ALL privileged accounts sign in
   with pre-migration passwords on staging before production cutover;
   format assertions (`$2a$|$2b$|$2y$` prefix) pre-send.
8. **Deletion:** process exit purges memory; no artifacts to delete by
   design; CI workspace ephemeral; confirm zero residual objects post-run.
9. **Audit evidence:** counts only (attempted/succeeded/reviewed/failed),
   run id, executor identity, start/end timestamps — persisted to
   migration log. Hash values NEVER logged anywhere.

Prohibitions restated: no plaintext ever exists (none is needed); hashes
never enter logs/git/object storage/developer machines/insecure channels.

## 4. D2 — Architecture Conditions C1–C4 (ratified proof obligations)

These are binding acceptance criteria whose proof artifacts are produced
during implementation phases; they gate specific steps, not the start:

| Cond | Statement | Proof artifact (when produced) | Gate |
|---|---|---|---|
| C1 | JWT template live & probe-verified BEFORE any RLS policy swap | Probe transcript: real WorkOS token through Data API shows Postgres role `authenticated` (Phase 3) | unlocks Phase 8 |
| C2 | Per-role row-count parity probes match before/after policy swap | Parity report generated from seeded staging dataset (Phase 8) | unlocks Phase 8 completion |
| C3 | `requireAuthSupabase` remains mounted until Phase 12 | Code review + middleware mount test in every phase PR | continuous |
| C4 | Negative suites stay green (spoof headers, forged tokens, cross-school) | CI run of `schoolIsolation`/`financial-authz`/`requireAuthSupabase` suites each phase | continuous |

Additional ratified invariants: `WorkOS user_…` strings are NEVER inserted
into any UUID column (type system + shim are the enforcement points);
`auth.users.id ≡ public.users.id` untouched; financial tables untouched.

## 5. D3 — Privileged JIT Policy (implementation requirements)

- Linking service MUST compute privilege BEFORE any auto-link:
  privileged := `system_role IN ('OWNER','ADMIN','BURSAR','SUPER_ADMIN')`
  OR active platform-staff membership OR ≥1 `role_permissions` grant whose
  permission code covers billing/payment/settlement/KYC-review/
  reconciliation namespaces.
- Privileged + unlinked ⇒ authentication resolves to NULL ⇒ safe failure
  (401 + generic message) + REVIEW row. **DO NOT CREATE AN ACCOUNT.**
- JIT allowed only for non-privileged when: WorkOS email verified AND exactly
  one case-insensitive match AND that row confirmed AND not suspended AND no
  membership conflict ⇒ link with `migration_source='JIT_VERIFIED_EMAIL'` +
  audit entry.
- Verified against: `AuthorizationService` (membership/permission resolution),
  `staffAuth` (staff = SUPER_ADMIN across memberships), RLS shim (status
  filter), role inventory (`OWNER, ADMIN, BURSAR, PARENT, SUPER_ADMIN`;
  PARENT treated as ordinary/non-financial unless granted otherwise).

## 6. D5 — Window Schedule (T0-relative)

T0 = production DUAL_AUTH cutover deploy date (recorded by release captain at
Phase 11 kickoff).

| Milestone | When |
|---|---|
| Start condition met (import verified; C1 probe green; staging soak ≥7d clean) | T0 − 0 (gate to deploy) |
| DUAL_AUTH begins | T0 |
| WORKOS_PRIMARY eligible earliest | T0 + 30d (if criteria met) |
| Fallback deadline (LEGACY_FALLBACK must not extend past) | T0 + 45d + 14d = T0 + 59d hard stop |
| Final cutover WORKOS_ONLY target | T0 + 45d |
| Rollback deadline while in DUAL_AUTH | any time (single flag); after WORKOS_ONLY, re-enable-native remains possible but is a formal owner decision |

Objective exit criteria (ALL required): successful-auth rate ≥99% over trailing
14d; failed-auth rate ≤ baseline +20%; zero unresolved identity-link failures
older than 72h; zero duplicate-account incidents; 100% privileged-account
verification sign-offs; RLS parity report green; financial-authorization drill
green (sandbox reversal w/ actor continuity); webhook independence drill green
(revocation honored within 60s with webhooks only); session verification drill
green (revoked session rejected ≤60s); support incident rate ≤ baseline.
Cutover is NOT complete merely because login works.

## 7. D7 — Adjudication Authority

- Automated rules: DETECT classification engine (decisions doc §10 case table)
  executes deterministically; produces AUTO_LINK or queues.
- REQUIRE_VERIFICATION: handled inside WorkOS flows automatically.
- MANUAL_REVIEW queue: adjudicated by the platform Security Lead role
  (dual-control: Security Lead + one of Owner/Ops Lead for privileged cases);
  SLA 5 business days; every action written to `audit_logs` with reviewer UUID.
- Escalation state: `REVIEW → ESCALATED_OWNER` when reviewers disagree or the
  case involves OWNER-role accounts or suspected fraud; only the project owner
  resolves ESCALATED_OWNER.
- Named individuals recorded on ops roster before Phase 5 executes
  (operational prerequisite G-OPS-1).

## 8. D10 — Verified Budget Basis (official source, no fabrication)

Source: workos.com/pricing (fetched 2026-08-23). Key verified facts:
AuthKit/User Management **first 1M MAU free**, each additional 1M $2,500/mo;
includes email+password, social login, passkeys, MFA, magic auth, enterprise
SSO; **Custom Domain $99/mo**; **staging environments free** (only production
billed); SSO connections / Directory Sync / Audit Logs streaming / Radar are
separate optional products CAPFLUX does not require; Standard support free.
MAU definition: unique user performing signup/sign-in/profile-update in a
calendar month.

Scale estimates (assumption: ~5 auth-active staff MAUs per school; guardians
are not login users today):

| Schools | Est. MAUs | WorkOS AuthKit | Custom domain (optional, D6) | Required total/mo |
|---|---|---|---|---|
| 10 | ~50 | $0 | $0 or $99 | **$0** (+domain option) |
| 50 | ~250 | $0 | $0 or $99 | **$0** |
| 100 | ~500 | $0 | $0 or $99 | **$0** |
| 500 | ~2,500 | $0 | $0 or $99 | **$0** |
| 1,000 | ~5,000 | $0 | $0 or $99 | **$0** |

Even 100k MAUs stays inside the free band. Migration/import API usage:
included in User Management. Supabase third-party MAU overage ($0.00325/MAU
beyond plan quota — supabase.com docs, verified) is immaterial at these
volumes. Conclusion: authentication cost is effectively $0/month baseline at
realistic scale; the ONLY paid decision is the optional $99/mo custom domain,
which rides on D6. Non-auth infrastructure (Supabase plan, Render instance,
SPA hosting) unchanged by this migration and out of D10 scope except as noted
in the Phase 0B table.

## 9. Account-Preservation Verification Plan (hard requirement)

For every migrated user, staging-then-production checks assert identity
continuity:

1. **Pre-import snapshot:** counts + checksums of
   users/user_profiles/school_members/role grants per school; per-user
   financial-permission resolution snapshot (permission codes list).
2. **Post-import:** same queries byte-compared. Any delta ⇒ halt.
3. **Per-user continuity assertion (scripted, sampled 100% privileged + ≥10%
   ordinary):**
   `workos_user_id --(link)--> SAME public.users.id --> same memberships -->
   same roles --> same permission codes --> same KYC/settlement actor
   references`.
4. **Ledger invariance:** `ledger_entries` count/sum by school identical
   before/after each phase touching auth (they should be untouched by
   construction — this proves it).
5. **Negative:** a WorkOS identity with NO link authenticates ⇒ 401/zero-rows;
   no `public.users` row created by authentication alone outside the JIT
   provisioning path (which creates NEW users only for genuinely new people).
6. **Duplicate canary:** attempt signup at AuthKit with an imported email ⇒
   blocked by WorkOS uniqueness; attempt second link insert ⇒ UNIQUE violation.
7. **Audit continuity:** pre-migration admin performs sandbox reversal;
   `audit_logs.actor_id` equals their original UUID.

## 10. Former Blocker G-OWNER-D6 — RESOLVED (2026-08-23)

Owner decision received and recorded verbatim:

> "CAPFLUX will initially use the default WorkOS AuthKit-hosted authentication
> domain. The authentication-domain configuration must remain
> abstracted/configurable so a future custom CAPFLUX domain can be introduced
> without changing the identity architecture, user records, authorization
> model, RLS model, or financial systems."

Closure evidence:
1. **Decision authority:** project owner (Phase 0D directive) — the only party
   able to resolve this fact per §19 of the Phase 0B tasking.
2. **Recorded rule:** issuer/domain are configuration concerns only —
   `AUTH_ISSUER`, `AUTH_REDIRECT_URI`, `WORKOS_CLIENT_ID`, `WORKOS_API_KEY`,
   `WORKOS_ENVIRONMENT` (plus an OPTIONAL future override variable for the
   custom domain, e.g. `WORKOS_CUSTOM_AUTH_DOMAIN`, empty by default). No
   WorkOS hostname may be hard-coded anywhere in frontend/backend source;
   enforced as a review grep-gate from Phase 6 onward.
3. **Deferral clause:** "The custom domain is intentionally deferred and is
   not an implementation blocker." The future DEFAULT → CUSTOM transition is
   configuration + DNS work only: it changes the registered Supabase issuer
   value and redirect URIs, never user UUIDs, `public.users`,
   `auth.users` mapping, `user_identity_links` semantics (links key on
   immutable WorkOS user IDs), roles, memberships, permissions, RLS policies,
   payment accounts, transactions, ledger entries, settlements, or audit
   history.
4. **Budget effect:** $99/mo custom-domain line item deferred with the
   decision; baseline remains $0/mo.

## 11. Official Sources (verified URLs — none fabricated)

- WorkOS — Migrate from Supabase Auth: https://workos.com/docs/migrate/supabase
- WorkOS — Migrate from other services (algorithms, dual-write, signup block):
  https://workos.com/docs/migrate/other-services
- WorkOS — Session tokens / JWKS: https://workos.com/docs/reference/authkit/session-tokens
- WorkOS — Authenticate with session cookie:
  https://workos.com/docs/reference/user-management/authentication/authenticate-with-session-cookie
- WorkOS — Pricing: https://workos.com/pricing
- WorkOS — Supabase + AuthKit integration: https://workos.com/docs/integrations/supabase-authkit
- Supabase — Third-party auth overview: https://supabase.com/docs/guides/auth/third-party/overview
- Supabase — WorkOS provider guide: https://supabase.com/docs/guides/auth/third-party/workos

## 12. Financial Safety Statement

No financial table is migrated, altered, or read by any migration step except
read-only integrity checksums. Payment transactions, ledger entries,
settlements, reconciliation, payment accounts, webhook logic, idempotency keys
and kobo integer arithmetic are untouched by design and by verification plan
(§9.4 proves it empirically each phase).

## 13. RLS Fail-Closed Verification Matrix

| Input scenario | Expected `requesting_user_id()` | Expected effect |
|---|---|---|
| No JWT claims | NULL | zero rows everywhere |
| Native Supabase token, valid UUID sub | that UUID (window passthrough) | legacy behavior preserved |
| WorkOS token, ACTIVE link | linked CAPFLUX UUID | normal access |
| WorkOS token, no link row | NULL (**deny**) | zero rows; no email fallback |
| WorkOS token, PENDING/REVIEW/SUSPENDED/REVOKED link | NULL (**deny**) | zero rows |
| Malformed sub (neither UUID nor `user_*`) | NULL (**deny**) | zero rows; exception swallowed |
| Deleted user (cascade removed link) | NULL (**deny**) | immediate lockout |
| Service-role backend query | bypasses RLS by design | unchanged, backend-only key |
| Attempted fallback to email/WorkOS-id/arbitrary UUID | PROHIBITED by policy | no such code path may exist; grep-gated in review |

Every row becomes a scripted probe in Phase 8; matrix must pass 100%.

## 14. Pre-existing unrelated working-tree changes (unchanged, documented)

`frontend/src/shared/repositories/StudentRepository.ts`,
`frontend/src/shared/students/StudentService.ts`,
`frontend/src/shared/students/StudentValidator.ts`,
`frontend/src/features/students/composables/useStudentManagement.ts` — present
since Phase 0A observation, unrelated to authentication, NOT modified or
reverted in any phase.

## 15. Final Status

All decisions D1–D10 CLOSED with auditable evidence; C1–C4 CLOSED as ratified
acceptance criteria with binding verification methods; G-OWNER-D6 RESOLVED
(default WorkOS AuthKit domain elected; custom domain deferred by owner).

> **IMPLEMENTATION STATUS: IMPLEMENTATION READY**
> Authorization to BEGIN implementation per
> `WORKOS_AUTHKIT_IMPLEMENTATION_PLAN.md`. Each phase must still pass its own
> acceptance gates; a failed C1–C4 artifact re-blocks the affected phase.
> This closure phase itself implements nothing (unchanged).
