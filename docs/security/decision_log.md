# Security Decision Log

> **Version:** 1.0  
> **Status:** Living Document

---

## How to Use This Log

Every significant security decision must be recorded here:
1. Use the next available number
2. Include date and author
3. Document alternatives considered
4. Link to affected code/documentation

Format:
- **Date**: YYYY-MM-DD
- **Decision**: Brief statement
- **Rationale**: Why this choice
- **Alternatives**: What else considered
- **Trade-offs**: What we gave up
- **Status**: Accepted / Superseded / Under Review

---

## Decision #001

**Date**: 2026-07-18  
**Author**: Security Architecture Phase 1

**Decision**: Use Row Level Security (RLS) as primary tenant isolation mechanism

**Rationale**: 
- Database-enforced security cannot be bypassed by application bugs
- Centralized policy management
- Zero trust implementation at query level
- Defense in depth (RLS + application checks)

**Alternatives Considered**:
- Application-only filtering (rejected - bypasses on bugs)
- Separate schemas per tenant (rejected - operational complexity)
- Separate databases per tenant (rejected - cost)

**Trade-offs**:
- RLS adds query overhead (mitigated by indexes)
- Policies harder to test (requires testing framework)
- Complex queries may need special handling

**Status**: Accepted  
**References**: row_level_security.md, security_architecture.md

---

## Decision #002

**Date**: 2026-07-18  
**Author**: Security Architecture Phase 1

**Decision**: Implement append-only ledger for all financial records

**Rationale**:
- Financial fraud detection requires immutable history
- Compliance (SOC 2, PCI DSS) requires non-repudiation
- Corrections through reversal entries maintain audit trail
- Mathematical accuracy preserved through immutability

**Alternatives Considered**:
- Soft delete (rejected - can hide fraud)
- Versioned records (rejected - complexity)
- Regular updates with logging (rejected - can be bypassed)

**Trade-offs**:
- More storage for corrections
- Complex correction workflow
- No direct "fix" for errors

**Status**: Accepted  
**References**: financial_integrity.md, audit_logging.md

---

## Decision #003

**Date**: 2026-07-18  
**Author**: Security Architecture Phase 1

**Decision**: Use MVP role set of 6 roles (Owner, Accountant, Cashier, Registrar, Parent, Platform Admin)

**Rationale**:
- Simpler RBAC to implement
- Covers all user workflows
- Room for growth (Teacher, Principal roles added later)
- Clear separation of duties

**Alternatives Considered**:
- 12 roles at launch (rejected - too complex)
- Dynamic permissions (rejected - MVP scope)

**Trade-offs**:
- Some users may have broader permissions
- Future role explosion manageable

**Status**: Accepted  
**References**: authorization.md

---

## Decision #004

**Date**: 2026-07-18  
**Author**: Security Architecture Phase 1

**Decision**: Require MFA for all admin roles (Owner, Accountant, Cashier, Platform Admin)

**Rationale**:
- Admin roles can cause financial loss
- Device theft common in African context
- Compliance (SOC 2, PCI) requires MFA for privileged access
- TOTP is universally available (works offline)

**Alternatives Considered**:
- SMS-based MFA (rejected - unreliable in Africa)
- No MFA for MVP (rejected - too risky)
- Hardware keys only (rejected - user friction)

**Trade-offs**:
- TOTP requires smartphone
- Some user friction acceptable for admins

**Status**: Accepted  
**References**: authentication.md

---

## Decision #005

**Date**: 2026-07-18  
**Author**: Security Architecture Phase 1

**Decision**: Implement Dexie encryption for PII in offline database

**Rationale**:
- Device theft is #1 threat in Africa
- IndexedDB is readable by any JavaScript
- Legal requirement (NDPA) for data protection
- End-to-end encryption protects against compromise

**Alternatives Considered**:
- No offline encryption (rejected - theft risk)
- Encrypt entire database (rejected - performance)
- Password only (rejected - forgotten passwords lock data)

**Trade-offs**:
- Key derivation performance impact
- Lost password = unrecoverable data
- Complexity in implementation

**Status**: Accepted  
**References**: offline_security.md, encryption.md

---

## Decision #006

**Date**: 2026-07-18  
**Author**: Security Architecture Phase 1

**Decision**: Use Supabase Auth instead of custom authentication

**Rationale**:
- Built-in security best practices
- Argon2 password hashing
- JWT token management
- MFA support out of box
- Social login capability

**Alternatives Considered**:
- Auth0 (rejected - cost)
- Custom JWT (rejected - security risk)
- Firebase Auth (rejected - vendor lock-in)

**Trade-offs**:
- Vendor lock-in to Supabase
- Limited customization options

**Status**: Accepted  
**References**: authentication.md

---

## Template for New Decisions

```markdown
## Decision #XXX

**Date**: YYYY-MM-DD  
**Author**: [Team/Individual]

**Decision**: [Brief statement]

**Rationale**: [Why this choice]

**Alternatives Considered**:
- [Option 1] (selected/rejected - reason)
- [Option 2] (selected/rejected - reason)

**Trade-offs**:
- [Trade-off 1]
- [Trade-off 2]

**Status**: Accepted / Superseded / Under Review  
**References**: [document links]