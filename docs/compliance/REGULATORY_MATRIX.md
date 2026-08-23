# CAPFLUX Regulatory Matrix

**Audit date:** 2026-08-23
**Rule applied:** no requirement is asserted unless traceable to an authoritative source or clearly scoped as REQUIRES_LEGAL_REVIEW. Nothing here is a legal conclusion; every row's "LEGAL REVIEW REQUIRED?" column is binding.

Allowed statuses: `PASS | PARTIAL | FAIL | NOT_IMPLEMENTED | NOT_APPLICABLE | REQUIRES_LEGAL_REVIEW | REQUIRES_OPERATIONAL_REVIEW | UNKNOWN`.

---

## R-1 Nigeria Data Protection Act 2023 (NDPA)

| Field | Value |
|---|---|
| REGULATION | Nigeria Data Protection Act 2023 (established the Nigeria Data Protection Commission) |
| REQUIREMENT | Lawful basis + purpose limitation for processing personal data; data-subject rights; security safeguards; breach notification to NDPC; children's data safeguards; cross-border transfer conditions. Exact section-level obligations and any filing/registration duties (e.g. "data controller of major importance") are **REQUIRES_LEGAL_REVIEW** |
| CAPFLUX IMPACT | Processes names, phones, emails, student records (children), BVN/NIN, financial records of Nigerian data subjects |
| TECHNICAL CONTROL | AES-256-GCM field encryption for BVN/NIN (cryptoFields.ts); RLS tenant isolation; audit triggers; authenticated API |
| CODE LOCATION | backend/services/cryptoFields.ts; supabase/policies/rls_hardening.sql; supabase/triggers/audit_triggers.sql |
| DATABASE CONTROL | encrypted columns bvn_encrypted/nin_encrypted; last4 mirrors; append-only ledger |
| TEST/EVIDENCE | backend/tests/crypto.test.ts; kyc-settlement-bvn.test.ts; schoolIsolation.test.js |
| CURRENT STATUS | PARTIAL (technical safeguards exist; transparency/DSAR/retention tooling absent) |
| GAP | No privacy notice anywhere in product; no DSAR access/deletion workflow; no consent capture or lawful-basis record; retention not enforced |
| REMEDIATION | COMP-001..006 (COMPLIANCE_REMEDIATION_BACKLOG.md) |
| LEGAL REVIEW REQUIRED? | YES |

## R-2 NDPC General Application and Implementation Directive (GAID)

| Field | Value |
|---|---|
| REGULATION | NDPC GAID (implementation directive under NDPA 2023) |
| REQUIREMENT | Operationalises NDPA: accountability records, DPIAs for high-risk processing, registration obligations for controllers of major importance, breach-reporting mechanics. Specific thresholds/timelines **not verified from the directive text in this audit** ⇒ REQUIRES_LEGAL_REVIEW |
| CAPFLUX IMPACT | Children's data at scale (schools) plausibly elevates classification; DPIA likely required before production |
| TECHNICAL CONTROL | None DPIA-specific. Audit logging provides accountability evidence (AUDIT-001) |
| CODE LOCATION | n/a |
| DATABASE CONTROL | audit_logs |
| TEST/EVIDENCE | docs/security/compliance.md is design-only (all checklist items unchecked) |
| CURRENT STATUS | NOT_IMPLEMENTED |
| GAP | No DPIA, no registration determination, no accountability record of processing activities beyond DATA_INVENTORY.md created by this audit |
| REMEDIATION | COMP-002, COMP-006 |
| LEGAL REVIEW REQUIRED? | YES |

## R-3 CBN / payment-system regulatory boundary

| Field | Value |
|---|---|
| REGULATION | CBN licensing framework for Payment Service Providers / switches / processor categories |
| REQUIREMENT | Entities that hold, move, or process funds on behalf of others typically require licensing. Whether CAPFLUX's model (funds collected into PSP-owned DVAs; platform levy deducted by PSP split or settlement) constitutes regulated activity is **a classification question** |
| CAPFLUX IMPACT | CAPFLUX code never touches payer funds: DVAs are provider-side, CAPFLUX posts ledger entries after verification, settlements go to verified school accounts. Platform levy collection mechanics are implemented only as configuration (`fee_rules`/`calculate_platform_fee`) — **no live levy split exists in the payment path** |
| TECHNICAL CONTROL | Server-only gateway credentials; state machine; webhook verification |
| CODE LOCATION | backend/services/PaymentGateway.ts, gateways/*, routes/webhook.ts |
| DATABASE CONTROL | payment_transactions/settlement_records idempotency constraints |
| TEST/EVIDENCE | webhook-hardening.test.js; payment-lifecycle.test.ts |
| CURRENT STATUS | REQUIRES_LEGAL_REVIEW (classification); technical posture PARTIAL |
| GAP | Written legal classification of CAPFLUX vs licensed PSP roles does not exist |
| REMEDIATION | COMP-020 |
| LEGAL REVIEW REQUIRED? | YES |

## R-4 NIBSS / payment infrastructure considerations

| Field | Value |
|---|---|
| REGULATION | NIBSS operates national payment infrastructure (NIP, GS729 etc.); direct participation is bank/PSP-level |
| REQUIREMENT | Not directly applicable to a software platform using licensed PSPs, unless CAPFLUX later connects directly |
| CAPFLUX IMPACT | Indirect only: DVA account numbers are issued by PSPs/banks; CAPFLUX stores them as references |
| TECHNICAL CONTROL | n/a |
| CODE LOCATION | payment_accounts.virtual_account_number handling |
| DATABASE CONTROL | uq_payment_accounts_provider_ref (0025:49) |
| TEST/EVIDENCE | provisioning-regression.test.ts |
| CURRENT STATUS | NOT_APPLICABLE (current architecture) — revisit if direct connectivity is ever added |
| GAP | none identified for current scope |
| REMEDIATION | monitor scope changes |
| LEGAL REVIEW REQUIRED? | NO (re-open if architecture changes) |

## R-5 FCCPC / consumer protection

| Field | Value |
|---|---|
| REGULATION | Federal Competition and Consumer Protection Act 2018 + FCCPC consumer-protection regulations |
| REQUIREMENT | Fair pricing disclosure, transparent terms, complaint-handling mechanisms, prohibition of misleading representations |
| CAPFLUX IMPACT | Parents pay a Platform Levy. Landing copy repeatedly markets the product as free to schools ("No Setup Fee", "Get Started Free") while stating parents pay the levy; **the levy amount/rate is nowhere disclosed** in frontend copy |
| TECHNICAL CONTROL | None — messaging only |
| CODE LOCATION | frontend/src/views/LandingView.vue:41,57,76,143,280,416–486; LandingNav.vue:108,160 |
| DATABASE CONTROL | fee_rules levy config (SUPER_ADMIN-managed) |
| TEST/EVIDENCE | CONSUMER_PROTECTION.md CONSUMER-001 |
| CURRENT STATUS | FAIL (misleading-representation risk in current copy) |
| GAP | Levy rate/amount undisclosed; "Free" CTAs unqualified |
| REMEDIATION | COMP-014 |
| LEGAL REVIEW REQUIRED? | YES |

## R-6 Nigerian cybersecurity legislation

| Field | Value |
|---|---|
| REGULATION | Cybercrimes (Prohibition, Prevention, etc.) Act 2015 (as amended 2024); sectoral cybersecurity directives |
| REQUIREMENT | Obligations around system protection, incident reporting to authorities (e.g. ngCERT), certain data-retention duties may apply to service providers. Applicability details to a SaaS platform **REQUIRES_LEGAL_REVIEW** |
| CAPFLUX IMPACT | Security controls reduce exposure: auth middleware, signature verification, headers, rate limiting (in-memory) |
| TECHNICAL CONTROL | index.ts:37–47 headers; :72–111 hand-rolled rate limiting; HMAC webhooks |
| CODE LOCATION | backend/index.ts; services/WebhookVerifier.ts |
| DATABASE CONTROL | n/a |
| TEST/EVIDENCE | auth-security.test.ts; security.test.ts |
| CURRENT STATUS | PARTIAL |
| GAP | No CSP; rate limiter per-process/in-memory without trust-proxy; no monitoring/SIEM wiring |
| REMEDIATION | COMP-016, INFRA items |
| LEGAL REVIEW REQUIRED? | YES |

## R-7 PCI DSS scope considerations

| Field | Value |
|---|---|
| REGULATION | PCI DSS v4.x (contract-driven via card schemes/acquirers, not Nigerian statute) |
| REQUIREMENT | Applies where cardholder data is stored/processed/transmitted, or where systems could impact the CDE |
| CAPFLUX IMPACT | Full source scan found **no PAN/CVV/expiry storage or transmission**; payments are bank-transfer/DVA via PSP-hosted channels; card entry (if any) happens entirely on PSP pages |
| TECHNICAL CONTROL | Delegation to PSP; no card fields in schema (PCI_DSS_SCOPE.md) |
| CODE LOCATION | whole-repo scan, migrations scan |
| DATABASE CONTROL | no card-data columns exist |
| TEST/EVIDENCE | check-secrets/sensitive-fields compliance scripts |
| CURRENT STATUS | PASS (cardholder-data absence) / REQUIRES_LEGAL_REVIEW (formal SAQ determination) |
| GAP | Formal scope classification (e.g. SAQ A-style reliance on PSP) not documented with acquirer/PSP |
| REMEDIATION | COMP-021 |
| LEGAL REVIEW REQUIRED? | YES (SAQ classification) |

## R-8 Corporate/accounting/financial record considerations

| Field | Value |
|---|---|
| REGULATION | Nigerian company law & tax record-keeping expectations (Companies and Allied Matters Act; FIRS record-keeping). Specific statutory periods not verified here ⇒ REQUIRES_LEGAL_REVIEW |
| REQUIREMENT | Retain accurate financial books/records for statutory periods |
| CAPFLUX IMPACT | Append-only ledger + immutable snapshots + full audit trail provide strong evidentiary basis |
| TECHNICAL CONTROL | LEDGER-002..005; reconciliation tables; reversal-not-delete semantics |
| CODE LOCATION | migrations 0023/0025; SettlementService; ReconciliationService |
| DATABASE CONTROL | unique idempotency constraints; RESTRICT FKs protecting financial rows |
| TEST/EVIDENCE | ledger-split-settlement.test.js; payment-lifecycle.test.ts |
| CURRENT STATUS | PARTIAL (integrity strong; retention enforcement absent; revenue-recognition of platform levy not implemented in payment path) |
| GAP | No archival/retention jobs; levy accounting incomplete |
| REMEDIATION | COMP-007, COMP-019 |
| LEGAL REVIEW REQUIRED? | YES |

## R-9 Third-party processor / subprocessor obligations

| Field | Value |
|---|---|
| REGULATION | NDPA processor contracts; general outsourcing prudence |
| REQUIREMENT | DPAs/processor agreements with processors; subprocessor transparency |
| CAPFLUX IMPACT | Processors: Supabase (hosting+DB+auth), Render/Vercel-or-Netlify (compute/CDN), Monnify/Paystack (payments), Termii (planned SMS), Fincra (designated KYC) |
| TECHNICAL CONTROL | Vendor register created (VENDOR_PROCESSOR_REGISTER.md) |
| CODE LOCATION | n/a (organizational control) |
| DATABASE CONTROL | n/a |
| TEST/EVIDENCE | vendor register statuses = UNVERIFIED until contracts inspected |
| CURRENT STATUS | REQUIRES_OPERATIONAL_REVIEW |
| GAP | Zero DPAs verified in this audit |
| REMEDIATION | COMP-012 |
| LEGAL REVIEW REQUIRED? | YES |

## R-10 Cross-border data processing

| Field | Value |
|---|---|
| REGULATION | NDPA 2023 cross-border transfer mechanism; GAID transfer rules |
| REQUIREMENT | Transfers outside Nigeria require adequate protection/mechanism per NDPA. Exact adequacy mechanism **REQUIRES_LEGAL_REVIEW** |
| CAPFLUX IMPACT | Primary datastore hosted in Supabase EU-West-Ireland per docs/architecture/environment.md:7–13 ⇒ personal data leaves Nigeria by default |
| TECHNICAL CONTROL | None jurisdiction-specific (encryption in transit/at rest applies regardless) |
| CODE LOCATION | hosting configuration (external) |
| DATABASE CONTROL | n/a |
| TEST/EVIDENCE | INFRASTRUCTURE_AUDIT.md INFRA-001 |
| CURRENT STATUS | REQUIRES_LEGAL_REVIEW |
| GAP | No transfer-mechanism documentation; region choice not validated against residency requirements |
| REMEDIATION | COMP-013 |
| LEGAL REVIEW REQUIRED? | YES |

---

## Summary counts

PASS 1 · PARTIAL 4 · FAIL 1 · NOT_IMPLEMENTED 1 · NOT_APPLICABLE 1 · REQUIRES_LEGAL_REVIEW-dominant 2 (+legal-review flags on 8 rows) · UNKNOWN 0
