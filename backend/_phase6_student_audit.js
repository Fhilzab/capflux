/**
 * Phase 6 — Student and extended reference investigation
 * Checks if the student associated with the test school is also test data,
 * and checks for any remaining references to WorkOS IDs.
 */
import 'dotenv/config';
import { supabase } from './supabaseClient.js';

const TEST_SCHOOL_IDS = [
  '96cffab8-bfb0-4c2b-afa3-b8c62068145c',
  '222c0238-4107-47d4-b790-4e03981fa273',
];

const TEST_ORG_IDS = [
  'ec581f5d-968d-483b-b1b3-53da25bf5050',
  '96538b22-723a-49e0-96be-fbb9ebfa00ab',
];

const WORKOS_IDS = [
  'user_01KZG4SAQKBFWZ30VR2QS5CF6W',
  'user_01KZG4TVG29R14N85NEGA1AMDA',
];

console.log('=== Phase 6: Student & Extended Reference Investigation ===\n');

// ── 1. Check student on sandbox school ──
console.log('--- Student on Sandbox Test School ---');
const { data: student, error: studErr } = await supabase
  .from('students')
  .select('*')
  .eq('school_id', '222c0238-4107-47d4-b790-4e03981fa273');
console.log(`Students: ${student?.length ?? 0}`);
if (student && student.length > 0) {
  console.log('Student data:', JSON.stringify(student, null, 2));
  // Check student's associated data
  for (const s of student) {
    // Check guardian_students
    const { count: gsCount } = await supabase
      .from('guardian_students').select('*', { count: 'exact', head: true })
      .eq('student_id', s.id);
    console.log(`  Student ${s.id}: ${gsCount ?? 0} guardian_student links`);

    // Check fees for this student
    const { count: feesCount } = await supabase
      .from('student_charges').select('*', { count: 'exact', head: true })
      .eq('student_id', s.id);
    console.log(`  Student ${s.id}: ${feesCount ?? 0} student_charges`);

    // Check profiles
    const { count: profCount } = await supabase
      .from('profiles').select('*', { count: 'exact', head: true })
      .in('user_id', WORKOS_IDS);
    console.log(`  profiles referencing WorkOS IDs: ${profCount ?? 0}`);
  }
}

// ── 2. Check onboarding_progress for test schools ──
console.log('\n--- Onboarding progress for test schools ---');
const { data: onboarding, error: obErr } = await supabase
  .from('onboarding_progress')
  .select('*')
  .in('school_id', TEST_SCHOOL_IDS);
console.log(`Onboarding records: ${onboarding?.length ?? 0} ${obErr ? '(ERROR: ' + obErr.message + ')' : ''}`);
if (onboarding && onboarding.length > 0) {
  console.log('Onboarding data:', JSON.stringify(onboarding, null, 2));
}

// ── 3. Check invited_by in school_members ──
console.log('\n--- invited_by check in school_members ---');
try {
  const { data: invitedCheck, error: invErr } = await supabase
    .from('school_members')
    .select('*')
    .in('invited_by', WORKOS_IDS);
  console.log(`school_members.invited_by referencing WorkOS IDs: ${invitedCheck?.length ?? 0} ${invErr ? '(ERROR: ' + invErr.message + ')' : ''}`);
} catch (e) {
  console.log('invited_by check:', e.message);
}

// ── 4. Check ALL columns in ALL tables for WorkOS IDs ──
// Use a broader approach: check common reference patterns
console.log('\n--- Broad reference scan (all known tables, common columns) ---');
const ALL_TABLES = [
  'users', 'user_profiles', 'school_members', 'profiles',
  'organizations', 'organization_members', 'onboarding_progress',
  'kyc_records', 'kyc_verifications', 'roles', 'role_permissions',
  'permissions', 'students', 'classes', 'fees', 'fee_rules',
  'invoices', 'payments', 'payment_accounts', 'payment_transactions',
  'settlement_records', 'settlement_accounts', 'reconciliation_runs',
  'ledger_entries', 'audit_logs', 'notifications', 'pending_notifications',
  'dva_records', 'dva_assignments', 'guardians', 'guardian_students',
  'tuition_configuration', 'sync_queue', 'gateway_assignments',
  'payment_gateway_config', 'billing_profiles', 'billing_snapshots',
  'student_charges', 'financial_ledger_entries', 'financial_journals',
  'financial_transactions', 'legacy_identity_migrations',
];

const ALL_USER_COLS = [
  'user_id', 'created_by', 'updated_by', 'owner_id', 'invited_by',
  'approved_by', 'processed_by', 'performed_by', 'actor_id',
  'created_by_user_id', 'requested_by', 'verified_by', 'owner_user_id',
  'updated_by_user_id', 'requested_by_user_id', 'author_id', 'assigned_to',
];

const allRefs = {};
for (const table of ALL_TABLES) {
  for (const col of ALL_USER_COLS) {
    try {
      // Only check if the column is not UUID-only (some columns might be UUID type)
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true })
        .eq(col, WORKOS_IDS[0]); // Test with first WorkOS ID
      if (!error && count > 0) {
        // Found matches, get the full count for all WorkOS IDs
        const { count: allCount } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true })
          .in(col, WORKOS_IDS);
        if (allCount > 0) {
          allRefs[`${table}.${col}`] = allCount;
          console.log(`FOUND: ${table}.${col} — ${allCount} references`);
        }
      }
    } catch (e) {
      // column doesn't exist
    }
  }
}

// ── 5. Check for WorkOS IDs in any text-like column of test schools ──
console.log('\n--- Check schools table for WorkOS references ---');
const { data: schoolsData } = await supabase
  .from('schools')
  .select('*')
  .in('owner_user_id', WORKOS_IDS);
if (schoolsData && schoolsData.length > 0) {
  for (const s of schoolsData) {
    console.log(`School ${s.id}: "${s.name}" — owner=${s.owner_user_id}`);
    // Check for other WorkOS references
    const schoolJson = JSON.stringify(s);
    const workosFound = WORKOS_IDS.filter((id) => schoolJson.includes(id));
    if (workosFound.length > 0) {
      console.log(`  WorkOS IDs found in school data: ${workosFound.join(', ')}`);
    }
  }
}

// ── 6. Check roles for test orgs (role_members, permissions) ──
console.log('\n--- Role permissions for test orgs ---');
for (const orgId of TEST_ORG_IDS) {
  try {
    const { count: rpCount } = await supabase
      .from('role_permissions').select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId);
    console.log(`Org ${orgId}: ${rpCount ?? 0} role_permissions`);
  } catch (e) {}
}

// Check if roles are referenced by school_members
console.log('\n--- Role references in school_members ---');
const { data: rolesData } = await supabase.from('roles').select('id, organization_id, system_role, name').in('organization_id', TEST_ORG_IDS);
console.log(`Roles in test orgs: ${rolesData?.length ?? 0}`);
if (rolesData && rolesData.length > 0) {
  console.log('Test org roles:', JSON.stringify(rolesData, null, 2));
}

// ── Summary ──
console.log('\n--- Final Summary ---');
console.log('All WorkOS ID references found:');
for (const [ref, count] of Object.entries(allRefs)) {
  console.log(`  ${ref}: ${count}`);
}
console.log(`\nTotal distinct tables with WorkOS refs: ${Object.keys(allRefs).length}`);

if (Object.keys(allRefs).length === 0) {
  console.log('NO WorkOS ID references found outside of: users, user_profiles, school_members, organization_members, schools (owner_user_id)');
}

console.log('\n=== Investigation Complete ===');
