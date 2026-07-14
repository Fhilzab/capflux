# Entity Relationship Diagram

## Core Entities

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            CAPSTONE SCHOOL ERP                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────┐       ┌─────────────────┐
│    schools        │
│───────────────────│       ┌─────────────────┐       ┌─────────────────┐
│ id (PK) UUID      │──────▶│    profiles     │       │   guardians     │
│ name TEXT         │       │───────────────────│       │─────────────────│
│ subscription_*    │       │ id (PK) UUID      │       │ id (PK) UUID      │
│ created_at        │       │ school_id (FK)    │       │ school_id (FK)    │
└─────────────────┘       │ full_name TEXT    │       │ full_name TEXT    │
                          │ role profile_role │       │ primary_phone TEXT│
                          │ created_at        │       │ secondary_phone   │
                          └───────────────────┘       │ email             │
                                        ▲             │ relationship      │
                                        │             │ created_at        │
                                        │             │ updated_at        │
                                        │             └────────▲──────────┘
                                        │                      │
                                        │                      │
                          ┌───────────────────┐       ┌────────┴──────────┐
                          │    students       │       │                   │
                          │───────────────────│       │                   │
                          │ id (PK) UUID      │       │                   │
                          │ school_id (FK)    │       │                   │
                          │ first_name TEXT   │       │                   │
                          │ last_name TEXT    │       │                   │
                          │ class_name TEXT   │       │                   │
                          │ guardian_id (FK) ◀───────────guardian_id      │
                          │ status student_status │     └───────────────────┘
                          │ client_sequence   │
                          │ device_id TEXT    │
                          │ created_at        │
                          │ updated_at        │
                          └────────▲──────────┘
                                   │
                                   │
                   ┌─────────────────┴──────────────────────────────┐
                   │                                                │
        ┌──────────┴──────────┐                         ┌──────────┴──────────┐
        │                     │                         │                     │
        │ ledger_entries      │                         │   notifications     │
        │─────────────────────│                         │─────────────────────│
        │ id (PK) UUID        │                         │ id (PK) UUID        │
        │ school_id (FK)      │                         │ school_id (FK)      │
        │ student_id (FK)───────student_id              │ student_id (FK)     │
        │ amount NUMERIC(12,2)│                         │ guardian_id (FK)───▶guardian_id
        │ entry_type ledger_* │                         │ recipient_phone     │
        │ entry_category      │                         │ message_body        │
        │ reference_id        │                         │ delivery_status     │
        │ metadata JSONB      │                         │ created_at          │
        │ client_sequence     │                         └─────────────────────│
        │ device_id           │                                               │
        │ created_at          │                                               │
        └─────────────────────┘                                               │
                                                                            │
                                                                            ▼
                                                        ┌─────────────────────────────────────┐
                                                        │           sync_queue                │
                                                        │─────────────────────────────────────│
                                                        │ id (PK) UUID                      │
                                                        │ school_id (FK)                    │
                                                        │ entity_type TEXT                  │
                                                        │ entity_id UUID                    │
                                                        │ operation TEXT                    │
                                                        │ payload JSONB                     │
                                                        │ retry_count INTEGER               │
                                                        │ status sync_status                │
                                                        │ created_at                        │
                                                        │ processed_at                      │
                                                        └─────────────────────────────────────┘

Legend:
- PK = Primary Key
- FK = Foreign Key
- ◀ / ▶ = Foreign Key relationship (points to referenced table)
```

## Entity Relationships

### Schools
- One-to-many with profiles
- One-to-many with students
- One-to-many with guardians
- One-to-many with ledger_entries
- One-to-many with notifications
- One-to-many with sync_queue

### Profiles (Internal Users: Proprietor, Admin, Bursar)
- Many-to-one with schools
- One-to-many with audit_logs

### Guardians (Parents/Guardians - External)
- Many-to-one with schools
- One-to-many with students
- One-to-many with notifications

### Students
- Many-to-one with schools
- Many-to-one with guardians
- One-to-many with ledger_entries
- One-to-many with notifications

### Ledger Entries
- Many-to-one with schools
- Many-to-one with students
- DEBIT = charges/fees, CREDIT = payments

### Notifications
- Many-to-one with schools
- Many-to-one with students (optional, for context)
- Many-to-one with guardians (for targeting)

## Offline-First Features

All entities are stored in IndexedDB via Dexie.js for offline operation:

1. **students** - guardian_id links to guardians table
2. **guardians** - Independent sync, can be created before student
3. **notifications** - guardian_id for family-level targeting
4. **sync_queue** - All changes queued for offline sync

## Future Compatibility

The Guardian entity is designed for future Parent Flutter App features:

1. **One login per guardian** - guardian record will link to auth
2. **Multiple children** - One guardian can have many students
3. **Family dashboard** - Query all students by guardian_id
4. **Family notifications** - Group notifications by guardian_id
5. **Household payment history** - Aggregate payments across students