# Security Implementation Roadmap

> **Version:** 1.0 (Phase 1)  
> **Status:** Living Document - Update as Implemented

---

## Why This Roadmap Is Necessary

Security controls must be implemented in logical order. This roadmap provides:
- **Clear implementation sequence**
- **Dependencies between controls**
- **Measurable milestones**
- **Phased delivery**

---

## Phase 1 – Identity & Access (Weeks 1-2)

| Control | Document | Status | Acceptance Criteria |
|---------|----------|--------|-------------------|
| Supabase Auth integration | authentication.md | ✅ Exists | Login works over HTTPS |
| Password policy (12 chars) | authentication.md | ☐ Planned | Policy enforced on signup |
| MFA for Owner/Admin/Accountant | authentication.md | ☐ Planned | TOTP required, enforced |
| Session token expiration | authentication.md | ☐ Planned | Tokens expire in 1 hour |
| Device registration | authentication.md | ☐ Planned | New devices require MFA |
| Rate limiting on auth | api_security.md | ☐ Planned | 5 attempts/15 min blocked |
| Email verification | authentication.md | ☐ Planned | Unverified users limited |

**Gate**: All authentication changes must pass security review before merge.

---

## Phase 2 – Authorization (Weeks 2-3)

| Control | Document | Status | Acceptance Criteria |
|---------|----------|--------|-------------------|
| RBAC middleware | authorization.md | ☐ Planned | Roles enforced in routes |
| Permission guards | authorization.md | ☐ Planned | Components check permissions |
| RLS tenant isolation | row_level_security.md | ✅ Partial | No cross-tenant queries |
| No header spoofing | row_level_security.md | ❌ Broken | x-school-id ignored |
| Profile role verification | authorization.md | ☐ Planned | Role checked on every action |
| Admin-only routes | authorization.md | ☐ Planned | Owner/Admin only paths |

**Gate**: All API endpoints must verify permissions. No direct database access allowed.

---

## Phase 3 – Financial Core (Weeks 3-4)

| Control | Document | Status | Acceptance Criteria |
|---------|----------|--------|-------------------|
| Append-only ledger | financial_integrity.md | ✅ Design | No UPDATE/DELETE on ledger |
| Double-entry accounting | financial_integrity.md | ☐ Planned | Payments create paired entries |
| Payment idempotency | financial_integrity.md | ☐ Planned | Duplicate refs rejected |
| Payment state machine | financial_integrity.md | ☐ Planned | Invalid transitions blocked |
| Ledger balance function | financial_integrity.md | ☐ Planned | Real-time balance correct |
| Audit on financial actions | audit_logging.md | ☐ Planned | Every payment logged |

**Gate**: No financial operation without idempotency key. All tested for race conditions.

---

## Phase 4 – Offline Security (Weeks 4-5)

| Control | Document | Status | Acceptance Criteria |
|---------|----------|--------|-------------------|
| Dexie encryption | offline_security.md | ❌ Missing | PII fields encrypted |
| Queue signing | offline_security.md | ❌ Missing | HMAC-SHA256 on queue items |
| Replay prevention | offline_security.md | ❌ Missing | Nonces tracked server-side |
| Conflict detection | offline_security.md | ❌ Missing | Merge/reject resolved |
| Device trust offline | offline_security.md | ❌ Missing | Offline period validated |

**Gate**: No unencrypted PII in IndexedDB. All sync items signed.

---

## Phase 5 – API Hardening (Weeks 5-6)

| Control | Document | Status | Acceptance Criteria |
|---------|----------|--------|-------------------|
| Input validation | api_security.md | ❌ Missing | Zod schemas on all inputs |
| CSP headers | frontend_security.md | ❌ Missing | No unsafe-inline scripts |
| CSRF tokens | api_security.md | ❌ Missing | Token verified on POST |
| Security headers | frontend_security.md | ❌ Missing | All headers present |
| Error sanitization | api_security.md | ❌ Missing | No stack traces exposed |
| Pagination limits | api_security.md | ❌ Missing | Max 100 items per page |

**Gate**: All endpoints validated. Security scan clean.

---

## Phase 6 – Monitoring & Detection (Weeks 6-7)

| Control | Document | Status | Acceptance Criteria |
|---------|----------|--------|-------------------|
| Audit dashboard | security_monitoring.md | ❌ Missing | Query logs in UI |
| Failed login alerts | security_monitoring.md | ❌ Missing | PagerDuty alerts |
| Large payment alerts | security_monitoring.md | ❌ Missing | >500K triggers SMS |
| Fraud detection views | fraud_detection.md | ❌ Missing | Anomaly queries work |
| Payment velocity limits | fraud_detection.md | ❌ Missing | >50/hr blocked |
| Geographic anomalies | fraud_detection.md | ❌ Missing | Country change flagged |

**Gate**: Every alert tested. False positive rate <10%.

---

## Phase 7 – Compliance & DR (Weeks 7-8)

| Control | Document | Status | Acceptance Criteria |
|---------|----------|--------|-------------------|
| Backup encryption | backup_strategy.md | ✅ Supabase | Verified encrypted |
| DR procedures | disaster_recovery.md | ☐ Planned | RTO/RPO tested |
| NDPA compliance | compliance.md | ☐ Planned | Consent flow works |
| Audit retention | audit_logging.md | ☐ Planned | 7-year retention |
| Security testing | secure_development.md | ☐ Planned | Tests in CI/CD |
| Key rotation | key_management.md | ☐ Planned | API keys rotate |

**Gate**: Backup restore tested. Compliance checklist passed.

---

## Implementation Status Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Implemented and verified |
| ⚠️ | Partially implemented |
| ☐ | Planned for this phase |
| ❌ | Not implemented |
| N/A | Not applicable |

---

## Progress Tracking

Update this roadmap weekly. Each completed control must be:
1. **Implemented in code**
2. **Tested (unit + integration)**
3. **Verified in staging**
4. **Document updated**