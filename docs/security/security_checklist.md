# Security Checklist

> **Version:** 1.0 (Phase 1)  
> **Status:** Use for Every Deployment  

---

## Pre-Deployment Security Checklist

### Authentication & Authorization

- [ ] All authentication endpoints use rate limiting
- [ ] Password policy enforced (12 chars minimum)
- [ ] MFA required for Owner, Accountant, Cashier roles
- [ ] Session tokens expire in 1 hour
- [ ] Refresh tokens rotate on use
- [ ] All routes have proper authentication guards
- [ ] Components check permissions before rendering
- [ ] No `x-school-id` header trust in backend

### Database Security

- [ ] RLS enabled on all tables
- [ ] `school_id` filter in all policies
- [ ] No UPDATE/DELETE on ledger_entries
- [ ] Audit triggers on students, profiles, ledger
- [ ] All tables indexed on school_id
- [ ] Sensitive fields identified for encryption
- [ ] No SQL injection vectors in queries

### API Security

- [ ] Input validation on all endpoints
- [ ] CORS restricted to known origins
- [ ] CSRF tokens implemented
- [ ] Rate limiting configured
- [ ] Error messages sanitized
- [ ] Response filtering by role
- [ ] Pagination limits enforced
- [ ] Webhooks verify signatures

### Frontend Security

- [ ] CSP headers configured
- [ ] Security headers (X-Frame-Options, etc.)
- [ ] No localStorage for tokens
- [ ] Input sanitization in forms
- [ ] No inline scripts (work in progress)
- [ ] Error boundaries prevent stack trace leaks
- [ ] File upload restrictions if any

### Offline Security

- [ ] Dexie encryption planned for PII
- [ ] Sync queue signing designed
- [ ] Replay attack prevention designed
- [ ] Device trust mechanism designed
- [ ] Conflict detection designed

### Secrets & Keys

- [ ] No secrets in source code
- [ ] GitHub secrets configured
- [ ] Supabase Vault integrated
- [ ] API keys rotated quarterly
- [ ] JWT signing key secure

---

## MVP Security Requirements (Must Have)

### P0 - Critical

| Requirement | Status | Notes |
|-------------|--------|-------|
| JWT-based authentication | ✅ | Supabase Auth |
| RLS on all tables | ✅ | Needs hardening |
| Append-only ledger | ✅ | No UPDATE/DELETE |
| Account lockout | ❌ | Implement rate limiting |
| HTTPS everywhere | ✅ | Supabase managed |
| Input validation | ❌ | Add Zod schemas |
| Error sanitization | ❌ | Add to all endpoints |
| Route guards | ❌ | Implement in router |
| Backup encryption | ✅ | Supabase managed |

### P1 - Important

| Requirement | Status | Notes |
|-------------|--------|-------|
| MFA for admin roles | ❌ | Configure in Supabase |
| Dexie encryption | ❌ | Web Crypto API |
| Queue signing | ❌ | HMAC-SHA256 |
| Webhook verification | ✅ | WebhookVerifier.ts |
| Security headers | ❌ | Add to deployment |
| Audit logging | ⚠️ | Partial implementation |
| CORS configuration | ❌ | Add to functions |

---

## Compliance Checklist

### SOC 2 Common Criteria

| CC | Requirement | Status | Evidence |
|----|-------------|--------|----------|
| CC5.1 | Authorization | ⚠️ | See authorization.md |
| CC6.1 | Logical access | ⚠️ | See authentication.md |
| CC6.3 | System operations | ⚠️ | See audit_logging.md |
| CC6.6 | User activity | ⚠️ | See audit_logging.md |
| CC7.1 | System availability | ⚠️ | See backup_strategy.md |
| CC7.2 | Data classification | ⚠️ | See encryption.md |

### ISO 27001 Controls

| A.9 | Access control | ⚠️ | authentication.md |
| A.10 | Cryptographic controls | ⚠️ | encryption.md |
| A.12 | Information security aspects | ⚠️ | secure_development.md |
| A.13 | Information transfer | ⚠️ | api_security.md |
| A.14 | System acquisition | ⚠️ | secure_development.md |
| A.15 | Supplier relationships | ⚠️ | deployment_security.md |

### NDPA Compliance

| Requirement | Status | Notes |
|-------------|--------|-------|
| 3.1 - Consent | ⚠️ | Auth flow needed |
| 3.2 - Legitimate interest | ⚠️ | Privacy policy needed |
| 3.3 - Data protection | ⚠️ | encryption.md |
| 3.4 - Data breach notification | ⚠️ | Incident procedures |

### PCI DSS Readiness

| Requirement | Status | Notes |
|-------------|--------|-------|
| 3.4 - Encryption | ⚠️ | encryption.md |
| 10.1 - Audit trails | ⚠️ | audit_logging.md |
| 10.2 - Log content | ⚠️ | Add user, time, action |
| 10.3 - Log integrity | ⚠️ | Add checksums |
| 12.10 - Incident response | ⚠️ | disaster_recovery.md |

---

## Security Testing Checklist

### Static Analysis

- [ ] ESLint security plugin configured
- [ ] TypeScript strict mode enabled
- [ ] No `:any` in security-related code
- [ ] Dependency audit clean
- [ ] Secret scanning passing

### Dynamic Analysis

- [ ] OWASP ZAP scan on staging
- [ ] RLS tests passing
- [ ] Auth flow tests passing
- [ ] Authorization tests passing
- [ ] Rate limiting tests passing

### Penetration Testing (Annual)

- [ ] External pentest scheduled
- [ ] Internal pentest completed
- [ ] Vulnerability findings addressed
- [ ] Retest completed

---

## Operational Security Checklist

### Monitoring

- [ ] Failed login alerts configured
- [ ] Rate limit alerts configured
- [ ] Large payment alerts configured
- [ ] Data export alerts configured
- [ ] RLS violation alerts configured

### Incident Response

- [ ] Security contact list maintained
- [ ] Escalation procedures documented
- [ ] Communication templates ready
- [ ] Forensic tools available
- [ ] Legal contact identified

### Access Management

- [ ] Regular access review scheduled
- [ ] Offboarding procedure documented
- [ ] Privileged access reviewed
- [ ] Emergency access procedure
- [ ] Key rotation schedule

---

## Deployment Security Checklist

### Before Every Deploy

- [ ] Security scan passing
- [ ] Dependency audit clean
- [ ] No secrets in diff
- [ ] Migration tested in staging
- [ ] Rollback tested
- [ ] Monitoring configured
- [ ] Canary deployment used

### After Every Deploy

- [ ] Smoke test passed
- [ ] Security headers verified
- [ ] Rate limits working
- [ ] Auth flow working
- [ ] Audit logs flowing
- [ ] Alerts monitored

---

## Monthly Security Tasks

| Task | Owner | Notes |
|------|-------|-------|
| Review failed logins | Security | Report anomalies |
| Audit permission matrix | Security | Verify least privilege |
| Review backup tests | DevOps | Verify restore |
| Check dependency updates | Engineering | npm audit fix |
| Review audit logs | Security | Look for anomalies |
| Test MFA enforcement | Security | Verify required |

---

## Quarterly Security Tasks

| Task | Owner | Notes |
|------|-------|-------|
| Threat model review | Security | Update threats |
| Penetration test | External | Qualified tester |
| Security training | All | OWASP Top 10 |
| Compliance review | Security | Audit checklist |
| Key rotation | Security | API keys |
| Backup restore test | DevOps | Full restore |

---

## Annual Security Tasks

| Task | Owner | Notes |
|------|-------|-------|
| Security audit | External | SOC 2 scope |
| Policy review | Security | Update docs |
| Disaster recovery test | All | Full failover |
| Vendor security review | Security | Third-party audit |
| Employee offboarding review | HR | Access revoked |
| Security budget review | Management | Next year planning |

---

## Security Owner Responsibilities

| Role | Primary Responsibilities |
|------|--------------------------|
| **Platform Admin** | All security aspects, incident response lead |
| **School Owner** | User management, MFA enforcement, audit review |
| **Accountant** | Financial audit review, payment verification |
| **Cashier** | Payment recording, receipt verification |

---

## Security Contact

| Purpose | Contact | SLA |
|---------|---------|-----|
| **Security incidents** | security@capstone.ng | 15 min |
| **Data breach** | incidents@capstone.ng | 2 hours notice |
| **Security questions** | security-team@capstone.ng | 24 hours |
| **Bug bounty** | bounty@capstone.ng | 72 hours ack |

---

## Security Gates (Pull Request Checklist)

Every PR must pass these gates before merge:

### Authentication & Authorization Gates
- [ ] Authentication changes reviewed for session security
- [ ] Authorization changes tested with different roles
- [ ] No direct database access bypassing services
- [ ] RBAC enforced on all new endpoints

### Database Gates
- [ ] All queries use parameterized statements
- [ ] RLS policies tested for tenant isolation
- [ ] No UPDATE/DELETE on ledger_entries
- [ ] Audit events generated for all mutations

### Financial Gates
- [ ] Financial operations have idempotency protection
- [ ] Payment state transitions validated
- [ ] Reversal entries used instead of deletes
- [ ] Balance calculations verified

### Offline Security Gates
- [ ] PII fields encrypted in IndexedDB
- [ ] Sync queue items signed
- [ ] Replay protection implemented
- [ ] Conflict detection tested

### Code Quality Gates
- [ ] No secrets in diff
- [ ] No `:any` in security types
- [ ] Input validation on all external data
- [ ] Error messages sanitized

### Testing Gates
- [ ] Security unit tests pass
- [ ] Integration tests pass
- [ ] RLS tests pass
- [ ] Rate limiting tests pass

---

## Document Status Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Implemented |
| ⚠️ | Partial - needs work |
| ❌ | Not implemented |
| ☐ | TODO |
