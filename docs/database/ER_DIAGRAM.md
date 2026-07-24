# Entity Relationship Diagram

## Core Entities - Fee-First Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            CAPFLUX SCHOOL ERP                              │
│                       Fee-First Billing Architecture                        │
│                       Payment Accounts Domain v2                           │
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
         │                                               │                           │
         │                                               │                           │
         │                                    ┌───────────┴──────────┐               │
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
         │                                   ┌─────────────┴────────────┐           │
         │                                   │                          │           │
         │                  ┌─────────────────┴──────────┐    ┌───────────┴──────────┐
         │                  │                            │    │    payment_accounts  │
         │                  │                            │    │──────────────────────│
         │                  │                            │    │ id (PK) UUID         │
         │    ┌────────────────────────┐              │    │ school_id (FK)       │
         │    │    students            │              │    │ student_id (FK)      │
         │    │────────────────────────│              │    │ provider TEXT        │
         │    │ id (PK) UUID         │              │    │ virtual_account_number│
         │    │ school_id (FK)       │              │    │ account_name TEXT    │
         │    │ first_name TEXT      │              │    │ bank_name TEXT       │
         │    │ last_name TEXT       │              │    │ account_status TEXT  │
         │    │ class_name TEXT      │              │    │ is_primary BOOLEAN   │
         │    │ category TEXT        │              │    │ provider_account_id  │
         │    │ guardian_id (FK)     │─────────────▶│    │ provider_reference   │
         │    │ status student_*     │              │    │ created_at           │
         │    │ created_at           │              │    │ updated_at           │
         │    │ updated_at           │              │    │ deactivated_at       │
         │    └──────────────────────┘              │    └──────────────────────┘
         │                                          │               │
         │                                          │               │
         │                                          │    ┌───────────┴──────────┐
         │                                          │    │                      │
         │                                          │    │                      │
         │                                          │    │                      │
         │                                          │    │                      │
         │                                          │    │                      │
         │                                          │    │                      │
         │                                          │    │                      │
         │                                          │    │                      │
         │                                          │    │                      │
         │                                          │    │                      │
         │                                          │    │                      │
         │                                          │    │                      │
         │                                          │    │                      │
         │                                          │    │                      │
         │                                          │    │                      │
         │                                          │    └──────────────────────┘
         │                                                                  │
         │                                                                  │
         │                                          ┌──────────────────────┴──────────────┐
         │                                          │                                       │
         │                                          │      ledger_entries                 │
         │                                          │─────────────────────────────────────│
         │                                          │ id (PK) UUID                          │
         │                                          │ school_id (FK)                        │
         │                                          │ student_id (FK)                       │
         │                                          │ amount NUMERIC(12,2)                  │
         │                                          │ entry_type (DEBIT/CREDIT)             │
         │                                          │ entry_category                        │
         │                                          │ reference_id                          │
         │                                          │ metadata JSONB                        │
         │                                          │ client_sequence                       │
         │                                          │ created_at                            │
         │                                          └───────────────────────────────────────┘
         │                                                                  │
         │                                                                  │
         │                                          ┌──────────────────────┴──────────────┐
         │                                          │                                       │
         │                                          │    payment_gateway_config              │
         │                                          │─────────────────────────────────────│
         │                                          │ id (PK) UUID                           │
         │                                          │ school_id (FK)                         │
         │                                          │ provider TEXT                          │
         │                                          │ api_key TEXT                           │
         │                                          │ secret_key TEXT                        │
         │                                          │ submerchant_code TEXT                  │
         │                                          │ is_active BOOLEAN                      │
         │                                          └───────────────────────────────────────┘
         │
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
- One-to-many with payment_accounts (One student can have multiple payment accounts)
- One-to-many with ledger_entries

### Payment Accounts (Dedicated Virtual Accounts - Domain v2)
- Many-to-one with schools
- Many-to-one with students
- Provider agnostic (monnify/flutterwave/remita)
- One account can be marked as primary per student
- Supports multiple accounts per student for provider migration scenarios

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
Create Payment Account (via gateway)
        ↓
Generate TUITION DEBIT
        ↓
   (No Platform Fee - only on payment)
```

---

## Payment Flow

```
Payment Received (Virtual Account)
        ↓
Lookup Payment Account
        ↓
   Resolve Student
        ↓
 Verify Transaction with Provider
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
```

---

## Migration Notes

### From dva_assignments to payment_accounts

The `dva_assignments` table has been superseded by `payment_accounts`. Key changes:

- **Old**: DVA fields stored on `students` table (dva_account_number, dva_bank_name)
- **New**: All payment account data stored in `payment_accounts` table
- **Multiple Accounts**: One student can have multiple payment accounts
- **Primary Account**: Only one payment account marked as `is_primary` per student
- **Provider Agnostic**: Supports monnify, flutterwave, and remita providers