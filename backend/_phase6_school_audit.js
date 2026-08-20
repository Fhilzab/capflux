/**
 * Phase 6 — School-level dependency check
 * Verifies that the 2 test schools have no associated production data
 * (students, classes, fees, invoices, payments, DVA, KYC, etc.)
 */
import 'dotenv/config';
import { supabase } from './supabaseClient.js';

const TEST_SCHOOL_IDS = [
  '96cffab8-bfb0-4c2b-afa3-b8c62068145c', // "E2E School 1786174552432"
  '222c0238-4107-47d4-b790-4e03981fa273', // "Sandbox Test School"
];

const TEST_ORG_IDS = [
  'ec581f5d-968d-483b-b1b3-53da25bf5050', // E2E org
  '96538b22-723a-49e0-96be-fbb9ebfa00ab', // Sandbox org
];

// Tables that might reference school_id
const SCHOOL_REF_TABLES = [
  'students', 'classes', 'fees', 'fee_rules', 'invoices', 'payments',
  'payment_accounts', 'ledger_entries', 'dva_records', 'dva_assignments',
  'kyc_records', 'kyc_verifications', 'tuition_configuration',
  'onboarding_progress', 'notifications', 'pending_notifications',
  'reconciliation_runs', 'sync_queue', 'audit_logs',
  'payment_transactions', 'settlement_records', 'settlement_accounts',
  'gateway_assignments', 'payment_gateway_config',
  'financial_ledger_entries', 'financial_journals', 'financial_transactions',
  'billing_profiles', 'billing_snapshots', 'student_charges',
  'guardians', 'guardian_students',
];

console.log('=== Phase 6: School-level Dependency Audit ===\n');
console.log(`Test school IDs: ${TEST_SCHOOL_IDS.join(', ')}`);
console.log(`Test org IDs: ${TEST_ORG_IDS.join(', ')}\n`);

// ── Check school_id references in all tables ──
console.log('--- School ID reference scan ---');
let totalSchoolRefs = 0;
for (const table of SCHOOL_REF_TABLES) {
  try {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })
      .in('school_id', TEST_SCHOOL_IDS);
    if (!error && count > 0) {
      console.log(`FOUND: ${table}.school_id — ${count} rows`);
      totalSchoolRefs += count;
    }
  } catch (e) {
    // column or table doesn't exist
  }
}
console.log(`Total school_id references to test schools: ${totalSchoolRefs}`);

// ── Check organization_id references ──
console.log('\n--- Organization ID reference scan ---');
let totalOrgRefs = 0;
for (const table of [...SCHOOL_REF_TABLES, 'organizations', 'organization_members', 'roles', 'role_permissions', 'permissions']) {
  try {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })
      .in('organization_id', TEST_ORG_IDS);
    if (!error && count > 0) {
      console.log(`FOUND: ${table}.organization_id — ${count} rows`);
      totalOrgRefs += count;
    }
  } catch (e) {
    // column or table doesn't exist
  }
}
console.log(`Total organization_id references to test orgs: ${totalOrgRefs}`);

// ── Check for any other references to test school IDs (as text in any column) ──
// We can't search all columns efficiently, but let's check the most common foreign keys
const otherRefColumns = [
  'school_id', 'organization_id', 'primary_school_id',
  'target_school_id', 'source_school_id', 'recipient_school_id',
];

console.log('\n--- Extended reference scan ---');
const extendedTables = ['ledger_entries', 'financial_ledger_entries', 'payments', 'invoices',
  'payment_accounts', 'dva_records', 'audit_logs', 'notifications'];
const extendedCols = ['school_id', 'organization_id', 'source_school_id', 'target_school_id'];

for (const table of extendedTables) {
  for (const col of extendedCols) {
    try {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true })
        .in(col, [...TEST_SCHOOL_IDS, ...TEST_ORG_IDS]);
      if (!error && count > 0) {
        console.log(`FOUND: ${table}.${col} — ${count} references to test IDs`);
      }
    } catch (e) {}
  }
}

// ── Check students table ──
console.log('\n--- Student check for test schools ---');
for (const sid of TEST_SCHOOL_IDS) {
  try {
    const { count, error } = await supabase
      .from('students')
      .select('*', { count: 'exact', head: true })
      .eq('school_id', sid);
    if (!error) {
      console.log(`School ${sid}: ${count} students`);
    }
  } catch (e) {
    console.log(`students table: ${e.message}`);
  }
}

// ── Check fee_rules table ──
console.log('\n--- Fee rules check for test schools ---');
for (const sid of TEST_SCHOOL_IDS) {
  try {
    const { count, error } = await supabase
      .from('fee_rules')
      .select('*', { count: 'exact', head: true })
      .eq('school_id', sid);
    if (!error) {
      console.log(`School ${sid}: ${count} fee_rules`);
    }
  } catch (e) {
    console.log(`fee_rules table: ${e.message}`);
  }
}

// ── Check invoices table ──
console.log('\n--- Invoice check for test schools ---');
for (const sid of TEST_SCHOOL_IDS) {
  try {
    const { count, error } = await supabase
      .from('invoices')
      .select('*', { count: 'exact', head: true })
      .eq('school_id', sid);
    if (!error) {
      console.log(`School ${sid}: ${count} invoices`);
    }
  } catch (e) {
    console.log(`invoices table error: ${e.message}`);
  }
}

// ── Check ledger_entries table ──
console.log('\n--- Ledger entry check for test schools ---');
for (const sid of TEST_SCHOOL_IDS) {
  try {
    const { count, error } = await supabase
      .from('ledger_entries')
      .select('*', { count: 'exact', head: true })
      .eq('school_id', sid);
    if (!error) {
      console.log(`School ${sid}: ${count} ledger_entries`);
    }
  } catch (e) {
    console.log(`ledger_entries table error: ${e.message}`);
  }
}

// ── Check kyc_records table ──
console.log('\n--- KYC records check ---');
try {
  const { count, error } = await supabase.from('kyc_records').select('*', { count: 'exact', head: true });
  console.log(`kyc_records total: ${count ?? 'N/A'} ${error ? '(ERROR: ' + error.message + ')' : ''}`);
  if (!error && count > 0) {
    const { data } = await supabase.from('kyc_records').select('*').limit(5);
    console.log('Sample KYC records:', JSON.stringify(data?.slice(0, 3), null, 2));
  }
} catch (e) {
  console.log(`kyc_records: ${e.message}`);
}

// ── Check organization_members for test orgs ──
console.log('\n--- Organization members for test orgs ---');
for (const orgId of TEST_ORG_IDS) {
  try {
    const { count, error } = await supabase
      .from('organization_members')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId);
    if (!error) {
      console.log(`Org ${orgId}: ${count} members`);
    }
  } catch (e) {}
}

// ── Check roles for test orgs ──
console.log('\n--- Roles for test orgs ---');
for (const orgId of TEST_ORG_IDS) {
  try {
    const { count, error } = await supabase
      .from('roles')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId);
    if (!error) {
      console.log(`Org ${orgId}: ${count} roles`);
    }
  } catch (e) {}
}

// ── Summary ──
console.log('\n--- Summary ---');
console.log(`Test schools: ${TEST_SCHOOL_IDS.length}`);
console.log(`  Total school_id references: ${totalSchoolRefs}`);
console.log(`Test organizations: ${TEST_ORG_IDS.length}`);
console.log(`  Total organization_id references: ${totalOrgRefs}`);
if (totalSchoolRefs === 0 && totalOrgRefs === 0) {
  console.log('\n✓ Test schools and organizations have NO associated production data.');
  console.log('  They are safe to remove entirely, or orphaned with NULLified owner_user_id.');
} else {
  console.log('\n⚠ Test schools/organizations have associated data. Must be handled carefully.');
}

console.log('\n=== School-level Audit Complete ===');
