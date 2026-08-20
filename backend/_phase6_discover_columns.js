/**
 * Phase 6A (continued): Discover column names for tables
 * where user_id columns might exist under different names.
 * Also check for school-level references.
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);

const TABLES_TO_INSPECT = [
  'onboarding_progress', 'kyc_records', 'kyc_verifications',
  'students', 'classes', 'guardians', 'guardian_students',
  'fees', 'fee_rules', 'fee_schedules',
  'invoices', 'invoice_items',
  'payment_accounts', 'payments', 'payment_methods', 'settlements',
  'dva_records', 'dva_audit', 'dva_audit_log',
  'financial_journals', 'financial_journal_entries', 'financial_ledger_entries',
  'financial_transactions', 'financial_transaction_lines',
  'billing_profiles', 'billing_snapshots',
  'audit_logs', 'audit_log_entries',
  'sessions', 'invitations', 'notifications',
  'roles', 'role_permissions', 'permissions',
  'users', 'user_profiles', 'profiles', 'schools', 'organizations',
];

console.log('=== Phase 6A: Column discovery for tables with potential user references ===\n');

for (const table of TABLES_TO_INSPECT) {
  try {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      if (error.message.includes('does not exist') || error.message.includes('not exist')) {
        console.log(`[${table}]: TABLE DOES NOT EXIST`);
      } else {
        console.log(`[${table}]: ERROR - ${error.message.substring(0, 80)}`);
      }
    } else {
      const columns = data?.length > 0 ? Object.keys(data[0]) : ['(table is empty, no columns visible from select(*))'];
      // Also try to get column info from the select
      const { data: colData, error: colError } = await supabase
        .from(table)
        .select('*', { count: 'exact' });
      const count = colError ? 'N/A' : colData?.length;
      console.log(`[${table}]: columns = ${columns.join(', ')} | row_count = ${count}`);
    }
  } catch (err) {
    console.log(`[${table}]: EXCEPTION - ${err.message.substring(0, 80)}`);
  }
}

// Also check for school-level references (by school_id)
console.log('\n=== Phase 6A: School-level references for test schools ===\n');

const testSchoolIds = ['96cffab8-bfb0-4c2b-afa3-b8c62068145c', '222c0238-4107-47d4-b790-4e03981fa273'];

for (const schoolId of testSchoolIds) {
  for (const table of TABLES_TO_INSPECT) {
    try {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true })
        .eq('school_id', schoolId);
      if (!error && count && count > 0) {
        console.log(`[${table}]: ${count} rows for school_id=${schoolId.substring(0, 8)}...`);
      }
    } catch (err) {
      // Silently skip tables without school_id column
    }
  }
}

// Check for organization-level references
console.log('\n=== Phase 6A: Organization-level references for test orgs ===\n');

const testOrgIds = ['ec581f5d-968d-483b-b1b3-53da25bf5050', '96538b22-723a-49e0-96be-fbb9ebfa00ab'];

for (const orgId of testOrgIds) {
  for (const table of TABLES_TO_INSPECT) {
    try {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId);
      if (!error && count && count > 0) {
        console.log(`[${table}]: ${count} rows for organization_id=${orgId.substring(0, 8)}...`);
      }
    } catch (err) {
      // Silently skip tables without organization_id column
    }
  }
}

console.log('\nDone.');
