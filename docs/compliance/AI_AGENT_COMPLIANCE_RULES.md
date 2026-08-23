# AI Agent Compliance Rules (MANDATORY)

Applies to every AI coding agent and developer working in CAPFLUX. The AGENTS.md compliance gate points here.

## 1. Compliance gate — run before ANY change

1. **Classify the change.** Does it touch: payment/ledger/settlement/reconciliation/webhook code, auth middleware, RLS/migrations, tenant-scoped routes, KYC/PII handling, storage, logging, pricing/consumer copy, vendor integrations? If yes → compliance-sensitive.
2. **Read controls.** Open `docs/compliance/CAPFLUX_COMPLIANCE_MASTER.md` → find affected control IDs → read their documents.
3. **Inspect existing protections** before editing (middleware chain, RLS policy, unique index, signature check).
4. **Preserve financial integrity** (kobo integers, idempotency, ledger semantics, state machine, webhook verification, tenant isolation).
5. **Never weaken**: authentication, authorization, RLS, signature verification, audit logging, security tests.
6. **Regression tests** for any security-critical change; never weaken tests to pass.
7. **Run**: `npm run compliance:audit`, `npm run typecheck` (+ `typecheck:tests`), targeted tests, `npm run build`.
8. **Report** in PR/change notes: affected control IDs, unresolved risks, legal-escalation items.

## 2. Prohibited shortcuts

- No `any`, no `@ts-ignore`, no `@ts-expect-error`, no tsconfig strictness reduction.
- No `CREATE TABLE IF NOT EXISTS` papering over schema conflicts; additive migrations only; never edit applied migrations.
- No new direct frontend→Supabase domain-data queries (existing ones are a tracked violation — do not add to the pile).
- No secrets in code/docs/tests/logs/status JSON.
- No client-trusted identity (`x-user-id`, body school/user IDs).
- No float money math anywhere.
- No "Free" marketing language for a levy-funded product (CONSUMER-001 rule).
- Never mark a compliance control PASS without code evidence you can cite.

## 3. Status honesty

Use exactly: `PASS | PARTIAL | FAIL | NOT_IMPLEMENTED | NOT_APPLICABLE | REQUIRES_LEGAL_REVIEW | REQUIRES_OPERATIONAL_REVIEW | UNKNOWN`. `REQUIRES LEGAL REVIEW` is always preferable to an unsupported `PASS`. `CONTROL NOT IMPLEMENTED` is always preferable to hiding a gap.

## 4. Escalation

Uncertainty about regulation ⇒ stop, document in the relevant doc + COMPLIANCE_REMEDiation_BACKLOG with `REQUIRES_LEGAL_REVIEW`, and surface it in the change report. Do not guess statutes, deadlines, or regulator names.

## 5. Financial-core change protocol (Rule 4)

Any modification touching PaymentService/LedgerService/Settlement/Reconciliation/gateways/webhook routes/RPCs requires: explicit justification, kobo arithmetic preserved, idempotency preserved, ledger semantics preserved, state transitions preserved, webhook verification preserved, tenant isolation preserved, regression tests, separate report entry.
