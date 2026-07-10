Capstone Database Schema v1.0
Purpose
Canonical database schema for the Capstone MVP.
Principles
Offline-first
Multi-tenant
Immutable ledger
Client-generated UUIDs
Idempotent sync
RLS enforced
Tables
schools
id, name, subscription_status, created_at
profiles
id, school_id, full_name, role, created_at
students
id, school_id, first_name, last_name, class_name, guardian_phone, dva_account_number, dva_bank_name, status, client_sequence, device_id, created_at, updated_at
ledger_entries
id, school_id, student_id, amount, entry_type, entry_category, reference_id, metadata(JSONB), client_sequence, device_id, created_at
Rules: - Append only - No UPDATE - No DELETE - Reverse mistakes with new entries
notifications
id, school_id, student_id, recipient_phone, message_body, delivery_status, provider_msg_id, client_sequence, device_id, created_at
audit_logs
id, school_id, actor_id, action, entity, entity_id, metadata(JSONB), created_at
sync_queue
id, school_id, entity_type, entity_id, operation, payload(JSONB), retry_count, status, created_at, processed_at
app_settings
school_id, currency, timezone, settings(JSONB)
Indexes
students(school_id)
ledger_entries(school_id)
ledger_entries(student_id)
profiles(school_id)
notifications(school_id)
RLS
Every business table filters by school_id using a helper function.
Financial Formula
Outstanding Balance = SUM(DEBIT) - SUM(CREDIT)