CAPFLUX System Architecture v1.0 (Revised)
Vision
CAPFLUX is an offline-first, multi-tenant, financially accurate School Management System built specifically for African schools where unreliable electricity, poor internet connectivity, and aging desktop computers are everyday realities.
Every architectural decision prioritizes:
Fast local performance
Financial integrity
Fault tolerance
Simplicity
Horizontal scalability
High-Level Architecture
CAPFLUX

┌──────────────────────────────────────────────────────────────┐
│                  PRESENTATION LAYER                          │
│ Vue 3 • Tailwind CSS • Pinia • Vue Router • UI Components    │
└──────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│ APPLICATION LAYER                                            │
│ Register Student • Generate Invoice • Record Payment         │
│ Send Receipt • Authenticate User • Synchronize Data          │
└──────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│ DOMAIN LAYER                                                 │
│ Authentication • Student • Billing • Finance • Payment       │
│ Notification • Reporting Services                            │
└──────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│ REPOSITORY LAYER                                             │
│ Student • Invoice • Ledger • Notification • Audit           │
└──────────────────────────────────────────────────────────────┘
                 │                              │
                 ▼                              ▼
        Dexie Repository              Supabase Repository
Infrastructure
Dexie (IndexedDB)
Local cache
Pending sync queue
Sync metadata
Client sequence numbers
Sync Engine
Connectivity detection
Queue processing
Background synchronization
Retry with exponential backoff
Conflict resolution
Idempotent replay
Supabase
Authentication
PostgreSQL
Row-Level Security
Edge Functions
Storage
Realtime
External Services
Monnify
Paystack
Termii
Frontend clients never communicate directly with external providers. All integrations go through Supabase Edge Functions.
Core Principles
Offline First --- Save locally first, sync later.
Multi-Tenant Security --- Every business record includes school_id; access is enforced with PostgreSQL RLS.
Financial Integrity --- Invoices represent charges; immutable ledger entries represent financial movements. Balances are calculated, never stored.
Reliable Synchronization --- Every mutation is queued and replayed in client_sequence order.
Idempotent Writes --- UUIDs are generated on the client before syncing.
Clock Independence --- Financial ordering uses client_sequence; PostgreSQL assigns authoritative server_created_at.
Scalability --- Domain logic is isolated from infrastructure.
Domain Modules
src/
└── modules/
    ├── auth/
    ├── schools/
    ├── students/
    ├── billing/
    ├── finance/
    ├── payments/
    ├── notifications/
    ├── sync/
    ├── reports/
    └── shared/
MVP Database
schools
profiles
students
invoices
ledger_entries
notifications
audit_logs
sync_queue
app_settings
Golden Rules
Offline-first by default.
No business logic in Vue components.
Every client-created record has a UUID before synchronization.
Financial records are immutable.
Student balances are derived from the ledger.
Every important action is audited.
Sync operations must be idempotent.
External APIs are accessed only through Edge Functions.
RLS is the primary security boundary.
Protect the MVP from feature creep.                                                                                                                                       │ Authentication Service                                       │
                                                                                                                                       │ Student Service                                              │
                                                                                                                                       │ Billing Service                                              │
                                                                                                                                       │ Finance Service                                              │
                                                                                                                                       │ Payment Service                                              │
                                                                                                                                       │ Notification Service                                         │
                                                                                                                                       │ Reporting Service                                            │
                                                                                                                                       └──────────────────────────────────────────────────────────────┘
                                                                                                                                                                  │
                                                                                                                                                                                             ▼
                                                                                                                                                                                             ┌──────────────────────────────────────────────────────────────┐
                                                                                                                                                                                             │                  REPOSITORY LAYER                            │
                                                                                                                                                                                             │--------------------------------------------------------------│
                                                                                                                                                                                             │ Student Repository                                           │
                                                                                                                                                                                             │ Invoice Repository                                           │
                                                                                                                                                                                             │ Ledger Repository                                            │
                                                                                                                                                                                             │ Notification Repository                                      │
                                                                                                                                                                                             │ Audit Repository                                             │
                                                                                                                                                                                             └──────────────────────────────────────────────────────────────┘
                                                                                                                                                                                                              │                              │
                                                                                                                                                                                                                               ▼                              ▼
                                                                                                                                                                                                                                       Dexie Repository              Supabase Repository
