# Financial Lifecycle Architecture

## 1. Purpose

This document defines the complete financial data flow for Capflux. It serves as the reference document for every financial milestone and establishes the invariants that all future development must preserve.

**Scope:** Core financial operations only — billing, payments, ledger, receipts. Excludes authentication, school management, student registration, and academic administration.

**Audience:** Developers, architects, and reviewers working on financial features.

---

## 2. Financial Lifecycle

```
School
  │
  ▼
Division
  │
  ▼
Fee Definition
  │
  ▼
Student
  │
  ▼
Billing Profile
  │
  ▼
Billing Snapshot (immutable)
  │
  ▼
Student Charge
  │
  ▼
Payment
  │
  ▼
Ledger Entry (append-only)
  │
  ▼
Receipt
```

### Lifecycle Steps

| Step | Description | Domain |
|------|-------------|--------|
| School | Container for all financial activity | `shared/school` |
| Division | Groups students with shared fee structure | `shared/divisions` |
| Fee Definition | Master record of chargeable items | `shared/fees` |
| Student | Individual with financial obligations | `shared/students` |
| Billing Profile | Per-session financial container for a student | `shared/billing` |
| Billing Snapshot | Immutable record of fee terms at assignment time | `shared/billing` |
| Student Charge | Individual financial obligation per fee per term | `shared/billing` |
| Payment | Money received against a charge | Milestone 10 |
| Ledger Entry | Append-only journal record | Milestone 11 |
| Receipt | Proof of payment issued to payer | Milestone 10 |

---

## 3. Domain Ownership

| Domain | Responsibility | Key Files |
|--------|---------------|-----------|
| `shared/school` | School lifecycle, calendar type, admission settings | `SchoolProvider`, `SchoolService`, `schoolStore` |
| `shared/divisions` | Division CRUD, status management | `DivisionProvider`, `DivisionService`, `divisionStore` |
| `shared/fees` | Fee definitions, mandatory/optional, platform/school, applicable fee selection | `FeeProvider`, `FeeService`, `feeStore` |
| `shared/students` | Student/guardian CRUD, admission numbering | `StudentProvider`, `StudentService`, `studentStore` |
| `shared/academic` | Sessions, terms, current academic context | `AcademicProvider`, `AcademicService`, `sessionStore` |
| `shared/billing` | Billing profiles, snapshots, charges, billing engine | `BillingProvider`, `BillingEngine`, `BillingService`, `billingStore` |
| `shared/payments` | Payment processing, receipt generation | Milestone 10 |
| `shared/ledger` | Append-only financial journal | Milestone 11 |

### Domain Interaction Rules

- **Billing** consumes `FeeService`, `AcademicService`, `StudentService` — never stores
- **Stores never import other stores** for business logic
- **Providers never import other providers**
- **Services only import providers and validators**

---

## 4. Layering Rules

```
UI (Vue Components)
  │
  ▼
Pinia Store
  │
  ▼
Service
  │
  ▼
Engine (when orchestration requires it)
  │
  ▼
Provider (abstract)
  │
  ▼
SupabaseProvider (concrete)
  │
  ▼
Supabase PostgreSQL
```

### Layer Responsibilities

| Layer | Role | Constraints |
|-------|------|-------------|
| **UI** | Presentation only | Never calls providers or services directly; always through stores |
| **Store** | State management, getters, error handling | No business logic; no direct provider calls; no importing other stores for business logic |
| **Service** | Business orchestration, validation | Constructor injection; may consume other services |
| **Engine** | Complex idempotent operations | Core logic that must be deterministic and idempotent |
| **Provider** | Abstract interface | Defines contract; no Supabase dependencies |
| **SupabaseProvider** | Concrete implementation | Only file allowed to import supabase client; Supabase column name mapping |

---

## 5. Financial Invariants

These are the constitutional rules of the financial engine. **No future feature may violate them.**

| # | Invariant | Enforced By |
|---|-----------|-------------|
| 1 | Billing snapshots are **immutable** — never edited after creation | BillingSnapshot has no update method in provider |
| 2 | Every student charge must reference a billing snapshot | Foreign key constraint |
| 3 | Billing profiles are **per student per academic session** | findBillingProfile by studentId + academicSessionId |
| 4 | Student charges are **per academic term** | academicTermId field on every charge |
| 5 | Payments **never edit billing snapshots** | BillingSnapshot has no update method |
| 6 | Ledger entries are **append-only** — never updated, never deleted | LedgerProvider (future) must enforce this |
| 7 | Every financial operation must be **idempotent** | Engine-level checks for existing records |
| 8 | Historical records are **never rewritten** | Snapshot pattern preserves fee values at assignment time |
| 9 | Mandatory fees **cannot be removed** from a student's billing | Validator prevents status changes to REMOVED/WAIVED/VOID for MANDATORY |
| 10 | Platform fees **cannot be removed** | Same as mandatory — platform fees are always present |
| 11 | Discounts are **stored but not applied** in the billing engine | BillingSnapshot stores discountApplied; BillingEngine does not calculate |
| 12 | Billing initialization requires an **active academic session AND term** | BillingEngine fails with SESSION_NOT_ACTIVE/TERM_NOT_ACTIVE |

---

## 6. Idempotency Rules

| Operation | Idempotency Key | Behavior on Re-run |
|-----------|----------------|---------------------|
| Billing profile creation | `studentId + academicSessionId` | Skip if exists |
| Student charge creation | `billingProfileId + feeId + academicSessionId + academicTermId` | Skip if exists |
| Payment posting | `paymentReference` (idempotency key from gateway) | Skip if already posted |
| Receipt generation | `chargeId + paymentId` | Return existing receipt |
| Ledger posting | `sourceId + sourceType` | Skip if already posted |

---

## 7. Future Milestones

| Milestone | Domain | Description |
|-----------|--------|-------------|
| Milestone 10 | `shared/payments` | Payment Processing & Receipt Generation |
| Milestone 11 | `shared/ledger` | Append-Only Financial Ledger |
| Milestone 12 | Reporting | Financial Reporting & Analytics |
| Milestone 13+ | Operations | Collections, Arrears, Payment Plans, Rollovers |

Each milestone must:
1. Create its domain folder under `shared/`
2. Follow the Provider → Service → Store layering
3. Respect all 12 financial invariants
4. Implement idempotency per the rules above
5. Document any new invariants in this document

---

## 8. Ledger Guarantees

The append-only ledger is the single source of financial truth for Capflux. The following guarantees are architectural promises. Future milestones and contributors must preserve them.

### 8.1 Append-only ledger
Ledger entries may only be created. They may never be updated or deleted. Corrections are made by adding compensating entries (REVERSAL, REFUND, ADJUSTMENT).

### 8.2 Idempotent posting
Posting the same financial event twice must not create duplicate ledger entries. Engines must check for an existing entry by source document (`sourceDocumentType + sourceDocumentId`) before creating a new one.

### 8.3 Atomic financial operations
If any part of a financial operation fails (ledger creation, allocation, charge locking), the entire operation must fail. Partial success that leaves billing and ledger out of sync is unacceptable.

### 8.4 Immutable historical records
Once created, billing snapshots, ledger entries, and receipts are immutable. Their values represent the truth at the time of the event and must remain unchanged for audit and reconciliation.

### 8.5 Deterministic running balances
Running balances are computed deterministically from the ordered ledger chain:
- DEBIT increases balance
- CREDIT decreases balance
- REVERSAL applies the opposite direction of the original entry

The balance after any entry must equal `balanceBeforeMinor + (direction === 'DEBIT' ? amountMinor : -amountMinor)`.

### 8.6 Compensating entries only
No existing ledger entry may be modified to correct an error. All corrections are new entries with opposite effects:
- REVERSAL negates an original entry
- REFUND records money returned
- ADJUSTMENT represents manual corrections

### 8.7 Database-level concurrency protection
Application-level idempotency checks prevent duplicates in normal operation. Future implementation must add database-level protection:
- Unique constraint on (`source_document_type`, `source_document_id`)
- Atomic sequence number generation per organization/school
- Row-level locking or serializable transactions for concurrent allocations

This protection is **deferred** but must be implemented before production deployment.

---

## 9. Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                         Vue UI                          │
├─────────────────────────────────────────────────────────┤
│                      Pinia Stores                       │
│   auth  school  division  fee  student  academic        │
│   billing  [payments]  [ledger]                         │
├─────────────────────────────────────────────────────────┤
│                     Services                            │
│   SchoolService  DivisionService  FeeService            │
│   StudentService  AcademicService  BillingService       │
│   [PaymentService]  [LedgerService]                     │
├─────────────────────────────────────────────────────────┤
│                     Engines                             │
│   BillingEngine  [PaymentEngine]  [LedgerEngine]        │
├─────────────────────────────────────────────────────────┤
│                  Abstract Providers                     │
│   SchoolProvider  DivisionProvider  FeeProvider         │
│   StudentProvider  AcademicProvider  BillingProvider    │
│   [PaymentProvider]  [LedgerProvider]                   │
├─────────────────────────────────────────────────────────┤
│               Supabase Providers (concrete)             │
│   SupabaseSchool  SupabaseDivision  SupabaseFee         │
│   SupabaseStudent  SupabaseAcademic  SupabaseBilling    │
│   [SupabasePayment]  [SupabaseLedger]                   │
├─────────────────────────────────────────────────────────┤
│                    Supabase PostgreSQL                   │
└─────────────────────────────────────────────────────────┘
```

Bracketed `[ ]` items represent future milestones.