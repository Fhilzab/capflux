# Entity Relationship Diagram

## Core Entities - Fee-First Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            CAPSTONE SCHOOL ERP                              │
│                       Fee-First Billing Architecture                        │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────┐
│    schools        │
│───────────────────│
│ id (PK) UUID      │
│ name TEXT         │
│ subscription_*    │
│ created_at        │
└────────▲────────┘
         │
         ├─────────────────────────────────────────────────────────────────────┐
         │                                                                     │
         │         ┌─────────────────┐       ┌─────────────────┐           │
         │         │ tuition_        │       │ fee_rules       │           │
         │         │ configuration   │       │───────────────────│           │
         │         │───────────────────│       │ id (PK) UUID      │           │
         │         │ id (PK) UUID      │       │ school_id (FK)    │           │
         │         │ school_id (FK)    │       │ minimum_fee       │           │
         │         │ academic_session  │       │ percentage        │           │
         │         │ academic_term     │       │ maximum_fee       │           │
         │         │ category          │       │ effective_date    │           │
         │         │ tuition_amount    │       │ is_active         │           │
         │         │ created_at        │       │ created_at        │           │
         │         └───────────────────┘       └────────▲──────────┘           │
         │                                               │                      │
         │         ┌─────────────────┐       ┌───────────┴──────────┐           │
         │         │                 │       │                      │           │
         │         │                 │       │                      │           │
         │         │                 │       │                      │           │
         │         │                 │       │                      │           │
         │         │                 │       │                      │           │
         │         │                 │       │                      │           │
         │         │                 │       │                      │           │
         │         │                 │       │                      │           │
         │         │                 │       │                      │           │
         │         │                 │       │                      │           │
         │         │                 │       │                      │           │
         │         │                 │       │                      │           │
         │         │                 │       │                      │           │
         │         │                 │       │                      │           │
         │         └───────────────────┘       └──────────────────────┘           │
         │                                                                       │
         │                                                                       │
         │                                    ┌─────────────────┐               │
         │                                    │    guardians    │               │
         │                                    │─────────────────│               │
         │                                    │ id (PK) UUID      │               │
         │                                    │ school_id (FK)    │               │
         │                                    │ full_name TEXT    │               │
         │                                    │ primary_phone TEXT│               │
         │                                    │ secondary_phone   │               │
         │                                    │ email TEXT        │               │
         │                                    │ relationship      │               │
         │                                    │ created_at        │               │
         │                                    │ updated_at        │               │
         │                                    └────────▲──────────┘               │
         │                                             │                           │
         │                                             │                           │
         │                                    ┌────────┴──────────┐               │
         │                                    │                   │               │
         │                                    │                   │               │
         │                                    │                   │               │
         │                                    │                   │               │
         │                                    │                   │               │
         │                                    │                   │               │
         │                                    │                   │               │
         │                                    │                   │               │
         │                                    │                   │               │
         │                                    │                   │               │
         │                                    └───────────────────┘               │
         │                                               │                          │
         │                                               │                          │
         │                           ┌─────────────────────┴──────────────────────────┐
         │                           │                                                │
         │                 ┌─────────┴──────────┐                         ┌───────────┴──────────┐
         │                 │                    │                         │                    │
         │                 │                    │                         │                    │
         │                 │                    │                         │                    │
         │    ┌────────────────────────┐              ┌────────────────────────┐       │
         │    │    students            │              │    payment_accounts    │       │
         │    │────────────────────────│              │────────────────────────│       │
         │    │ id (PK) UUID         │              │ id (PK) UUID           │       │
         │    │ school_id (FK)       │              │ school_id (FK)         │       │
         │    │ first_name TEXT      │              │ student_id (FK)        │       │
         │    │ last_name TEXT       │              │ provider_name TEXT     │       │
         │    │ class_name TEXT      │              │ account_number TEXT    │       │
         │    │ category TEXT        │              │ bank_name TEXT         │       │
         │    │ guardian_id (FK)     │─────────────▶│ account_reference TEXT │       │
         │    │ status student_*     │              │ provider_student_*    │       │
         │    │ created_at           │              │ status TEXT            │       │
         │    └──────────────────────┘              │ created_at             │       │
         │                                            └────────────────────────┘       │
         │                                    ┌───────────────────────────────────────┐
         │                                    │                                       │
         │                                    │      ledger_entries                   │
         │                                    │───────────────────────────────────────│
         │                                    │ id (PK) UUID                          │
         │                                    │ school_id (FK)                        │
         │                                    │ student_id (FK)                       │
         │                                    │ amount NUMERIC(12,2)                  │
         │                                    │ entry_type (DEBIT/CREDIT)             │
         │                                    │ entry_category                        │
         │                                    │ reference_id                          │
         │                                    │ metadata JSONB                        │
         │                                    │ client_sequence                       │
         │                                    │ created_at                            │
         │                                    └───────────────────────────────────────┘
         │                                               │
         │                                               │
         │                                    ┌───────────┴──────────┐
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    └──────────────────────┘
         │                                               │
         │                                    ┌───────────┴──────────┐
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    └──────────────────────┘
         │                                               │
         │                                    ┌───────────┴──────────┐
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    └──────────────────────┘
         │                                               │
         │                                    ┌───────────┴──────────┐
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    └──────────────────────┘
         │                                               │
         │                                    ┌───────────┴──────────┐
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    └──────────────────────┘
         │                                               │
         │                                    ┌───────────┴──────────┐
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    └──────────────────────┘
         │                                               │
         │                                    ┌───────────┴──────────┐
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    └──────────────────────┘
         │                                               │
         │                                    ┌───────────┴──────────┐
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    └──────────────────────┘
         │                                               │
         │                                    ┌───────────┴──────────┐
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    │                      │
         │                                    └──────────────────────┘
         │                                               │
         └─────────────────────────────────────────────────┘
```

Legend:
- PK = Primary Key
- FK = Foreign Key
- ◀ / ▶ = Foreign Key relationship (points to referenced table)

---

## Entity Relationships

### Schools
- One-to-many with tuition_configuration (per session/term/category)
- One-to-many with fee_rules (configurable platform fee)
- One-to-many with students
- One-to-many with guardians
- One-to-many with payment_accounts (DVAs)
- One-to-many with ledger_entries
- One-to-many with notifications

### Tuition Configuration
- Configured once per (school, session, term, category)
- Categories: NURSERY, PRIMARY, SECONDARY

### Fee Rules
- One active rule per school at a time
- Controls platform & banking service fee calculation
- NOT hardcoded - configurable per school

### Guardians (Parents/Guardians - External)
- Many-to-one with schools
- One-to-many with students
- One-to-many with notifications

### Students
- Many-to-one with schools
- Many-to-one with guardians
- One-to-one with payment_accounts (DVA)
- One-to-many with ledger_entries

### Payment Accounts (Dedicated Virtual Accounts)
- Many-to-one with schools
- Many-to-one with students
- Provider agnostic (monnify/flutterwave/remita)

### Ledger Entries
- Many-to-one with schools
- Many-to-one with students
- DEBIT = charges/fees, CREDIT = payments
- PLATFORM_BANKING_FEE = platform fee on successful payments
- Immutable - never updated, only appended

---

## Offline-First Features

All entities are stored in IndexedDB via Dexie.js for offline operation:

1. **students** - With category for tuition lookup
2. **guardians** - Normalized guardian records
3. **tuition_configurations** - Offline tuition configuration
4. **fee_rules** - Offline fee rules configuration
5. **payment_accounts** - Dedicated DVA storage
6. **ledger_entries** - Immutable entries
7. **sync_queue** - All changes queued for offline sync

---

## Fee-First Registration Flow

```
Student Registration
        ↓
  Determine Category
        ↓
Retrieve Tuition Config
        ↓
   Create Student
        ↓
Create/Reuse Guardian
        ↓
   Create DVA (via gateway)
        ↓
Generate TUITION DEBIT
        ↓
     (No Platform Fee - only on payment)
```

---

## Payment Flow

```
Payment Received (DVA)
        ↓
Verify with Gateway API
        ↓
Create CREDIT TUITION Entry
        ↓
Calculate Platform Fee (from fee_rules)
        ↓
Create CREDIT PLATFORM_BANKING_FEE Entry
        ↓
Notify Guardian
        ↓
Sync Offline Queue