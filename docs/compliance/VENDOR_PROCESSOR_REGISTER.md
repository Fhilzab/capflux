# CAPFLUX Vendor / Processor Register

**Audit date:** 2026-08-23.
**Integrity rule:** no DPA is claimed unless verified. All contract statuses below are UNVERIFIED until someone attaches the executed agreement to the compliance records.

| VENDOR | SERVICE | DATA PROCESSED | ROLE | LOCATION | DPA AVAILABLE? | CROSS-BORDER? | SECURITY DOCS? | RETENTION | DELETION | INCIDENT PROCESS | STATUS |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Supabase (hosted Postgres/Auth/Realtime/Storage/Edge) | Primary datastore + auth + one edge function | ALL domain data: users, students, guardians, payments, ledger, KYC encrypted fields, audit logs, notifications | Processor (sub-processor: AWS) | EU-West-Ireland per environment.md:7–13 (**re-verify live region**) | UNVERIFIED | YES — EU hosting of Nigerian subjects' data | Public trust/security docs exist (link in onboarding) — UNVERIFIED contractually | Provider-managed backups per plan; contractual retention UNVERIFIED | UNVERIFIED | Shared-responsibility model UNVERIFIED | REQUIRES_OPERATIONAL_REVIEW |
| Render (target host) | Express API compute | In-flight personal/financial data; ephemeral logs | Processor | Region UNCONFIGURED/UNVERIFIED | UNVERIFIED | Likely (region TBD) | Public docs exist | ephemeral | redeploy clears | provider status page | REQUIRES_OPERATIONAL_REVIEW |
| Vercel/Netlify (target CDN) | SPA static hosting | None at rest beyond build assets; browser-side app code | Processor | Global edge | UNVERIFIED | Edge distribution | Public docs | n/a | n/a | status page | REQUIRES_OPERATIONAL_REVIEW |
| Monnify | Payment gateway + DVA + settlement rails (sandbox today) | Transaction refs, amounts, DVA numbers, settlement account details of schools | Independent controller/processor per its terms — classification UNVERIFIED | Nigeria | UNVERIFIED | Nigeria-centric | Public docs exist | provider terms | provider terms | provider support | CODE_VERIFIED technically / contracts UNVERIFIED |
| Paystack | Alternate payment gateway (sandbox today) | same as Monnify | same caveat | Nigeria | UNVERIFIED | Nigeria-centric | Public docs exist | provider terms | provider terms | provider support | CODE_VERIFIED / contracts UNVERIFIED |
| Termii | SMS/WhatsApp (edge function exists; integration DEFERRED — not live) | Guardian phone numbers, message content incl. student name + amount | Processor (planned) | Nigeria | UNVERIFIED | none until live | public docs | n/a until live | n/a | n/a | PLANNED — do not list as active processor until enabled |
| Fincra | Designated identity/settlement verification — **PENDING_PROVIDER**, zero credentials/integration | Would receive BVN/NIN identifiers + account enquiries when live | Processor (future) | TBD | UNVERIFIED | TBD | capability-matrix forbids inventing fields | n/a now | n/a | n/a | NOT ACTIVE — gate any integration behind DPA execution (NDPC-DP-010) |
| WorkOS | Legacy auth only (rollback path) | Historical user directory/session cookies for legacy accounts | Processor (legacy) | US | UNVERIFIED | YES historically | public docs | legacy accounts only | via claim/purge scripts | n/a | LEGACY — do not build new auth here |
| Email transport (`EMAIL_API_*`) | Auth/notification email | Email addresses, message bodies | UNVERIFIED vendor identity (env-defined) | UNVERIFIED | UNVERIFIED | UNKNOWN | – | – | – | – | UNKNOWN — identify actual provider before production |
| Sentry/LogRocket/Datadog/UptimeRobot/PagerDuty/Slack | Optional monitoring per production checklist | Error telemetry could include PII if misconfigured | Processors (optional) | various | UNVERIFIED | likely | public docs | tool defaults | tool config | tool native | OPTIONAL — none confirmed active; scrub PII before enabling |

## Mandatory actions before production

1. Execute/retrieve DPA with Supabase and record sub-processor chain (COMP-012).
2. Confirm live Supabase region; document transfer mechanism decision (COMP-013).
3. Written role classification for PSPs (controller vs processor vs independent controller) — legal review.
4. No new vendor onboarded without a register row + DPA check (enforced via AI_AGENT_COMPLIANCE_RULES.md gate).
