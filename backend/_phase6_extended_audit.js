/**
 * Phase 6A (part 2) — Extended dependency verification
 *
 * Verifies remaining dependencies for the 21 WorkOS test users:
 * - Organization memberships
 * - School references
 * - Payment/DVA/financial table references
 * - Onboarding/KYC column discovery
 * - Student/guardian/class references
 */
import 'dotenv/config';
import { supabase } from './supabaseClient.js';

console.log('=== Phase 6A Extended Dependency Audit ===\n');

const WORKOS_IDS = [
  'user_01KZFVZHBJMK1327MKXNGDX434', 'user_01KZFWKDWSPVQB8SGEGRJM346T',
  'user_01KZG38NY1BPDQWWVKF7WCD02V', 'user_01KZG39TH57K0WZCSSG8V6DP73',
  'user_01KZG3HCBPW8995SYZ4870BGGR', 'user_01KZG3Q4BFQ5RA5W9B4X2BQGYX',
  'user_01KZG4KSGMR42AKP9SJ2N1RF1Y', 'user_01KZG4SAQKBFWZ30VR2QS5CF6W',
  'user_01KZG4TVG29R14N85NEGA1AMDA', 'user_01KZJY3NT6EN1DS9RVWWBCRNQJ',
  'user_01KZJZZ42FZBC4QRG2A5V6WJF2', 'user_01M02RXG3WXY9N32W1XJ9V3B1A',
  'user_01M05G9AS2Z2A3CEDXZEKX6YR4', 'user_01M05GMDTBNT9MW1BWCJSKQA2R',
  'user_01M05VMFCJCMBSWHPQ7VJTQ3Q3', 'user_01M05XA3X6G2DSSHMSN9S1HQAH',
  'user_01M05XR0VSTB2NSGPX6STYXX5G', 'user_01M05XZF6BWCYXVEEX88W77DQJ',
  'user_01M05YW1DGVVYHT018EKSWX6XY', 'user_01M05YX2F07VZ90ZKFJ0QF43A5',
  'user_01M05ZXE2JRGH4DECZ1RM4AGEQ',
];

// ── 1. organization_members full data ──
console.log('--- Organization memberships for WorkOS users ---');
const { data: orgMembers } = await supabase
  .from('organization_members')
  .select('*')
  .in('user_id', WORKOS_IDS);
console.log(`Found ${orgMembers?.length ?? 0} org memberships`);
if (orgMembers && orgMembers.length > 0) {
  for (const m of orgMembers) {
    console.log(`  user_id=${m.user_id}, org_role=${m.role || m.org_role}, is_active=${m.is_active}, raw:`, JSON.stringify(m));
  }
}

// ── 2. Schools referenced by school_members ──
console.log('\n--- Schools referenced by WorkOS users ---');
const { data: sm } = await supabase
  .from('school_members')
  .select('*')
  .in('user_id', WORKOS_IDS);
if (sm && sm.length > 0) {
  const schoolIds = [...new Set(sm.map((m) => m.school_id))];
  for (const sid of schoolIds) {
    const { data: school, error } = await supabase
      .from('schools')
      .select('*')
      .eq('id', sid)
      .maybeSingle();
    if (school) {
      console.log(`School ${sid}: name="${school.name}", created_at=${school.created_at}, plan=${school.plan || school.tier}, raw:`, JSON.stringify(school));
    } else {
      console.log(`School ${sid}: not found or error: ${error?.message}`);
    }
  }
}

// ── 3. Check if schools are test-only (no other users) ──
console.log('\n--- School usage analysis ---');
for (const sid of sm?.map((m) => m.school_id) ?? []) {
  const { count: memberCount } = await supabase
    .from('school_members')
    .select('*', { count: 'exact', head: true })
    .eq('school_id', sid);
  console.log(`School ${sid}: ${memberCount} total members`);
}

// ── 4. Column discovery for onboarding_progress ──
console.log('\n--- onboarding_progress schema discovery ---');
const { data: onBoardSample, error: obErr } = await supabase
  .from('onboarding_progress')
  .select('*')
  .limit(2);
if (onBoardSample && onBoardSample.length > 0) {
  console.log('Columns:', Object.keys(onBoardSample[0]));
} else {
  console.log('No rows or error:', obErr?.message || 'no data');
  // Try to discover columns via a failed query with unknown column
  const { error: err2 } = await supabase.from('onboarding_progress').select('id');
  console.log(`Has 'id' column: ${!err2}`);
}

// ── 5. Column discovery for kyc_records ──
console.log('\n--- kyc_records schema discovery ---');
const { data: kycSample, error: kycErr } = await supabase
  .from('kyc_records')
  .select('*')
  .limit(2);
if (kycSample && kycSample.length > 0) {
  console.log('Columns:', Object.keys(kycSample[0]));
} else {
  console.log('No rows or error:', kycErr?.message || 'no data');
}

// ── 6. Check payment tables for WorkOS ID references ──
console.log('\n--- Payment table reference checks ---');
const PAYMENT_TABLES = [
  'payments', 'payment_accounts', 'billing_profiles', 'billing_snapshots',
  'student_charges', 'invoices', 'financial_ledger_entries',
  'financial_journals', 'financial_transactions', 'settlements',
];
const USER_REF_COLS = ['user_id', 'created_by', 'updated_by', 'owner_id', 'approved_by', 'processed_by', 'actor_id', 'requested_by', 'verified_by'];

for (const table of PAYMENT_TABLES) {
  for (const col of USER_REF_COLS) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select(col)
        .in(col, WORKOS_IDS);
      if (!error && data && data.length > 0) {
        console.log(`FOUND: ${table}.${col} — ${data.length} references to WorkOS IDs`);
      }
    } catch {
      // column doesn't exist or table doesn't exist
    }
  }
}

// ── 7. Check DVA tables ──
console.log('\n--- DVA table reference checks ---');
const DVA_TABLES = ['dva_records', 'dva_audit'];
for (const table of DVA_TABLES) {
  for (const col of USER_REF_COLS) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select(col)
        .in(col, WORKOS_IDS);
      if (!error && data && data.length > 0) {
        console.log(`FOUND: ${table}.${col} — ${data.length} references`);
      }
    } catch {
      // table/column doesn't exist
    }
  }
}

// ── 8. Check other user-related tables ──
console.log('\n--- Other table reference checks ---');
const OTHER_TABLES = ['students', 'classes', 'fees', 'guardians', 'guardian_students', 'sessions', 'invitations', 'audit_logs', 'roles'];
for (const table of OTHER_TABLES) {
  for (const col of USER_REF_COLS) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select(col)
        .in(col, WORKOS_IDS);
      if (!error && data && data.length > 0) {
        console.log(`FOUND: ${table}.${col} — ${data.length} references`);
      }
    } catch {
      // doesn't exist
    }
  }
}

// ── 9. Check audit_logs for any WorkOS reference ──
// The actor_id column is UUID type (confirmed earlier) so WorkOS IDs can't fit.
// But let's also check if audit_logs has a text-based reference column.
console.log('\n--- audit_logs full scan ---');
try {
  const { data: auditSample, error: auditErr } = await supabase
    .from('audit_logs')
    .select('*')
    .limit(3);
  if (auditSample && auditSample.length > 0) {
    console.log('audit_logs columns:', Object.keys(auditSample[0]));
  }
} catch {
  console.log('audit_logs not accessible');
}

// ── 10. Summary counts ──
console.log('\n--- Summary ---');
const { count: usersCount } = await supabase.from('users').select('*', { count: 'exact', head: true });
const { count: workosCount } = await supabase.from('users').select('*', { count: 'exact', head: true }).like('id', 'user_%');
const { count: profilesCount } = await supabase.from('user_profiles').select('*', { count: 'exact', head: true });
const { count: smCount } = await supabase.from('school_members').select('*', { count: 'exact', head: true });
const { count: orgCount } = await supabase.from('organization_members').select('*', { count: 'exact', head: true });

console.log(`Total public.users: ${usersCount ?? 0}`);
console.log(`WorkOS users: ${workosCount ?? 0}`);
console.log(`Total user_profiles: ${profilesCount ?? 0}`);
console.log(`Total school_members: ${smCount ?? 0}`);
console.log(`Total organization_members: ${orgCount ?? 0}`);

// Count WorkOS references in each key table
const { count: upWorkos } = await supabase.from('user_profiles').select('*', { count: 'exact', head: true }).in('user_id', WORKOS_IDS);
const { count: smWorkos } = await supabase.from('school_members').select('*', { count: 'exact', head: true }).in('user_id', WORKOS_IDS);
const { count: omWorkos } = await supabase.from('organization_members').select('*', { count: 'exact', head: true }).in('user_id', WORKOS_IDS);
const { count: profWorkos } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).in('user_id', WORKOS_IDS);

console.log(`WorkOS refs in user_profiles: ${upWorkos ?? 0}`);
console.log(`WorkOS refs in school_members: ${smWorkos ?? 0}`);
console.log(`WorkOS refs in organization_members: ${omWorkos ?? 0}`);
console.log(`WorkOS refs in profiles (legacy): ${profWorkos ?? 0}`);

console.log('\n=== Extended Audit Complete ===');
