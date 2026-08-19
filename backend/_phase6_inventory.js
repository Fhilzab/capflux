/**
 * Phase 6A — Read-Only Identity Inventory
 *
 * Audits all WorkOS-style IDs (user_*) in public.users and traces every
 * database reference to those IDs using the backend's service-role client.
 * Also searches the codebase for hardcoded WorkOS IDs.
 */
import 'dotenv/config';
import { supabase } from './supabaseClient.js';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const PROJECT_ROOT = '/root/workspace/capflux';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/i;

console.log('=== Phase 6A: Read-Only Identity Inventory ===\n');

// ── 1. Discover all tables via PostgREST OpenAPI ──
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;

let allTables = [];
try {
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/`);
  const schema = await resp.json();
  if (schema.paths) {
    allTables = Object.keys(schema.paths)
      .filter((p) => !p.includes('{'))
      .map((p) => p.replace(/^\//, '').replace(/\/$/, ''))
      .filter((p) => p && !p.includes('/'));
  }
  console.log(`Discovered ${allTables.length} tables via OpenAPI`);
} catch (e) {
  console.log('OpenAPI discovery failed:', e.message);
}

// Fallback: known tables from migrations
const KNOWN_TABLES = [
  'users', 'user_profiles', 'school_members', 'profiles',
  'organizations', 'organization_members', 'onboarding_progress',
  'kyc_records', 'roles', 'role_permissions', 'permissions',
  'students', 'classes', 'fees', 'invoices',
  'payment_accounts', 'payments', 'settlements',
  'audit_logs', 'dva_records', 'dva_audit',
  'financial_ledger_entries', 'financial_journals', 'financial_transactions',
  'billing_profiles', 'billing_snapshots', 'student_charges',
  'guardian_students', 'guardians',
  'sessions', 'invitations',
];
const allKnownTables = [...new Set([...allTables, ...KNOWN_TABLES])];
console.log(`Total tables to check: ${allKnownTables.length}`);

// ── 2. Get all 21 WorkOS users ──
console.log('\n--- Step 2: WorkOS users in public.users ---');
const { data: workosUsers, error: usersError } = await supabase
  .from('users')
  .select('id, email, auth_provider, created_at, updated_at')
  .like('id', 'user_%')
  .order('id');

if (usersError) {
  console.log('Error fetching WorkOS users:', usersError.message);
  process.exit(1);
}

console.log(`Found ${workosUsers?.length ?? 0} WorkOS-style IDs in public.users:`);
const userMap = {};
for (const u of workosUsers || []) {
  userMap[u.id] = u;
  console.log(`  ${u.id} | ${u.email} | provider=${u.auth_provider} | created=${u.created_at}`);
}

// ── 3. For each WorkOS user, check all tables for references ──
console.log('\n--- Step 3: Database reference audit ---');
const allWorkosIds = Object.keys(userMap);
const references = {}; // table -> [{column, id}]

for (const table of allKnownTables) {
  try {
    // Get one row to discover column names
    const { data: _, error: probeErr } = await supabase
      .from(table)
      .select('*')
      .limit(0);

    if (probeErr) continue;

    // Try to find all string-like columns by selecting a single row
    const { data: sample, error: sampleErr } = await supabase
      .from(table)
      .select('*')
      .limit(1);

    if (sampleErr || !sample || sample.length === 0) continue;

    // Check each column value against WorkOS IDs
    for (const row of sample) {
      for (const [col, val] of Object.entries(row)) {
        if (typeof val === 'string' && allWorkosIds.includes(val)) {
          if (!references[table]) references[table] = [];
          references[table].push({ column: col, user_id: val, sample_row: row });
        }
      }
    }
  } catch (e) {
    // table doesn't exist or not accessible
  }
}

// More thorough: query each table where WorkOS IDs might appear
// Check specific columns that typically reference user IDs
const USER_REF_COLUMNS = [
  'user_id', 'created_by', 'updated_by', 'owner_id', 'invited_by',
  'approved_by', 'processed_by', 'performed_by', 'actor_id',
  'created_by_user_id', 'school_id' // school_id is not user_id but good to check
];

console.log('\n--- Checking all known tables for user references ---');
for (const table of allKnownTables) {
  for (const col of USER_REF_COLUMNS) {
    try {
      // Try filtering by a WorkOS ID in this column
      if (allWorkosIds.length > 0) {
        const testId = allWorkosIds[0];
        const { data, error } = await supabase
          .from(table)
          .select(col)
          .eq(col, testId);

        if (!error && data && data.length > 0) {
          if (!references[table]) references[table] = [];
          // Get ALL workos IDs in this column
          const fullData = [];
          for (const wid of allWorkosIds) {
            const { data: rows, error: err } = await supabase
              .from(table)
              .select('*')
              .eq(col, wid);
            if (!err && rows) {
              for (const r of rows) fullData.push({ ...r, _found_in_column: col });
            }
          }
          if (fullData.length > 0) {
            references[table].push({
              column: col,
              count: fullData.length,
              sample: fullData[0],
            });
            console.log(`  FOUND: ${table}.${col} — ${fullData.length} references to WorkOS IDs`);
          }
        }
      }
    } catch (e) {
      // Column might not exist in this table
    }
  }
}

// ── 4. Check specific tables that are known to have user references ──
console.log('\n--- Direct checks on key tables ---');

// user_profiles
const { data: profiles, error: profilesErr } = await supabase
  .from('user_profiles')
  .select('*')
  .in('user_id', allWorkosIds);
console.log(`user_profiles referencing WorkOS IDs: ${profiles?.length ?? 0} ${profilesErr ? '(ERROR: ' + profilesErr.message + ')' : ''}`);
if (profiles && profiles.length > 0) {
  for (const p of profiles) console.log(`  user_profiles: user_id=${p.user_id}`);
}

// school_members
const { data: members, error: membersErr } = await supabase
  .from('school_members')
  .select('*')
  .in('user_id', allWorkosIds);
console.log(`school_members referencing WorkOS IDs: ${members?.length ?? 0} ${membersErr ? '(ERROR: ' + membersErr.message + ')' : ''}`);
if (members && members.length > 0) {
  for (const m of members) console.log(`  school_members: user_id=${m.user_id}, school_id=${m.school_id}, role_id=${m.role_id}, is_active=${m.is_active}`);
}

// organization_members
const { data: orgMembers, error: orgErr } = await supabase
  .from('organization_members')
  .select('*')
  .in('user_id', allWorkosIds);
console.log(`organization_members referencing WorkOS IDs: ${orgMembers?.length ?? 0} ${orgErr ? '(ERROR: ' + orgErr.message + ')' : ''}`);

// profiles (legacy)
const { data: legacyProfiles, error: profErr } = await supabase
  .from('profiles')
  .select('*')
  .in('user_id', allWorkosIds);
console.log(`profiles (legacy) referencing WorkOS IDs: ${legacyProfiles?.length ?? 0} ${profErr ? '(ERROR: ' + profErr.message + ')' : ''}`);

// onboarding_progress
const { data: onboarding, error: onboardErr } = await supabase
  .from('onboarding_progress')
  .select('*')
  .in('user_id', allWorkosIds);
console.log(`onboarding_progress referencing WorkOS IDs: ${onboarding?.length ?? 0} ${onboardErr ? '(ERROR: ' + onboardErr.message + ')' : ''}`);

// kyc_records
const { data: kyc, error: kycErr } = await supabase
  .from('kyc_records')
  .select('*')
  .in('user_id', allWorkosIds);
console.log(`kyc_records referencing WorkOS IDs: ${kyc?.length ?? 0} ${kycErr ? '(ERROR: ' + kycErr.message + ')' : ''}`);

// audit_logs
const { data: audits, error: auditErr } = await supabase
  .from('audit_logs')
  .select('*')
  .in('actor_id', allWorkosIds);
console.log(`audit_logs referencing WorkOS IDs (actor_id): ${audits?.length ?? 0} ${auditErr ? '(ERROR: ' + auditErr.message + ')' : ''}`);

// Check for created_by references in audit_logs
const { data: auditCreated, error: acErr } = await supabase
  .from('audit_logs')
  .select('*')
  .in('created_by', allWorkosIds);
console.log(`audit_logs referencing WorkOS IDs (created_by): ${auditCreated?.length ?? 0} ${acErr ? '(ERROR: ' + acErr.message + ')' : ''}`);

// ── 5. Search codebase for WorkOS IDs ──
console.log('\n--- Codebase reference search ---');
for (const wid of allWorkosIds) {
  try {
    const result = require('child_process').execSync(
      `grep -r "${wid}" --include="*.ts" --include="*.js" --include="*.sql" --include="*.json" --include="*.md" -l "${PROJECT_ROOT}/backend" "${PROJECT_ROOT}/frontend" "${PROJECT_ROOT}/supabase" 2>/dev/null || true`,
      { encoding: 'utf-8', timeout: 5000 }
    );
    if (result.trim()) {
      console.log(`WorkOS ID ${wid} found in codebase:`);
      result.trim().split('\n').forEach((line) => console.log(`  ${line}`));
    }
  } catch (e) {
    // not found in code
  }
}

// ── 6. Check auth.users via admin API ──
console.log('\n--- Phase 6C: Supabase Auth status ---');
try {
  const { data: authUsers, error: authErr } = await supabase.auth.admin.listUsers();
  if (authErr) {
    console.log('auth.users query error:', authErr.message);
  } else {
    const authUserCount = authUsers?.users?.length ?? 0;
    console.log(`auth.users row count: ${authUserCount}`);
    if (authUserCount > 0) {
      console.log('WARNING: auth.users is not empty!');
      authUsers.users?.slice(0, 5).forEach((u) => {
        const isWorkos = u.id.startsWith('user_');
        console.log(`  ${u.id} — WorkOS ID: ${isWorkos} — email: ${u.email}`);
      });
    }

    // Check if any WorkOS IDs exist in auth.users
    const workosInAuth = authUsers?.users?.filter((u) => u.id.startsWith('user_')) ?? [];
    console.log(`WorkOS IDs in auth.users: ${workosInAuth.length}`);
  }
} catch (err) {
  console.log('auth.users admin API error:', err.message);
}

// ── 7. Check 2 legacy UUID users ──
console.log('\n--- UUID-format users in public.users ---');
const { data: uuidUsers } = await supabase
  .from('users')
  .select('id, email, auth_provider, created_at')
  .not('id', 'like', 'user_%');
console.log(`Found ${uuidUsers?.length ?? 0} non-WorkOS users:`);
for (const u of uuidUsers || []) {
  console.log(`  ${u.id} | ${u.email} | provider=${u.auth_provider} | created=${u.created_at}`);
  // Check if this UUID exists in school_members
  const { data: sm } = await supabase
    .from('school_members')
    .select('*')
    .eq('user_id', u.id);
  console.log(`    school_members: ${sm?.length ?? 0}`);
}

console.log('\n=== Inventory Complete ===');
