# CAPFLUX Infrastructure Audit

**Audit date:** 2026-08-23. Target architecture per docs: Frontend Vercel/Netlify · Backend Render · Database Supabase · Payments licensed PSP. Provider terms/regions are documented **only where verifiable**; everything else is flagged.

| ID | Area | Finding | Status |
|---|---|---|---|
| INFRA-001 | Data region / residency | Supabase project documented as EU-West-Ireland (environment.md:7–13) — predates auth migration, must be re-verified live. Render/Vercel regions unconfigured in repo (no render.yaml/vercel.json found). Nigerian-residency obligation undetermined ⇒ legal review. | REQUIRES_LEGAL_REVIEW |
| INFRA-002 | Encryption in transit | TLS assumed at all providers; HSTS enabled production-only in backend headers; no certificate pinning needs identified | PASS (assumption documented; verify at deploy) |
| INFRA-003 | Encryption at rest | Supabase-managed disk encryption — contractual verification outstanding; app-layer AES-GCM for BVN/NIN independent of provider; storage dir encryption undefined | PARTIAL |
| INFRA-004 | Secrets management | All secrets via env; boot-fail on missing criticals; no secret-manager integration; committed-secret incident tracked (COMP-001); no CI/CD secret scanning configured | PARTIAL |
| INFRA-005 | Backups | Supabase managed backups + `backend/scripts/backup.sh` (daily 02:00 cron pattern in checklist; optional S3+Slack). Storage dir (KYC files) NOT covered by any documented backup (**gap** COMP-035). Restore drills: none evidenced | PARTIAL |
| INFRA-006 | Disaster recovery | RTO/RPO targets exist only as prose targets in legacy backup doc; DR marked NOT IMPLEMENTED by PROJECT_STATUS.md:1117–1123; no runbook executed | NOT_IMPLEMENTED |
| INFRA-007 | Access control / admin access | No IaC; dashboard access procedures undocumented; MFA absent platform-wide (AUTH-008) | PARTIAL |
| INFRA-008 | Logging & monitoring | `/health` exists but leaks DB error text unauthenticated (SEC-004); uptime monitoring recommended-not-configured; no centralised log sink; audit_logs are the only durable security trail | PARTIAL |
| INFRA-009 | Vendor security & DPAs | See VENDOR_PROCESSOR_REGISTER.md — zero verified | REQUIRES_OPERATIONAL_REVIEW |
| INFRA-010 | Cross-border transfers | EU hosting of Nigerian subjects' data — mechanism undetermined | REQUIRES_LEGAL_REVIEW |
| INFRA-011 | Rate limiting/proxy posture | In-memory limiter; `trust proxy` unset ⇒ behind Render proxy req.ip collapses clients; horizontal scale unsafe | PARTIAL (COMP-016) |
| INFRA-012 | Deployment gates | PAYMENTS_PROVIDER_MODE startup validation incl. production requirements (no TestGateway, creds present) — strong gate; requireProviderReady middleware unwired to routes | PARTIAL (COMP-017) |

## Priority infrastructure actions

1. Pin + document hosting regions; decide residency posture with counsel (P0 decision, P1 execution).
2. Centralised logging with PII scrubbing + alerting on webhook failure rates and reconciliation issue growth.
3. Secret scanning in CI + rotation schedule ownership (ties SEC-001).
4. Backup coverage extension to CAPFLUX_STORAGE_DIR + first restore drill (documented evidence).
