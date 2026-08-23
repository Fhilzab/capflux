# CAPFLUX Compliance Audit Procedures

How future audits (human or AI) must be performed. Frequency: full audit at least per major release and before production launch; targeted audits on compliance-sensitive changes.

## 1. Repository scan
`git grep` secret patterns; verify `.env*` hygiene; run `npm run compliance:audit` (scripts in backend/scripts/compliance/) and archive its JSON output with the audit record. Confirm no `any`/ts-ignore crept into security files.

## 2. Schema inspection
Diff `supabase/migrations/` against last audit tag. For every new table: RLS enabled? policy correct? sensitive columns encrypted/masked? unique idempotency indexes present for financial writers? Update DATA_INVENTORY.md + database.types regeneration check (`npm run db:types` drift note).

## 3. RLS inspection
Re-run control TENANT-001/002 manually: list tables lacking RLS; verify rls_hardening.sql still applied; confirm ledger has no UPDATE/DELETE policies; confirm audit_logs remains client-read-only.

## 4. Route inspection
Enumerate routes (check-auth script output); every route must map to an auth middleware; school scope derived server-side; diff against SECURITY_CONTROL_MATRIX exceptions register (TENANT-003 known staff-surface exceptions).

## 5. Authentication audit
AUTH-001..012 checks incl. enumeration message parity, rate-limit posture, session revocation story, invitation acceptance binding (TENANT-005 fix status).

## 6. Payment & webhook audit
Walk webhook.ts pipeline line-by-line against WEBHOOK-001..010; confirm signature fail-closed; confirm provider allowlist; confirm amount/currency comparison remediation status (COMP-008); re-run webhook-hardening, payment-lifecycle, gateway suites.

## 7. Financial integrity audit
Verify the four-layer idempotency indexes still exist; RPC unchanged or protocol-compliant; balances still computed-not-stored; reversal path intact. Any drift = P0 incident.

## 8. Secret scan
check-secrets output + manual review of docs/ for quoted credentials (the COMP-001 class of finding).

## 9. Dependency audit
`npm audit`/`npm outdated` both projects; record unpatched advisories with risk calls; no auto-upgrades inside audit without tests.

## 10. Vendor audit
Refresh VENDOR_PROCESSOR_REGISTER.md statuses; attach any new DPAs; re-verify hosting regions; subprocessor chain changes.

## 11. Data-flow review
Confirm DATA_FLOW_REGISTER.md reflects reality; hunt for NEW direct Supabase domain queries from frontend; verify offline sync still assigns UUIDs pre-sync.

## 12. Documentation review
PROJECT_STATUS vs reality; stale architecture claims flagged (environment.md WorkOS caution stands).

## 13. Automated tests + manual review
Targeted suites per area (see AGENTS.md commands). Manual: one cross-tenant probe attempt per endpoint class in staging; signed-URL expiry test; upload validation probes (bad MIME, oversized).

## 14. Legal escalation
Collect every row marked REQUIRES_LEGAL_REVIEW into a single counsel brief; track answers back into the matrix with dated decision-log entries.

## 15. Output
Update compliance-status.json (version++, lastAudit), REGULATORY_MATRIX statuses, COMPLIANCE_REMEDIATION_BACKLOG, and produce PHASE_N_AUDIT_REPORT entry summarising deltas.
