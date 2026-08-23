# CAPFLUX Data Retention Policy

**Audit date:** 2026-08-23.
**Rule honoured:** no retention period is invented. Where a defensible period depends on Nigerian law (tax/company/education records), NDPA guidance, or contracts, the row is **REQUIRES_LEGAL_REVIEW**.

## Current implementation state

- Schema contains **no retention windows, TTLs, archival jobs, or purge schedules** (verified across all 32 migrations; no pg_cron).
- Deletion semantics are FK-driven: tenant cascade for identity/org rows; `RESTRICT` protects financial rows (`ledger_entries.student_id`, `payment_transactions.student_id`); auth-user deletion removes only identity rows (0027:490–495) — financial history intentionally survives user deletion.
- Ledger is append-only by design ⇒ "deletion" of financial history is architecturally excluded; corrections are reversing entries.

## Register

| DATA TYPE | PURPOSE | RETENTION REQUIREMENT | CURRENT IMPLEMENTATION | DELETION METHOD | LEGAL/FINANCIAL HOLD | STATUS |
|---|---|---|---|---|---|---|
| Student identity + academic records | Billing/collections core | Education-records period — REQUIRES_LEGAL_REVIEW | kept indefinitely | none automated | school-initiated archive flag exists (academic session ARCHIVED only) | REQUIRES_LEGAL_REVIEW |
| Guardian contact data | Payment comms, receipts | tied to student relationship + limitation periods — REQUIRES_LEGAL_REVIEW | kept indefinitely | none | – | REQUIRES_LEGAL_REVIEW |
| payment_transactions + raw_payload | Financial evidence / disputes / reconciliation | statutory books-and-records period — REQUIRES_LEGAL_REVIEW | append-only, indefinite; raw_payload unbounded | none (append-only) | de-facto permanent hold | PARTIAL (integrity good; payload minimisation absent) |
| ledger_entries | Balance computation + audit | same as above; architecture forbids deletion | append-only, indefinite | reversing entries only | permanent | PASS-by-design (integrity), REQUIRES_LEGAL_REVIEW (DP tension) |
| settlement_accounts / KYC encrypted identifiers | Payment activation + re-verification | post-relationship deletion expectations under NDPA vs AML-type retention — REQUIRES_LEGAL_REVIEW | kept indefinitely; encrypted at rest | none | activation status depends on them | REQUIRES_LEGAL_REVIEW |
| KYC document files | Verification evidence | REQUIRES_LEGAL_REVIEW | kept on private FS indefinitely | manual only | verification status references path | REQUIRES_OPERATIONAL_REVIEW |
| audit_logs | Accountability | docs/security/compliance.md proposes 2yr archive (design-only) | indefinite | none | incident holds per INCIDENT_RESPONSE.md | NOT_IMPLEMENTED (policy prose only) |
| notifications (+ phone, message content) | Receipt/comms evidence | short operational life likely sufficient — REQUIRES_LEGAL_REVIEW | indefinite | none | – | NOT_IMPLEMENTED |
| legacy_identity_migrations | One-time migration bookkeeping | candidate for early purge once migration closed-out | indefinite | none | migration completion state | REQUIRES_OWNER_DECISION |
| principal_invitations | Access provisioning | expire 7d; accepted/expired rows retained | expires_at enforced functionally | none automated | – | PARTIAL |
| sync_queue (server) | Offline reconciliation | transient by nature | rows accumulate | none automated | – | COMP-039 (P3 cleanup job) |

## Enforcement roadmap (no dates invented)

1. Legal review fixes each period above → documented decision log entry.
2. Additive migration + scheduled job (pg_cron or backend cron via Render scheduler) implementing: anonymise-over-retention for subject data, archive-then-purge for logs/notifications, payload trimming for raw_payload after dispute window.
3. Ledger/transactions are never purged within statutory window; DP erasure requests satisfied via anonymisation pattern pending legal validation (DATA_PROTECTION.md §4).
