#Capstone System Architecture v1.0 (Revised)
#Vision
Capstone is an offline-first, multi-tenant, financially accurate School Management System built specifically for African schools where unreliable electricity, poor internet connectivity, and aging desktop computers are everyday realities.
Every architectural decision prioritizes:
Fast local performance
Financial integrity
Fault tolerance
Simplicity
Horizontal scalability
#High-Level Architecture
                           CAPSTONE

                           ┌──────────────────────────────────────────────────────────────┐
                           │                  PRESENTATION LAYER                          │
                           │--------------------------------------------------------------│
                           │ Vue 3                                                        │
                           │ Tailwind CSS                                                 │
                           │ Pinia                                                        │
                           │ Vue Router                                                   │
                           │ Reusable UI Components                                       │
                           └──────────────────────────────────────────────────────────────┘
                                                      │
                                                                                 ▼
                                                                                 ┌──────────────────────────────────────────────────────────────┐
                                                                                 │                  APPLICATION LAYER                           │
                                                                                 │--------------------------------------------------------------│
                                                                                 │ Register Student                                             │
                                                                                 │ Generate Invoice                                             │
                                                                                 │ Record Payment                                               │
                                                                                 │ Send Receipt                                                 │
                                                                                 │ Authenticate User                                            │
                                                                                 │ Synchronize Data                                             │
                                                                                 └──────────────────────────────────────────────────────────────┘
                                                                                                            │
                                                                                                                                       ▼
                                                                                                                                       ┌──────────────────────────────────────────────────────────────┐
                                                                                                                                       │                     DOMAIN LAYER                             │
                                                                                                                                       │--------------------------------------------------------------│
                                                                                                                                       │ Authentication Service                                       │
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