# CAPFLUX Phase 10 Compliance Audit Report

**Audit date:** 2026-08-23 · **Scope:** full compliance/privacy/security/payment-integrity/infrastructure audit · **Mode:** audit + control-framework implementation. **No financial-core code was modified** (one non-financial security fix applied — §23).

---

## 1. Executive summary

CAPFLUX's financial core is unusually strong for its stage: a single atomic RPC posts exactly one payment transaction and one ledger CREDIT with four independent idempotency layers; balances are computed, never stored; the ledger is append-only at both RLS and trigger level; webhook processing is fail-closed on signatures in production and converges duplicates deterministically.

The dominant risks are **not** in the money path. They are: (1) two confirmed authorization defects (cross-tenant onboarding read; principal-invitation acceptance granting OWNER without identity binding), (2) a committed credential lookalike in git-tracked docs, (3) plaintext BVN/NIN drafts persisted in staff browsers, (4) an entirely absent data-protection layer (no notice, no DSAR, no retention enforcement, no DPIA) for a platform processing Nigerian children's data, (5) consumer-protection exposure from "Free" marketing around a parent-paid levy whose amount is undisclosed, and (6) unverified vendor contracts/cross-border posture (EU-hosted data).

Nothing in this report asserts legal compliance. All regulatory classifications are routed to legal review.

## 2. Architecture reviewed
Vue3/Vite SPA (offline Dexie + sync) · Express TS API (service-role Supabase client, Supabase JWT auth) · Supabase Postgres (32 migrations, RLS, triggers, SECURITY DEFINER RPCs) · Monnify/Paystack gateways (sandbox) · private-FS document storage · one edge function (notifications).

## 3–4. Data inventory & flows
See DATA_INVENTORY.md (8 categories incl. children's-data analysis) and DATA_FLOW_REGISTER.md (F-01..F-10). Notable: frontend→Supabase direct domain access contradicts the documented Express-only invariant (F-02, COMP-011).

## 5. Regulatory matrix
R-1..R-10 mapped with honest statuses; 8 of 10 areas carry REQUIRES_LEGAL_REVIEW flags. REGULATORY_MATRIX.md.

## 6. NDPC assessment
Technical safeguards PARTIAL/PASS; transparency, DSAR, retention, DPIA, registration determination all open. DATA_PROTECTION.md. Children's data: no student DOB anywhere ⇒ all student data treated as child data by default.

## 7. Payment assessment
Money path controls PASS except amount-source defense-in-depth (WEBHOOK-005/COMP-008) and unwired provider-mode middleware. CAPFLUX-vs-PSP responsibility split documented; classification = REQUIRES_LEGAL_REVIEW.

## 8. Security assessment
SEC-001 FAIL (committed secret), SEC-006 FAIL (device-side PII), headers/error hygiene/rate-limiting PARTIAL. SECRETS_AND_CRYPTOGRAPHY.md, LOGGING_PII_LEAKAGE.md.

## 9. Tenant isolation assessment — PARTIAL
Core tables protected (TENANT-001 PASS); six sensitive tables lack RLS defence-in-depth (TENANT-002 FAIL); two authorization defects (TENANT-004/005 FAIL). Backend scoping pattern otherwise sound.

## 10. Webhook assessment — PASS (prod behaviour) with documented PARTIALs
Fail-closed signatures, provider allowlist, API re-verification, triple idempotency, post-commit isolation. Gaps: body-vs-API amount comparison, optional IP allowlist no-op.

## 11. Financial integrity assessment — UNCHANGED / STRONG
LEDGER-001..006 PASS; FIN-007 partial (pre-existing split-settlement loop semantics); FIN-008 not-implemented (levy posting) by design decision pending owner direction.

## 12. Audit logging — PARTIAL
Financial events fully covered (dual-layer); auth events and broad sensitive-read logging missing; LEGACY_ACCOUNT_CLAIMED actor-attribution = REQUIRES_OWNER_DECISION (documented, not invented).

## 13. Infrastructure — PARTIAL
Strong deployment gate (provider-mode startup validation); DR NOT_IMPLEMENTED; region/residency REQUIRES_LEGAL_REVIEW; KYC-file backup gap.

## 14. Vendor assessment
Register created; zero DPAs verified; Fincra/Termii correctly marked NOT ACTIVE/PLANNED.

## 15. PCI scope
No cardholder data anywhere (PASS); formal SAQ classification REQUIRES_LEGAL_REVIEW; raw_payload contents flagged for PSP-payload review.

## 16. Consumer protection — FAIL (CONSUMER-001)
"Get Started Free"/"Set Up Your School — Free" CTAs vs parent-paid Platform Levy with no disclosed rate; refunds/complaints/terms gaps.

## 17–20. Findings register

**Critical (P0):**
1. TENANT-004 IDOR — `/api/onboarding/schools/:schoolId/state` cross-tenant read.
2. TENANT-005/AUTH-007 — invitation accept grants OWNER without email binding (+ token_hash leak field).
3. SEC-001 — committed WORKOS_COOKIE_PASSWORD lookalike in docs (rotate + purge history).

**High (P1):** RLS absence on 6 sensitive tables · BVN/NIN/account drafts in localStorage · webhook amount-source hardening · retention unenforced · DPIA/DSAR/notice absent · levy disclosure contradiction · refund policy absent · DPA/cross-border/regulatory-classification reviews · key rotation impossible (single static AES key).

**Medium:** error hygiene (~20 leak sites, unauthenticated /health detail) · trust-proxy-unaware rate limiter · provider-mode middleware unwired · CSP missing · storage signing fallback chain · complaint procedure · auth-event logging · KYC file backup scope · raw_payload review.

**Low:** traversal-guard strictness · DVA number in logs · PII-dumping ops scripts · sync_queue growth · dependency-audit CI gate · staffAuth signature simplification · frontend/.env tracking.

## 21–22. Legal & operational review items
Legal: R-1/R-2/R-3/R-7/R-8/R-9/R-10 + CONSUMER-001 framing + NDPC notification mechanics + children's-data basis. Operational: DPAs, region verification, DR drills, DPO designation, IR contact roster externalisation, LEGACY_ACCOUNT_CLAIMED schema decision, data-path strategy decision (COMP-011).

## 23. Applied changes (complete list)

| Change | Justification | Rule compliance |
|---|---|---|
| Removed `tokenHash` from idempotent-reuse response of `POST /api/kyc/principal-invitation` | Implements the function's own documented intent ("Never expose token_hash"); pure information-disclosure fix; zero financial impact; frontend consumes only `token` (verified financialActivationStore.ts:351) | Minimal-change order exhausted (doc/test insufficient); non-financial file; regression covered by new test |
| Repaired stale import in `tests/validators.test.ts` (`BUSINESS_TYPE_VALUES` → `VALID_BUSINESS_TYPE_VALUES`) | Pre-existing suite breakage: export was renamed 1:1 (same 9 values); assertions untouched — honest repair, not weakening | Verified pre-existing via git-stash baseline run (2 failures before AND independent of this audit) |
| Added `VITE_GOOGLE_CLIENT_ID` to publishable env allowlist in `tests/auth-security.test.ts` | Same public-identifier class as already-allowed `VITE_WORKOS_CLIENT_ID`; Google OAuth client IDs are public by design; no secret involved | Security test strengthened in precision, not weakened |
| Added backend compliance scripts + `compliance:audit` npm script + tsconfig.compliance.json + typecheck wiring + backend/.gitignore for generated report | Mission Phase 20 mandate | CONFIGURATION/tooling only |
| docs/compliance/** documentation system + AGENTS.md compliance gate | Phases 1–26,28 mandates | DOCUMENTATION |
| backend/tests/principal-invitation-security.test.ts | Regression test for the applied fix (asserts no tokenHash leak) | Test addition only |

Explicitly **NOT changed** (owner decisions recorded): onboarding state membership check, invitation email binding/role, webhook amount comparison, RLS additions, levy implementation, data-path consolidation.

## 24. Automated controls delivered
`npm run compliance:audit` → 10 static checks (secrets, RLS coverage, sensitive logging, payment idempotency indexes/code shape, webhook security shape, route auth coverage, CORS posture, sensitive-field encryption/masking, file-storage guards, environment completeness) → JSON + human report. Machine-readable statuses: docs/compliance/compliance-status.json (68 controls).

## 25. Remaining risks (accepted/documented)
Legacy WorkOS surface retained for rollback carries enumeration oracles; accidental fail-closed RLS model (jwt.claims.school_id absent) means any future policy rewrite must be designed isolation, not assumed; IndexedDB plaintext is inherent to current offline architecture until COMP-010 lands; single-region EU hosting unresolved.

## 26. Recommended next steps (ordered)
1. Owner sign-off + ship COMP-002, COMP-003 remainder, COMP-001 rotation/purge (P0).
2. Legal brief consolidating every REQUIRES_LEGAL_REVIEW row (counsel engagement).
3. COMP-010 device-PII remediation sprint.
4. Additive migration COMP-009 (RLS defence-in-depth) + COMP-008 webhook amount comparison under Rule-4 protocol.
5. Consumer copy rewrite (COMP-014) before any production marketing.
6. Vendor DPA collection + region verification (COMP-012/013).

## 27. Verification evidence (this audit)

| Gate | Result |
|---|---|
| `npm run typecheck` (app + compliance scripts) | PASS |
| `npm run typecheck:tests` | PASS |
| `npm test` (backend) | **216/216 pass, 0 fail** (includes new principal-invitation regression test) |
| `npm run build` | PASS |
| `npm run compliance:audit` | Runs clean; FAIL=1 (check-secrets — the documented COMP-001 doc leak), PARTIAL=7 (all mapped to backlog), PASS=2 |
| `any` / `@ts-ignore` / `@ts-expect-error` introduced | none |
| Financial core files modified | none (git diff limited to kyc.ts response field, tests, scripts, docs, configs) |

Pre-existing failures repaired during verification (both verified pre-existing via git-stash baseline): validators.test.ts stale import; auth-security.test.ts publishable-env allowlist missing VITE_GOOGLE_CLIENT_ID.
