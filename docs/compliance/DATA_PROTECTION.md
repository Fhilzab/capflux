# CAPFLUX Data Protection Audit (NDPC / NDPA-oriented)

**Audit date:** 2026-08-23. Technical audit only — no legal conclusions. Items marked REQUIRES_LEGAL_REVIEW need qualified Nigerian counsel/compliance officer validation.

---

## 1. Lawful basis & accountability

- **Status: REQUIRES_LEGAL_REVIEW** (basis determination) / **NOT_IMPLEMENTED** (record of basis).
- No consent capture, no lawful-basis record, no RoPA beyond the inventory created by this audit.
- Processing purposes observable in code: fee billing, payment collection, settlement to schools, notifications, KYC for payment activation, platform administration.

## 2. Purpose limitation & data minimisation

- **Status: PARTIAL.**
- Minimisation positives: BVN/NIN stored encrypted with last4 working copies; capability JSON stores field names not raw values (0029 migration comments); masked display throughout admin surfaces (`financial-admin.ts` masks account numbers to last4).
- Concerns: `raw_payload` on `payment_transactions` and webhook `rawPayload` persist entire provider payloads (may include payer names/accounts) without defined retention; KYC draft localStorage keeps full BVN/NIN plaintext on staff devices (SEC-006).

## 3. Transparency / privacy notice

- **Status: NOT_IMPLEMENTED.** No privacy notice or terms surface exists anywhere in `frontend/src/` (searched). Parents/guardians are data subjects indirectly (phones in guardian records) yet receive no notice. **COMP-001 (P0).**

## 4. Data subject rights (access, correction, deletion)

- **Status: NOT_IMPLEMENTED.** No DSAR endpoint, export routine, or erasure workflow exists. Erasure is structurally in tension with append-only financial records; docs/security/compliance.md models anonymization-not-deletion as policy intent — unimplemented and legally unvalidated (**REQUIRES_LEGAL_REVIEW**).
- Correction paths exist operationally (profile/KYC edit endpoints), but there is no request-tracking mechanism. **COMP-004.**

## 5. Retention

- **Status: NOT_IMPLEMENTED** (enforcement) / prose-only policy. See DATA_RETENTION_POLICY.md. No purge/archive jobs exist in schema or backend. **COMP-007.**

## 6. Security safeguards

- **Status: PASS (technical core) / PARTIAL (perimeter).**
  - In transit: TLS assumed at hosting layer; HSTS production-only (index.ts:37–47).
  - At rest: Supabase-managed encryption (unverified contractually); application-layer AES-256-GCM for BVN/NIN with env key + startup failure if key invalid (cryptoFields.ts:14–20); CAC documents on private filesystem with signed access.
  - Gaps: CSP missing; rate limiter in-memory/no trust-proxy; frontend tokens + KYC drafts in localStorage; offline IndexedDB plaintext.

## 7. Confidentiality & staff access

- Platform-staff endpoints mask identifiers (financial-admin.ts). Audit logging captures actor/school/action/entity/timestamps via triggers + `log_audit_action`. Service-role key is server-only (supabaseClient.ts throws when missing). **PARTIAL** — no least-privilege review process, SUPER_ADMIN is a hard bypass in AuthorizationService.checkPermission (:141).

## 8. Processor & subprocessor management

- **Status: REQUIRES_OPERATIONAL_REVIEW.** No DPA verified with any vendor. Register: VENDOR_PROCESSOR_REGISTER.md. **COMP-012.**

## 9. Breach response

- **Status: PARTIAL.** IR plan exists (docs/security/incident_response.md) with severity timelines and playbooks, but: regulator named incorrectly ("National Data Protection Bureau"; NDPA-era regulator is the NDPC), no drills evidenced, notification duties left as "if required" placeholders. Updated procedure: INCIDENT_RESPONSE.md. **COMP-005.**

## 10. DPIA

- **Status: NOT_IMPLEMENTED.** Children's data + financial + identity-document processing is plausibly high-risk processing requiring a DPIA under GAID — determination REQUIRES_LEGAL_REVIEW. **COMP-006.**

## 11. Children's / minors' data (mandatory analysis)

- CAPFLUX processes records of school pupils. There is **no student DOB field and no age verification anywhere** ⇒ every student row must be treated as a child's personal data by default.
- Role model present in code: `student`, `guardian`, school `OWNER/ADMIN/SUPER_ADMIN` staff, platform `SUPER_ADMIN`. Students have **no login/role** — they are pure data subjects acted upon by guardians/staff. Guardians likewise have no login; interaction is via bank rails and SMS.
- Implication: consent/authorisation for children's data must be mediated through guardians/schools; safeguards (minimisation, notice, retention limits) should assume child data throughout the students/guardians/notifications domains. Legal basis architecture **REQUIRES_LEGAL_REVIEW**. **COMP-002.**

## 12. Sensitive personal data / KYC data

- BVN/NIN treated as sensitive: encrypted AES-256-GCM, last4 mirrors, never returned decrypted to clients (verified across kyc.ts responses). Shareholder identity documents stored as encrypted BYTEA. CAC files private-FS with signed URLs. **PASS (technical)** — classification of "sensitive data" under NDPA is a legal question (REQUIRES_LEGAL_REVIEW).

## 13. Cross-border transfer & localisation

- Primary datastore EU-Ireland per environment.md:7–13. Transfer-mechanism documentation absent ⇒ **REQUIRES_LEGAL_REVIEW** (REGULATORY_MATRIX R-10). Note: environment.md predates auth migration — re-verify live region with provider before relying on it.

## 14. DPO / compliance responsibilities & registration

- **Status: REQUIRES_OPERATIONAL_REVIEW.** docs/security/compliance.md lists DPO designation as "management responsibility" — undetermined. Whether FHILZAB NIG LTD must register with NDPC as a data controller of major importance is a legal determination (**REQUIRES_LEGAL_REVIEW**, COMP-003).

## 15. Gap summary

| # | Gap | Priority |
|---|---|---|
| 1 | No privacy notice/terms | P0 |
| 2 | No children's-data legal-basis framework | P0 |
| 3 | No DSAR workflow | P1 |
| 4 | No retention enforcement | P1 |
| 5 | IR doc outdated regulator naming; no drill evidence | P1 |
| 6 | localStorage KYC drafts contain plaintext BVN/NIN | P1 (security+DP) |
| 7 | No DPIA / RoPA operationalised | P1 |
