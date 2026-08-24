# CAPFLUX WorkOS AuthKit — Owner Decision & Architecture Ratification Record

> **Phase:** 0B (Decision gate) — documentation only. No application code,
> migrations, dashboard settings, or environment variables were modified.
> **Date:** 2026-08-23
> **Inputs:** `WORKOS_AUTHKIT_MIGRATION_AUDIT.md`, `WORKOS_AUTHKIT_RUNBOOK.md`,
> compliance master + control documents, live code inspection, and current
> official WorkOS/Supabase documentation (cited inline).
> **Status vocabulary:** APPROVED · APPROVED WITH CONDITIONS ·
> OWNER ACTION REQUIRED · LEGAL REVIEW REQUIRED · TECHNICAL REVIEW REQUIRED ·
> BLOCKED.
>
> **Rule honored throughout:** no decision was silently chosen on the owner's
> behalf. Where a choice is a business/risk acceptance rather than an
> engineering consequence, this record says so and routes it to the owner.

---

## 1. Executive Summary

All ten decisions D1–D10 are resolved to recommendation level with explicit
conditions. Eight are **APPROVED WITH CONDITIONS** (engineering-safe given the
owner's already-stated non-negotiables), one is conditional on unknown facts
(**D6 custom domain → OWNER ACTION REQUIRED**), and one is a business
acceptance (**D10 budget → OWNER ACTION REQUIRED**, with VERIFY CURRENT
PRICING markers).
> *Phase 0C/0D update: ALL TEN — including D6 (default WorkOS domain elected;
> custom domain deferred) and D10 (official pricing verified) — are now
> CLOSED. See the Phase 0C Addendum at the end of this document and the gate
> file for authoritative current status. The sections below are retained as
> the decision rationale record.*

The ratified architecture is unchanged from the audit: **WorkOS AuthKit as
authentication authority + Supabase third-party auth for RLS compatibility +
`user_identity_links` bridge + fail-closed `requesting_user_id()` shim +
dual-auth middleware window**. New evidence strengthens it: WorkOS publishes a
dedicated official guide, *“Migrate from Supabase Auth”*
(workos.com/docs/migrate/supabase), confirming direct export of Supabase
bcrypt hashes (`auth.users.encrypted_password`) and import via
`passwordHashType: 'bcrypt'`.

**Gate outcome:** every mandatory sign-off block in
`WORKOS_AUTHKIT_IMPLEMENTATION_GATE.md` must be countersigned before any
implementation phase begins. Until then the standing verdict is:

> **IMPLEMENTATION BLOCKED** (pending owner countersignatures; default state).
> *Superseded 2026-08-23: all decisions closed; gate now reads
> IMPLEMENTATION READY.*

## 2. Current Authentication State (verified, unchanged)

- Authority: Supabase Auth. Backend validation:
  `backend/middleware/requireAuthSupabase.ts` → `supabase.auth.getUser(token)`
  → `public.users` row keyed by token sub (UUID).
- Canonical identity: `auth.users.id ≡ public.users.id`; 18 user-reference
  columns UUID-FK'd to `public.users(id)`; ~95 RLS expressions use
  `auth.uid()`.
- Browser→Supabase direct traffic is load-bearing (offline sync plane:
  `payment_transactions`, `settlement_records`, `payment_accounts`, ledger
  realtime channels) ⇒ RLS remains an active boundary.
- Legacy dormant WorkOS stack preserved in-tree (rollback asset).
- System roles present in DB: `OWNER`, `ADMIN`, `BURSAR`, `PARENT`,
  `SUPER_ADMIN`. Financial/KYC/staff *capabilities* flow through
  `role_permissions`; platform staff review currently requires `SUPER_ADMIN`
  (`backend/middleware/staffAuth.ts`).
- Correction to the Phase-0B task list: there is **no**
  `frontend/src/shared/services/AuthorizationService.ts`; frontend
  authorization lives in `frontend/src/shared/rbac/` (`RouteGuard.ts`,
  RBAC providers). Backend authorization authority remains
  `backend/services/AuthorizationService.ts`. This matters because D3's
  privileged-role definitions are enforced server-side.

## 3. Decision Authority

| Decision | Nature | Decider |
|---|---|---|
| D1 | Risk acceptance (credential-material handling) | Owner (engineering recommends method) |
| D2 | Architecture ratification | Principal Architect ratifies; Owner countersigns |
| D3 | Security policy (fail-closed by mandate) | Engineering proposes binding policy; Owner confirms |
| D4 | Product scope (providers) | Engineering recommends minimum set; Owner confirms |
| D5 | Operational timeline | Engineering recommends; Owner sets final dates |
| D6 | Procurement/DNS/domain | **Owner** |
| D7 | Deterministic procedure (derived from non-negotiable rules) | Engineering defines; Owner confirms |
| D8 | Data lifecycle | Engineering classifies; deletion deferred to Owner |
| D9 | Security usability tradeoff | Engineering stages; Owner sets enforcement dates |
| D10 | Budget | **Owner** |

---

## 4. D1 — Password Migration

### Decision
Migrate existing users' credentials by **porting their existing bcrypt hashes
from Supabase into WorkOS during pre-import**, so users keep email **and**
password. Fallback lane: targeted password-reset emails for any hash that fails
porting or verification. OAuth-only users need no hash migration.

### Options considered
1. **Direct hash port (RECOMMENDED)** — zero user friction, no reset emails,
   no duplicate accounts possible from credential confusion.
2. Forced reset for all — high support burden; breaks fee-collection-period
   access; risks shadow duplicate accounts created by confused users.
3. Lazy migration (verify against Supabase on first login, then set) — keeps
   two systems authoritative mid-flight; rejected (complexity + exposure).
4. Magic-link-only re-onboarding — weaker proof than existing-password
   continuation for financial accounts.

### Evidence (official docs, verified 2026-08)
- WorkOS, “Migrate from Supabase Auth”: export
  `SELECT id, email, encrypted_password, email_confirmed_at … FROM auth.users`
  (join `auth.identities` for social logins); import via Create User API /
  CLI with `passwordHash: <encrypted_password>, passwordHashType: 'bcrypt'`.
- Supported import algorithms generally: bcrypt, scrypt, firebase-scrypt,
  ssha, ssha256, pbkdf2, argon2. **Supabase uses bcrypt (`$2a$…`) — directly
  compatible. No re-hashing (double-hash would permanently break login).**
- Supabase side: direct Postgres access makes hashes exportable without
  vendor tickets (Supabase staff confirmation in official discussions;
  `encrypted_password` documented in Supabase's own migration guides).
- bcrypt cost: WorkOS accepts standard bcrypt PHC strings ($2a/$2b/$2y);
  cost factor is embedded in the hash itself — **no specific cost requirement
  beyond what Supabase already stores**. VERIFY CURRENT DOCS at implementation
  time if Supabase changes defaults (currently bcrypt).

### Security implications & hard requirements (CONDITIONS — all mandatory)
- Plaintext passwords NEVER exist anywhere in this path. Only salted hashes move.
- Hashes never logged, never committed, never stored in object storage, never
  left on developer machines. Script runs ONLY on the backend host (Render) or
  an ephemeral CI job with injected secrets; output artifacts auto-purged.
- Transport: TLS to `api.workos.com` (WorkOS API); no intermediate storage.
- The export file, if any transient staging artifact exists, lives encrypted
  in-memory only; batch streaming preferred over files entirely.
- Audit: record counts + success/failure counts only — never hash values.
- Rotate `SUPABASE_SECRET_KEY` after migration completes (it could have read
  hashes) — scheduled hygiene, VERIFY impact on running services first.
- NDPC/NDPA data-protection note (DATA_PROTECTION.md §6 safeguards): hashes
  are personal data under protection; handling described above is
  minimization-compliant. Cross-border transfer to WorkOS (US) is consistent
  with existing INFRA-010 posture → **LEGAL REVIEW REQUIRED item already open
  in the register applies unchanged** (not newly created by D1).

### Data-protection / financial-integrity / operational / rollback
- Data protection: minimization satisfied; retention zero post-run.
- Financial integrity: none touched (no financial table reads).
- Operational: sample-verification step (N≥20 incl. every OWNER/BURSAR/
  SUPER_ADMIN account) before cutover.
- Rollback: WorkOS-side users can be deleted/re-imported freely pre-cutover;
  Supabase untouched (read-only export).

D1 recommendation: direct bcrypt port + reset-email fallback lane.
D1 owner approval required: YES (credential-handling addendum signature).
D1 implementation prerequisites: backend-host runner; secret injection;
verification checklist; purge procedure.
D1 rollback: stop importer; delete partial WorkOS users; native auth intact.

**STATUS: APPROVED WITH CONDITIONS** · Blocking: yes · Owner approval column:
PENDING SIGN-OFF.

## 5. D2 — Architecture Ratification

### Decision
**RATIFIED WITH CONDITIONS.** The audit's bridge architecture is confirmed as
the target. No financial-table user identifiers change; no FK type changes;
additive identity-linking infrastructure only.

### Ratified diagram (trust + authn/authz boundaries)

```
┌──────────────────────────── TRUST BOUNDARY 0: public internet ───────────┐
│                                                                          │
│  Browser SPA (Vercel/Netlify)                                            │
│   ├─ AuthKit hosted login (WorkOS owns credentials/MFA/reset flows)      │
│   ├─ axios /api/*  Bearer <workos access token, MEMORY ONLY>             │
│   └─ supabase-js sync plane: accessToken() ← GET /api/auth/access-token  │
└──────────────┬───────────────────────────────────────────┬──────────────┘
               │ HTTPS (code, tokens)                      │ HTTPS (PostgREST/realtime)
┌──────────────▼──────────── TB1: CAPFLUX backend ─────────▼────────────┐
│  requireAuthAny                                                       │
│   ├─ (a) WorkOS JWT: verify JWKS (iss=api.workos.com/user_management/ │
│   │      <client_id>, aud=client_id, exp) → sub=user_…                │
│   │        └─ user_identity_links (ACTIVE) → capflux_user_id (UUID)   │
│   └─ (b) Supabase JWT [transition window only]: getUser(token) → UUID │
│          ⇒ req.user = public.users row (SAME shape either way)        │
│  AuthorizationService (unchanged): school_members ⋈ roles ⋈ perms     │
│  Service-role queries: school_id scoping re-asserted per request      │
└──────────────┬───────────────────────────────────────────┬───────────┘
               │ service role (secret, backend-only)       │
┌──────────────▼──────────── TB2: Supabase Postgres ────────▼───────────┐
│  Data API validates WorkOS JWT via registered third-party issuer      │
│  Postgres role = authenticated (JWT template claim)                   │
│  RLS: (select public.requesting_user_id())                            │
│    ├─ sub='user_…' → link table lookup (fail-closed NULL)             │
│    └─ native UUID sub → auth.uid()-equivalent passthrough [window]    │
│  auth.users untouched; triggers intact; financial tables untouched    │
└───────────────────────────────────────────────────────────────────────┘
```

### Validation against required properties

| Property | Verdict | Basis |
|---|---|---|
| Tenant isolation | PRESERVED | Membership-scoped policies unchanged except uid-source function; fail-closed on unknown identities (stronger than today) |
| RLS behavior | PRESERVED/strengthened | `(select requesting_user_id())` InitPlan-wrapped; SUSPENDED/REVOKED links ⇒ NULL ⇒ zero rows |
| school_id ownership | UNCHANGED | `school_members` keyed by UUID; provider change invisible |
| Authorization roles | UNCHANGED | DB roles sole authority; WorkOS `role(s)`/`permissions` claims informational-only |
| Financial permissions | UNCHANGED | Same permission resolution path |
| Payment creation/verification, settlement, DVA, KYC access | UNCHANGED | Route middleware chains (`requirePaymentReady`, `requireStaff`) operate on `req.user.id` |
| Audit logging | PRESERVED | `audit_logs.actor_id` remains the stable UUID across migration |
| Webhook authentication | IMPROVED | New WorkOS receiver verifies `workos-webhook-signature`; payment webhooks untouched |
| Service-to-service auth | UNCHANGED | Service-role key stays backend-only |

### Failure modes (design responses)
1. **Link table unavailable/corrupt** → shim returns NULL ⇒ deny (fail-closed),
   never fail-open.
2. **JWT template misconfigured** → requests run as anon ⇒ silent-empty.
   Mitigation: pre-swap probe asserting `authenticated` role through a real
   token; ordering rule (template BEFORE policy swap).
3. **JWKS outage at WorkOS** → backend rejects (fail-closed); sessions rely on
   short-lived cached JWKS; acceptable single-provider dependency parity with
   today's Supabase dependency.
4. **Dual-path divergence** → both paths resolve to the same UUID by
   construction; regression tests pin equality.

### Rollback architecture
Feature-flag pair (`AUTH_PROVIDER_MODE` backend, `VITE_AUTH_PROVIDER`
frontend) reverses every phase; RLS prior-policy DDL embedded in the rewrite
migration header; additive objects may remain harmlessly. See audit §19.

### Conditions (mandatory)
C1: JWT template live and probe-verified before any policy swap.
C2: Row-count parity probes per role before/after policy swap must match.
C3: `requireAuthSupabase` remains mounted until Phase 12.
C4: Negative suites (spoof headers, forged tokens, cross-school) stay green.

**STATUS: APPROVED WITH CONDITIONS** · Blocking: yes (conditions are gates,
not suggestions).

## 6. D3 — JIT-Link Policy for Financial-Permission Holders

### Decision (binding policy — fail-closed)
1. **Primary mechanism is PRE-LINKING (Option E):** every existing CAPFLUX
   user — explicitly including ALL privileged accounts — receives its WorkOS
   counterpart during import, BEFORE AuthKit signups open. Privileged accounts
   get priority order and mandatory sample sign-in verification.
2. **JIT auto-linking (runtime) is permitted ONLY for non-privileged accounts**
   and ONLY when ALL hold:
   - WorkOS email verified (WorkOS enforces verification before session);
   - exactly ONE active `public.users` row matches (case-insensitive email);
   - that row's Supabase email was confirmed;
   - account not suspended/disabled; no conflicting memberships;
   - `migration_source='JIT_VERIFIED_EMAIL'` recorded + audit entry written.
3. **JIT linking is PROHIBITED for privileged identities** (Option C):
   any principal holding `OWNER`, `ADMIN`, `BURSAR`, `SUPER_ADMIN`,
   platform-staff membership, or ANY `role_permissions` grant covering
   billing, payment, settlement, KYC review, or reconciliation codes.
   Unmatched privileged logins resolve to zero rows (deny) and route to
   MANUAL_REVIEW.
4. **Not confidently matched ⇒ no link** (REQUIRE_VERIFICATION or
   MANUAL_REVIEW). The system never guesses.

### Risk analysis vs policy
| Risk | Policy response |
|---|---|
| Account takeover via email match | Pre-import occupies emails first (WorkOS uniqueness); verified-email-both-sides rule; privileged exclusion |
| Email collision (dup legacy rows) | Detection query → REVIEW; never auto-merge |
| Invitation abuse | Invitations unaffected (membership-bound); AUTH-007 gap tracked separately — must NOT be fixed by widening JIT |
| Owner impersonation | OWNER excluded from JIT; out-of-band proof required for manual links |
| Privilege escalation | Roles resolved from DB only; linking grants NO permissions |
| School tenant crossover | Links carry no school scope; membership resolution unchanged |
| Duplicate identity | UNIQUE constraints one-active-per-side |
| Payment/DVA/settlement/KYC authorization | Privileged exclusion keeps all money-capable identities human-adjudicated |

Dormant privileged users: covered by pre-import (they keep passwords), so the
prohibition costs nothing in availability.

**STATUS: APPROVED WITH CONDITIONS** (owner confirms the privileged list above
is exhaustive; adding roles later requires decision-record amendment).
Blocking: yes.

## 7. D4 — OAuth Provider Set

### Decision: MINIMUM NECESSARY PROVIDERS
| Provider | Verdict | Rationale |
|---|---|---|
| Email+Password | **ENABLED (required)** | Current baseline; hash-port target; works without smartphone |
| Google | **ENABLED** | Parity with current product (`signInWithProvider('google')` exists); dominant personal-email ecosystem among Nigerian school administrators (Android/Gmail); WorkOS manages consent screens |
| Microsoft | DEFERRED | Only if a customer segment demands school M365 tenancy; adds org-claim complexity |
| Apple | PROHIBITED-for-now | No evidence of need; hidden-email relay addresses complicate identity matching |
| GitHub | PROHIBITED-for-now | Developer-audience product; wrong demographic |
| Magic Auth / others | DEFERRED | Revisit post-stabilization |

### Linking policy (critical case)
A password-origin user later clicking "Sign in with Google": WorkOS matches
the OAuth assertion to the EXISTING WorkOS user after ITS email verification
step (WorkOS requires verified email before authentication completes) ⇒ same
`user_xxx` ⇒ same link row ⇒ same CAPFLUX UUID. **No second CAPFLUX account is
ever created for an already-linked email.** Unverified-OAuth-email collisions
route to REQUIRE_VERIFICATION inside WorkOS itself, never silently linked.

Config surface: providers toggled in [WORKOS DASHBOARD] AuthKit settings;
Google OAuth client configured there (WorkOS wizard provisions redirect URIs).
Supabase's own Google provider stays enabled only for the legacy cohort during
the dual window, then disabled (Phase 12). Zero frontend-host config beyond
existing redirect allowlists.

Cost/ops: included in User Management free tier band (≤1M MAU, VERIFY CURRENT
PRICING); operational burden ≈ zero (hosted).

**STATUS: APPROVED WITH CONDITIONS** (owner confirms no Microsoft requirement
exists today). Blocking: no (can start with this set; revisit anytime).

## 8. D5 — Dual-Auth Migration Window

### Recommendation: **45 days** in DUAL_AUTH before evaluating WORKOS_ONLY.

Justification vs alternatives:
- **7/14 days**: shorter than one Nigerian school fee-collection cycle
  (resumption spike + mid-term collections span ~4–6 weeks); guarantees a
  missed cohort of fee-paying bursars. Rejected.
- **30 days**: viable minimum; thin margin for one bad week (provider outage,
  rollback drill). Fallback if owner needs speed.
- **45 days (RECOMMENDED)**: full monthly cycle + slack; dormant-user reach
  acceptable because ported passwords mean dormancy never strands anyone —
  the window exists to build confidence, not to chase logins.
- **60–90 days**: doubles credential-exposure surface of running both IdPs for
  marginal benefit; support cost drags. Rejected except under extraordinary
  circumstances.

Because D1 ports passwords, the window's exit is criteria-driven, not
calendar-desperate: users who never log in during the window still succeed on
first post-window login with their existing password.

### State machine

```
LEGACY_ONLY ──► DUAL_AUTH ──► WORKOS_PRIMARY ──► WORKOS_ONLY
   (today)        │    ▲             │                
                  │    └─────────────┘                
                  ▼                                   
            LEGACY_FALLBACK  (contingency, time-boxed ≤14d)
```

| State | Frontend flag | Backend flag | Supabase providers | AuthKit |
|---|---|---|---|---|
| LEGACY_ONLY | `supabase` | `supabase_only` | enabled | n/a |
| DUAL_AUTH | `workos` | `dual` | sign-ins enabled; SIGNUPS disabled | live; signups enabled |
| LEGACY_FALLBACK | `supabase` (flip) | `dual` or `supabase_only` | re-enabled incl. signups if needed | paused |
| WORKOS_PRIMARY | `workos` | `workos_primary` (Supabase path accepted but deprecated) | sign-ins still technically possible | canonical |
| WORKOS_ONLY | `workos` | `workos_only` (Supabase bearer rejected) | providers disabled | sole authority |

- Transitions executed by release captain via env flags + deploy; each
  transition requires an owner-visible change record. WORKOS_ONLY additionally
  requires explicit owner approval.
- **Start condition (LEGACY_ONLY→DUAL_AUTH):** import complete & verified;
  JWT template probe green; staging soak ≥7 days clean.
- **Objective exit criteria (WORKOS_PRIMARY→WORKOS_ONLY):**
  ≥95% of active-in-prior-90-days users have ≥1 successful WorkOS login;
  zero P1 auth incidents for 14 consecutive days;
  sync-plane auth error rate ≤ baseline for 7 days;
  REVIEW queue empty or explicitly waived by owner.
- **Emergency rollback:** single flag flip to LEGACY_FALLBACK at any time;
  native credentials were never modified, so recovery is immediate.
- **Forced migration:** none. Nobody is locked out while native access exists;
  after WORKOS_ONLY, imported passwords keep everyone reachable.
- **New users during window:** created ONLY in WorkOS from day one of
  DUAL_AUTH (Supabase signup disabled first) ⇒ no divergent cohort to merge.

**STATUS: APPROVED WITH CONDITIONS** · Owner sets calendar dates; duration
change <30d requires re-justification. Blocking: yes (dates).

## 9. D6 — Custom Authentication Domain

### Decision: CONDITIONAL — OWNER ACTION REQUIRED
> *SUPERSEDED 2026-08-23: D6 CLOSED by owner directive — default WorkOS
> AuthKit-hosted domain for initial deployment; custom domain deferred,
> configuration-driven issuer mandated. See Addendum.*
Production domain is not registered anywhere in repo evidence (no deployment
configs exist). Therefore:

- **Recommendation:** `auth.<production-domain>` as WorkOS **Custom Auth
  Domain**, e.g. `auth.capflux.ng` once the domain is confirmed. Benefits:
  phishing-resistant branded login, stable issuer URL independent of WorkOS
  infra changes, cookie/branding consistency.
- **DNS:** whatever records the WorkOS dashboard instructs when adding the
  custom domain (verification + cert issuance). **Do not invent records now**;
  the exact record set is generated by [WORKOS DASHBOARD] → Domains at
  configuration time and must be copied verbatim.
- **Ordering constraint (hard):** custom domain must be ACTIVE **before**
  registering the issuer with Supabase third-party auth, because the issuer
  embeds the hostname (`https://<auth-domain>/user_management/<client_id>`).
  Changing later means re-doing the Supabase integration + JWT template
  validation.
- **Staging:** default `*.workos.com` hosted domain acceptable initially;
  second custom domain optional (cost call → D10).
- **Local development:** localhost redirect URIs against the default domain;
  no custom domain needed; cookies unaffected (`COOKIE_SECURE=false`,
  SameSite=Lax).
- **OAuth callbacks:** Google client redirect URIs must include BOTH the
  WorkOS-managed callback (handled inside AuthKit) and per-environment app
  callback `/auth/callback`; allowlists updated per environment.
- **Email sender domain** for verification/reset mail follows AuthKit branding
  settings; VERIFY deliverability options in dashboard at setup time.

D6 recommendation: production custom domain; staging default; local default.
D6 prerequisites: confirmed production domain; DNS control; certificate
issuance window (minutes–hours, VERIFY in dashboard).

**STATUS: ~~OWNER ACTION REQUIRED~~ → CLOSED** (2026-08-23, owner elected default WorkOS AuthKit domain; custom domain deferred; env-driven issuer mandated).
Blocking: yes for Phases 2–4 production steps only; staging/local work can
proceed on the default domain.

## 10. D7 — Duplicate-Email Adjudication

### Deterministic state machine

```
                 ┌──────────────┐
 candidate pair ►│ DETECT       │ lower(email) match across systems
                 └──────┬───────┘
                        ▼
              exactly-one-match AND privileged? ───yes──► DENY_LINK(auto)
                        │ no                                → MANUAL_REVIEW
                        ▼
              verified(WorkOS) AND confirmed(Supabase)? ─no─► REQUIRE_VERIFICATION
                        │ yes                                  (WorkOS flow)
                        ▼
              memberships/history consistent? ────no────► MANUAL_REVIEW
                        │ yes
                        ▼
                 AUTO_LINK  (status ACTIVE, source recorded, audited)

 MANUAL_REVIEW outcomes: AUTO_LINK | CREATE_NEW_IDENTITY | DENY_LINK (keep
 separate identities) — decided by adjudicator (owner-appointed), every action
 audit-logged with reviewer id. No automatic merges, ever, where financial
 ownership or tenant identity is ambiguous.
```

### Case table (all ten required cases)

| # | Case | Outcome |
|---|---|---|
| 1 | Exact match + both verified | AUTO_LINK (privileged → still pre-linked only; JIT prohibited per D3) |
| 2 | Exact match, either unverified | REQUIRE_VERIFICATION (complete verification in WorkOS first) |
| 3 | Case-only difference (`A@x` vs `a@x`) | Normalize with `lower()` for detection; if two DISTINCT rows coexist (Postgres UNIQUE(email) is case-sensitive) ⇒ MANUAL_REVIEW; single row ⇒ treat as case 1/2 after normalization |
| 4 | Multiple Supabase identities, same email | Impossible to auto-resolve ⇒ MANUAL_REVIEW (never merge financial history automatically) |
| 5 | Multiple WorkOS identities, same email | WorkOS enforces uniqueness per environment ⇒ only possible cross-environment; adopt staging/prod discipline; MANUAL_REVIEW if encountered |
| 6 | Privileged user unmatched | DENY_LINK(auto) → MANUAL_REVIEW w/ out-of-band proof (per D3) |
| 7 | School owner unmatched | Same as 6 (OWNER ⊂ privileged) |
| 8 | User with financial history unmatched | Same as 6 (any money-capable permission = privileged) |
| 9 | Disabled/deleted account | Do NOT link deleted accounts (their `public.users` row is gone by cascade); suspended ⇒ SUSPENDED link status; reactivate via normal admin flow first |
| 10 | Conflicting school memberships | Membership conflict ≠ identity question; link identity, then resolve membership via existing RBAC admin flows; if memberships imply different persons ⇒ MANUAL_REVIEW |

Preservation guarantee: adjudication NEVER creates a second customer account
for an already-existing person-case; outcomes operate on the EXISTING UUID.
CREATE_NEW_IDENTITY applies only when review concludes the emails genuinely
belong to different people.

**STATUS: APPROVED WITH CONDITIONS** (owner names the adjudicator + SLA).
Blocking: yes for Phase 5 (pre-linking runbook uses this procedure).

## 11. D8 — Retire Legacy Identity Migrations

### Inventory & classification (nothing touched now)

| Artifact | Classification | Action |
|---|---|---|
| Table `legacy_identity_migrations` (+ migration 026) | HISTORICAL + DUPLICATE (wrong-typed column proves it never held real WorkOS IDs; superseded by `user_identity_links`) | FREEZE now (revoke writes via future migration `202608230005`, deferred per audit §11); DELETE LATER only via dedicated migration with backup+verification+retention |
| `backend/routes/auth.ts::claim-account` | DEAD-after-window / REQUIRED_FOR_ROLLBACK until Phase 12 | RETAIN untouched through dual window |
| Legacy WorkOS stack (`WorkOSAuthService`, `SessionService`, `requireAuth`, `AuthKitProvider`) | REVIVED (becomes the migration vehicle) | RETAIN; update to current SDK shapes in Phase 6 |
| `_phase6_*` backend scripts | HISTORICAL | RETAIN read-only; exclude from builds (already outside src) |
| Migrations 021/026 SQL files | IMMUTABLE HISTORY | Never edit/delete applied migrations (AGENTS.md rule) |
| `docs/auth-migration-audit.md` etc. | HISTORICAL | Annotate header "historical" in Phase 12 |

Dependency audit performed: `claim-account` referenced only by legacy route +
its tests; table referenced only by that route + types. No RLS dependencies.
Safe to freeze.

Deletion prerequisites (future phase): pg_dump backup retained ≥90 days;
row-count verification; rollback script restoring rows; retention per NDPC
schedule (DATA_PROTECTION.md §5).

**STATUS: APPROVED WITH CONDITIONS** (freeze approved; physical deletion
explicitly deferred to a future owner-approved phase). Blocking: no.

## 12. D9 — MFA Timing

### Decision: staged enablement, enforcement begins AFTER cutover stability
| Stage | When | Scope |
|---|---|---|
| PHASE 1 | Migration start | Optional enrollment open in AuthKit; nothing mandatory (avoid stacking friction onto provider change) |
| PHASE 2 | ≥30 days into DUAL_AUTH | Mandatory: `SUPER_ADMIN` + platform staff (financial reviewers — highest blast radius) |
| PHASE 3 | Post-WORKOS_PRIMARY | Mandatory: `OWNER` |
| PHASE 4 | +30 days | Mandatory: `ADMIN`, `BURSAR` (all financially-capable roles) |
| PHASE 5 | Deferred, data-driven | All users — reassess after support metrics; do NOT mandate broadly for convenience-parity reasons |

Method policy: TOTP authenticator apps preferred; SMS OTP discouraged as
primary factor (SIM-swap exposure in the Nigerian market + per-message cost);
email OTP last resort only; single-use recovery codes generated at enrollment,
shown once, stored hashed by WorkOS.

Recovery/break-glass: lost device ⇒ verified secondary email + support ticket
re-enrollment flow (SLA defined in ops runbook); each privileged account keeps
an offline sealed recovery-code copy; platform break-glass requires dual
control (two staff) and writes an immutable audit record. Break-glass accounts
are enumerated, reviewed quarterly, and cannot hold tenant roles beyond a
designated test school.

Offline note: MFA occurs at AuthKit login only; offline app usage (Dexie-first)
is unaffected because sessions persist locally.

Nigerian-usability mitigations: phased rollout, in-product enrollment prompts,
school-holiday timing avoided for mandatory deadlines.

**STATUS: APPROVED WITH CONDITIONS** (owner confirms stage dates; AUTH-008
control moves NOT_IMPLEMENTED → PARTIAL at PHASE 1). Blocking: no (Phases 1–2
only gate Phase 10 of the plan).

## 13. D10 — Budget Confirmation

> Figures marked **[VERIFY CURRENT PRICING]** must be re-checked at the
> official page cited, immediately before implementation. Nothing below is a
> quote.

| Item | FREE tier | LOW-COST tier | PRODUCTION (est.) | SCALE | Source |
|---|---|---|---|---|---|
| WorkOS User Management/AuthKit | Free up to 1M MAU [VERIFY CURRENT PRICING] | — | $0 expected for years at CAPFLUX scale | negotiated enterprise | workos.com/pricing ; workos.com/user-management |
| Supabase (project + third-party MAU) | Free tier w/ limits | Pro base ≈ low tens $/mo [VERIFY CURRENT PRICING] | Pro + compute add-on per load | Team plan | supabase.com/pricing |
| Supabase Third-Party Auth MAU | within plan quota | — | **$0.00325 per third-party MAU beyond quota** (verified doc figure) | linear | supabase.com/docs/guides/auth/third-party/overview + usage mgmt page |
| Render (backend web service) | free spin-down unsuitable for payments API | starter instance [VERIFY CURRENT PRICING] | small always-on plan + autoscale off/on per load | horizontal instances | render.com/pricing |
| Vercel or Netlify (SPA) | Hobby free tier likely sufficient | Pro if team features needed [VERIFY CURRENT PRICING] | Pro optional | bandwidth-driven | vercel.com/pricing ; netlify.com/pricing |
| Domain (if D6 proceeds) | — | standard registrar fee ≈ $10–20/yr [VERIFY CURRENT PRICING] | + subdomain (free) | — | registrar |
| DNS hosting | usually included | — | — | — | registrar/DNS provider |
| Email (transactional) | AuthKit sends its own auth email [VERIFY CURRENT PRICING/inclusions] | existing Termii/notification budget unchanged | unchanged | — | workos docs ; termii |
| Monitoring/logging | Render logs + uptime checks free-ish | add managed logging if needed [VERIFY CURRENT PRICING] | optional APM | — | render.com ; provider pages |
| Backups | Supabase daily backups per plan [VERIFY CURRENT PRICING] | — | PITR add-on if required | — | supabase.com/docs/guides/platform/backups |
| Secrets management | env-var stores (Render/Vercel dashboards) free | password manager seat(s) [VERIFY CURRENT PRICING] | optional dedicated vault | — | platform pricing |
| SMS/OTP | N/A (TOTP chosen; avoids SMS spend) | — | — | — | D9 decision removes this line item |

Monthly baseline (PRODUCTION est., mid-points, all VERIFY): Supabase Pro +
compute + modest third-party overage ≈ low hundreds USD worst case at current
user counts; Render always-on ≈ tens USD; SPA $0–Pro; domain amortized ≈ $1–2.
Migration-period incremental: effectively $0 extra services (WorkOS free band;
staging reuses plans); engineering time is the real cost.
Annualized: dominated by Supabase plan choice. Technical necessity vs
convenience: custom domain (D6) and Supabase Pro are necessity-leaning;
Vercel/Netlify Pro and APM are convenience unless scale demands.

What becomes paid at scale: third-party MAU overage (linear, predictable),
Supabase compute, Render instances. What can remain free: WorkOS (≤1M MAU),
SMS (eliminated by TOTP choice), DNS.

**STATUS: ~~OWNER ACTION REQUIRED~~ → CLOSED** (2026-08-23: official pricing verified from workos.com/pricing; $0/mo baseline through ≥1,000 schools recorded in closure report §8). Blocking: none.

---

## 14. Cross-Decision Consistency Matrix

| Pair | Check | Verdict |
|---|---|---|
| D1↔D5 | Hash port completes BEFORE DUAL_AUTH start; window length doesn't depend on reset-email latency | CONSISTENT (fallback lane adds ≤48h contingency, inside 45d) |
| D2↔D3 | Bridge is role-agnostic; D3 restricts *linking policy*, not architecture | CONSISTENT (privileged exclusion implemented in linking service, not shim) |
| D2↔D7 | Adjudication states map 1:1 onto link statuses (PENDING/ACTIVE/REVIEW/REVOKED) consumed by shim fail-closed | CONSISTENT |
| D4↔D7 | Google OAuth binds to existing verified WorkOS user ⇒ produces NO new duplicate cases beyond case table | CONSISTENT |
| D5↔D8 | Legacy claim-account route stays intact through entire window (rollback asset); retirement begins only in Phase 12 | CONSISTENT |
| D6↔D4 | OAuth callbacks derive from final auth domain ⇒ domain decision must precede provider configuration in production | CONSISTENT (ordering encoded in checklist) |
| D9↔D5 | No MFA mandate lands during cutover itself; first mandate ≥30d into window ⇒ no compounded lockout risk | CONSISTENT |
| D10↔* | All decisions stay inside FREE/LOW-COST bands except optional items flagged convenience | CONSISTENT pending owner verification |

No contradictions found.

## 15. Security Impact (aggregate)

Strengthens: enumeration resistance (AUTH-003), session revocation (AUTH-005
via WorkOS revocation + webhook + shim), frontend credential hygiene (AUTH-010
— tokens leave localStorage), breach-password protection, bot/spam detection,
webhook coverage for identity events.
Unchanged-by-design: payment state machine, ledger append-only semantics,
idempotency, settlement/reconciliation paths, service-role confinement,
TENANT-001…008 posture.
Requires care: RLS rewrite (risk R1/R2 in audit §20) — conditions C1–C4 of D2
are the controls.

## 16. Compliance Impact (control mapping)

| Control | Effect |
|---|---|
| AUTH-001 per-request JWT validation | PRESERVED (WorkOS JWKS path equally strict) |
| AUTH-002 identity only from token | PRESERVED |
| AUTH-003 enumeration resistance | IMPROVES (AuthKit generic surfaces; legacy claim endpoint retires in Phase 12) |
| AUTH-004 rate limiting | UNCHANGED middleware; AuthKit adds upstream throttles |
| AUTH-005 session revocation | IMPROVES (revocation API + session.revoked webhook + link revocation) |
| AUTH-006 privileged safeguards | PRESERVED |
| AUTH-007 invitation binding FAIL (COMP-003) | NOT REGRESSED; explicitly out of scope; JIT policy does not interact with KYC principal invitations |
| AUTH-008 MFA | NOT_IMPLEMENTED → PARTIAL at D9-PHASE 1 |
| AUTH-010 frontend credential storage | IMPROVES |
| TENANT-001/002 RLS | PRESERVED via additive rewrite w/ parity gates |
| AUDIT-* | PRESERVED (actor UUID continuity asserted by test) |
| COMP-001 lookalike secret in old audit doc | PURGE scheduled in implementation phase (hygiene, unrelated blocker) |
| INFRA-010 cross-border | Existing REQUIRES_LEGAL_REVIEW item now also covers WorkOS data flow → see §19 questions |

## 17. Rollback Requirements (consolidated)

Flag-pair reversibility at every phase; embedded prior-policy DDL; additive DB
objects only; native credentials never altered; WorkOS-side objects disposable
pre-cutover; LEGACY_FALLBACK state time-boxed; no destructive operation in any
phase before 12; Phase 12 itself retains data-only removals with backups.

## 18. Implementation Prerequisites (gates to unlock Phase 0→1)

1. Countersigned gate matrix (IMPLEMENTATION_GATE.md).
2. D1 handling addendum signed; runner host designated.
3. Production domain confirmed (unblocks D6-dependent steps).
4. Adjudicator named (D7) + privileged-role list confirmed (D3).
5. Budget tiers verified (D10 markers resolved).
6. Staging WorkOS environment created (dashboard action §checklist).
7. Compliance evidence updates scheduled (`compliance-status.json` pointers
   in each implementation PR).

## 19. Outstanding Owner Questions

1. Confirm production domain + willingness to procure custom auth subdomain.
2. Name duplicate-email adjudicator + SLA.
3. Confirm privileged-role list is exhaustive (OWNER, ADMIN, BURSAR,
   SUPER_ADMIN, platform staff, any financial/KYC permission holder).
4. Set DUAL_AUTH calendar dates (recommendation: 45 days).
5. Approve credential-handling addendum (D1).
6. Legal review status for INFRA-010 extension to WorkOS (US) data processing —
   carry existing register item forward; add WorkOS DPA execution to vendor list
   (DATA_PROTECTION.md §8 processor management).
7. Verify [VERIFY CURRENT PRICING] figures in D10.
8. Decide whether Supabase Pro tier is active today (affects third-party MAU
   quota baseline).

## 20. Final Implementation Gate

Verdict recorded centrally in `WORKOS_AUTHKIT_IMPLEMENTATION_GATE.md`.
*Superseded 2026-08-23: all decisions closed (D6 default-domain election;
D10 pricing verified); gate reads IMPLEMENTATION READY. Prerequisites that
remain are operational scheduling items G-OPS-1/G-OPS-2.*

---

# ADDENDUM — Phase 0C Closure (2026-08-23)

Owner directives received in Phase 0C close D1–D5 and D7–D10 at the decision
level. Authoritative dispositions, evidence, verification methods, and
remaining conditions now live in:

- `WORKOS_AUTHKIT_PHASE_0C_CLOSURE_REPORT.md` (closure report; includes the
  binding credential-handling procedure, C1–C4 proof obligations,
  account-preservation plan, RLS fail-closed matrix, verified budget basis)
- `WORKOS_AUTHKIT_IMPLEMENTATION_GATE.md` (CLOSED/OWNER ACTION REQUIRED
  matrix + final IMPLEMENTATION STATUS)

Delta vs the body above:
- **D1** CLOSED (method ratified by owner; procedure CR §3).
- **D2** CLOSED (C1–C4 restated as binding proof obligations, CR §4).
- **D3** CLOSED (prohibited set verbatim from owner; privilege computation
  specified against live role inventory).
- **D4** CLOSED (Email+Password + Google only; others prohibited absent
  re-approval).
- **D5** CLOSED at 45 days / ≤14-day fallback with T0-relative schedule and
  ten objective exit criteria (CR §6).
- **D6** CLOSED (2026-08-23, owner directive): default WorkOS AuthKit-hosted
  authentication URL for initial deployment; custom CAPFLUX domain
  intentionally deferred and NOT an implementation blocker; issuer/domain must
  remain environment-config-driven (`AUTH_ISSUER`, `AUTH_REDIRECT_URI`,
  `WORKOS_CLIENT_ID`, `WORKOS_API_KEY`, `WORKOS_ENVIRONMENT` + optional future
  `WORKOS_CUSTOM_AUTH_DOMAIN` override) so the default→custom transition never
  touches user UUIDs, identity links, roles, memberships, permissions,
  financial records, RLS, payments, settlements, ledger, or audit history.
  No WorkOS hostname may be hard-coded in source (review grep-gate).
- **D7** CLOSED (authority model: Security Lead + dual control +
  ESCALATED_OWNER state; named roster is operational prerequisite G-OPS-1).
- **D8** CLOSED (lifecycle FREEZE→DUAL AUTH→CUTOVER→ARCHIVE→RETIRE;
  applied migrations immutable).
- **D9** CLOSED as approved requirements; implementation deferred per owner.
- **D10** CLOSED on officially verified pricing (workos.com/pricing fetched
  2026-08-23): AuthKit first 1M MAU free ⇒ $0/mo baseline through ≥1,000
  schools; custom domain optional $99/mo (rides on D6); staging free.

Standing verdict updated 2026-08-23 after D6 closure: **IMPLEMENTATION READY**
(see gate file; phases still pass their own acceptance gates).


