# CAPFLUX COMPLIANCE MASTER DOCUMENT

**Product:** CAPFLUX — Africa's School Fee Collection Platform
**Company:** FHILZAB NIG LTD · **Jurisdiction:** Nigeria
**Primary readers:** every developer and AI agent before touching compliance-sensitive code.

---

## 1. What CAPFLUX is (architecture in one page)

- **Frontend**: Vue 3 + Vite + Pinia SPA (offline-first via Dexie/IndexedDB; sync queue reconciles online).
- **Backend**: Express + TypeScript on Render, service-role Supabase client, Supabase Auth JWT validation (`requireAuthSupabase`), hand-rolled rate limiting/security headers.
- **Database**: Postgres/Supabase with RLS tenant isolation; append-only `ledger_entries`; balances computed never stored; authoritative timestamps from PostgreSQL.
- **Payments**: licensed PSPs (Monnify/Paystack) issue per-student DVAs; money never touches CAPFLUX servers; webhook → HMAC verify → API re-verify → atomic `record_verified_payment` RPC → one CREDIT ledger entry; settlement to server-verified school accounts.
- **KYC**: BVN/NIN encrypted AES-256-GCM at rest, last4 working copies, documents on private filesystem with signed access. Identity provider designated but not integrated.
- Full detail: docs/architecture/ + DATA_FLOW_REGISTER.md.

## 2. Compliance philosophy

1. **Honesty over optics.** An unsupported PASS is a defect. REQUIRES_LEGAL_REVIEW is a valid terminal state for engineering.
2. **Technical ≠ operational ≠ legal.**
   - *TECHNICAL CONTROL*: the code implements it (evidence: file:line + test).
   - *OPERATIONAL CONTROL*: the organisation runs it (evidence: process, drill record, owner).
   - *LEGAL STATUS*: only qualified Nigerian counsel/compliance officer may assert it. Engineers never do.
3. **Minimal change order**: DOCUMENTATION → AUTOMATED TEST → STATIC AUDIT → CONFIGURATION → SMALL CODE FIX.
4. **Financial Core Freeze** (see AI_AGENT_COMPLIANCE_RULES.md §5) — payment/ledger/settlement/webhook logic changes require the full nine-point protocol.

## 3. Document index

| Document | Purpose |
|---|---|
| DATA_INVENTORY.md | Every data category, table, protection |
| DATA_FLOW_REGISTER.md | How data & money move (F-01..F-10) |
| REGULATORY_MATRIX.md | NDPA/GAID/CBN/FCCPC/PCI/cross-border mapping (R-1..R-10) |
| DATA_PROTECTION.md | NDPC-oriented audit incl. children's data |
| PAYMENT_COMPLIANCE.md | Money path controls + CAPFLUX-vs-provider split |
| SECURITY_CONTROL_MATRIX.md | TENANT-*/SEC-* controls |
| AUTH_AUDIT.md | AUTH-* controls |
| WEBHOOK_SECURITY.md | WEBHOOK-* controls |
| FINANCIAL_INTEGRITY_AUDIT.md | LEDGER-*/FIN-* controls |
| AUDIT_LOGGING.md | AUDIT-* controls + LEGACY_ACCOUNT_CLAIMED decision |
| SECRETS_AND_CRYPTOGRAPHY.md | SEC-001/002 + key inventory |
| FILE_STORAGE_SECURITY.md | FILE-* controls |
| LOGGING_PII_LEAKAGE.md | L-* findings + localStorage exposure |
| DATA_RETENTION_POLICY.md | Retention register (no invented periods) |
| INCIDENT_RESPONSE.md | IR lifecycle baseline |
| VENDOR_PROCESSOR_REGISTER.md | Processors/subprocessors (no unverified DPA claims) |
| PCI_DSS_SCOPE.md | Cardholder-data scope determination |
| INFRASTRUCTURE_AUDIT.md | INFRA-* controls |
| CONSUMER_PROTECTION.md | CONSUMER-* controls incl. levy disclosure |
| AUDIT_PROCEDURES.md | How to re-audit |
| COMPLIANCE_REMEDIATION_BACKLOG.md | COMP-NNN backlog |
| compliance-status.json | Machine-readable control statuses |

## 4. Control ID namespaces

`NDPC-DP-…` data protection · `PAY-…` payments · `TENANT-…` isolation · `AUTH-…` identity/access · `WEBHOOK-…` · `LEDGER-…`/`FIN-…` financial integrity · `AUDIT-…` logging · `SEC-…` general security · `FILE-…` storage · `PCI-…` · `INFRA-…` · `CONSUMER-…` · `VENDOR-…` · `COMP-…` remediation backlog items.

## 5. Status vocabulary (the ONLY allowed values)

`PASS · PARTIAL · FAIL · NOT_IMPLEMENTED · NOT_APPLICABLE · REQUIRES_LEGAL_REVIEW · REQUIRES_OPERATIONAL_REVIEW · UNKNOWN`
"COMPLIANT" is **never** a technical status.

## 6. Escalation rules

- Regulation unclear ⇒ mark REQUIRES_LEGAL_REVIEW + add backlog item; never guess.
- Financial anomaly suspected ⇒ freeze related work, reproduce in staging, report as P0.
- Security gap discovered ⇒ document + backlog with priority; fix only within minimal-change discipline and Rule 4 protocol where financial code is involved.
- Owner decisions required (e.g., LEGACY_ACCOUNT_CLAIMED schema) ⇒ recorded in relevant doc with `REQUIRES_OWNER_DECISION`.

## 7. The AI gate (summary)

Before any change: classify → read controls → inspect protections → preserve integrity/isolation → no weakening → tests → run `npm run compliance:audit` + typecheck + targeted tests + build → report affected control IDs and unresolved risks. Full text: AI_AGENT_COMPLIANCE_RULES.md (mirrored into AGENTS.md).
