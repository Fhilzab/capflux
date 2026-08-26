/**
 * Canonical Dexie schema for the CAPFLUX offline database.
 *
 * Single source of truth consumed by BOTH the production offline cache
 * (`capflux_local_db`, see ./localDb.ts) and the isolated sandbox database
 * (`capflux_sandbox_db`, see ../sandbox/sandboxDb.ts). Keeping the store
 * definitions here guarantees the sandbox exercises the exact same table
 * shapes as production — only the physical database differs.
 */

export const SCHEMA_V3: Record<string, string> = {
  schools: 'id, school_id, subscription_status, created_at, source, version, updated_at',
  profiles: 'id, school_id, full_name, role, created_at, source, version, updated_at',
  students: 'id, school_id, first_name, last_name, class_name, category, guardian_id, status, client_sequence, device_id, created_at, updated_at, source, version',
  guardians: 'id, school_id, full_name, primary_phone, secondary_phone, email, relationship, created_at, updated_at, source, version',
  ledger_entries: 'id, school_id, student_id, amount, entry_type, entry_category, reference_id, metadata, client_sequence, device_id, created_at, source, version',
  notifications: 'id, school_id, student_id, guardian_id, recipient_phone, message_body, delivery_status, client_sequence, device_id, created_at, source, version',
  audit_logs: 'id, school_id, actor_id, entity, entity_id, created_at',
  sync_queue: 'id, school_id, entity_type, entity_id, status, retry_count, created_at, processed_at, error_message, payload',
  app_settings: 'school_id, source, version, updated_at',
  payment_gateway_config: 'id, school_id, provider, api_key, secret_key, submerchant_code, settlement_account_number, settlement_account_bank, is_active, created_at, source, version, updated_at',
  payment_accounts: 'id, school_id, student_id, provider, provider_account_id, provider_reference, virtual_account_number, account_name, bank_name, account_status, is_primary, created_at, source, version, updated_at',
  payment_transactions: 'id, school_id, student_id, gateway_txn_ref, reference, amount, settlement_status, verified_at, source, version, updated_at',
  settlement_records: 'id, payment_transaction_id, destination, account_number, bank_name, amount, settled_at, source, version, updated_at',
  tuition_configurations: 'id, school_id, academic_session, academic_term, category, tuition_amount, created_at, source, version, updated_at',
  fee_rules: 'id, school_id, is_active, effective_date, created_at, source, version, updated_at',
};

export const SCHEMA_V4: Record<string, string> = {
  academic_sessions: 'id, school_id, name, is_current, status, start_date, created_at, updated_at, source, version',
  academic_terms: 'id, session_id, school_id, name, is_current, status, display_order, created_at, updated_at, source, version',
  school_divisions: 'id, school_id, name, code, status, display_order, created_at, updated_at, source, version',
  academic_levels: 'id, school_id, section_id, name, code, status, display_order, created_at, updated_at, source, version',
  student_enrollments: 'id, school_id, student_id, academic_session_id, section_id, level_id, status, effective_date, reason, created_at, updated_at, source, version',
  student_guardians: 'id, school_id, student_id, guardian_id, relationship, is_primary, created_at, source, version',
};

// v5: Students-domain hardening (see migration notes in localDb.ts).
export const SCHEMA_V5: Record<string, string> = {
  students: 'id, school_id, first_name, last_name, class_name, category, guardian_id, division_id, status, client_sequence, device_id, admission_number, created_at, updated_at, source, version',
  student_enrollments: 'id, school_id, student_id, [student_id+status], [level_id+status], academic_session_id, [academic_session_id+status], section_id, level_id, status, effective_date, reason, created_at, updated_at, source, version',
  student_guardians: 'id, school_id, student_id, guardian_id, relationship, is_primary, created_at, updated_at, source, version',
};

/** Tables added ONLY by the sandbox execution mode (version 100). */
export const SANDBOX_EXTRA_SCHEMA: Record<string, string> = {
  // School fee catalogue (Supabase `fees` table equivalent — SupabaseFeeProvider).
  fees: 'id, school_id, code, division_id, academic_level_id, is_mandatory, status, created_at',
  kyc_records: 'id, school_id, status, submitted_at, reviewed_at, created_at, updated_at',
  settlement_accounts: 'id, school_id, status, bank_code, created_at, updated_at',
  gateway_assignments: 'id, school_id, provider, status, assigned_at, created_at, updated_at',
  reconciliation_runs: 'id, school_id, status, run_at, created_at',
  reconciliation_issues: 'id, school_id, run_id, status, severity, created_at',
  school_shareholders: 'id, school_id, full_name, ownership_percentage, created_at',
  principal_invitations: 'id, school_id, email, status, token, expires_at, created_at',
  onboarding_progress: 'school_id, completed_steps, updated_at',
  audit_trail: 'id, school_id, actor_id, action, entity, entity_id, created_at',
  sandbox_meta: 'key',
};
