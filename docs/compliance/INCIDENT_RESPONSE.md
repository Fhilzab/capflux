# CAPFLUX Incident Response Plan (technical baseline)

**Audit date:** 2026-08-23. Supersedes operational gaps noted in docs/security/incident_response.md (which remains the detailed playbook source). Statutory notification timelines are **deliberately not asserted** — the NDPA/GAID notification mechanics and deadlines must be confirmed by legal review against the authoritative NDPC sources before any deadline is committed to procedure.

## Scope triggers

Security breach · personal-data breach · payment compromise · webhook compromise · credential leak · unauthorized access · database exposure · third-party provider incident.

## Lifecycle

| Phase | Actions (CAPFLUX-specific) |
|---|---|
| DETECTION | `/health` uptime monitor; audit_logs anomalies; provider webhook failure spikes; reconciliation_issues backlog; client error feed `/api/log-error`; vendor security bulletins |
| CONTAINMENT | Rotate suspect keys (`KYC_ENCRYPTION_KEY`, provider keys, storage signing secret) via env redeploy; disable provider mode (`PAYMENTS_PROVIDER_MODE=disabled` startup-validated); suspend affected school memberships (`is_active=false`); revoke sessions (Supabase admin API); block webhook IPs allowlist; snapshot evidence read-only |
| INVESTIGATION | Preserve: DB snapshot, audit_logs export, storage dir image with SHA-256 manifest (forensic script pattern in legacy IR doc); reconstruct money movement strictly from `payment_transactions` + `ledger_entries` + reconciliation tables (never from memory/logs) |
| NOTIFICATION | Internal escalation first; personal-data breach → NDPC notification per NDPA mechanism (**exact form/deadline: REQUIRES_LEGAL_REVIEW**); affected schools/parents comms templates; PSP/bank counterpart notification for payment incidents; ngCERT referral where counsel advises |
| RECOVERY | Restore from Supabase PITR per backup strategy; re-enable provider mode after credential rotation + webhook secret rotation on provider dashboards AND env; forced re-onboarding of any compromised KYC record; ledger corrections ONLY as reversing entries |
| POST-INCIDENT REVIEW | Blameless doc within 5 business days; update this plan + threat model; verify control IDs affected are re-tested (`npm run compliance:audit` + targeted suites) |

## Severity model (operational targets inherited from legacy IR doc)

S1 critical (payment fraud, ledger tampering suspicion, mass data exposure) — respond immediately; S2 major (single-tenant isolation breach, outage) ; S3 minor. These are internal SLAs, **not** statutory clocks.

## Roles

Incident Lead (engineering on-call) → Decision Authority (FHILZAB NIG LTD management) → Legal/compliance advisor (external until DPO designated) → Comms lead. Contact roster must live outside git (COMP-040).

## Control hooks this plan relies on

- Payments kill-switch: PAYMENTS_PROVIDER_MODE=disabled (validated at boot).
- Ledger immutability guarantees reversal-only correction.
- KYC re-verification path exists (resubmit flow).
- Audit trail completeness: AUDIT_LOGGING.md.
