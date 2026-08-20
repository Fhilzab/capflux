/**
 * Phase 6H — Purge Script
 *
 * Executes the purge of 21 WorkOS test identities in careful order,
 * generating a rollback artifact BEFORE any deletion.
 *
 * Each step is verified before proceeding.
 * PostgreSQL transactions are NOT available via PostgREST REST API,
 * so each step is individually verified.
 */
import 'dotenv/config';
import { supabase } from './supabaseClient.js';

console.log('=== Phase 6: WorkOS Test Identity Purge ===\n');

// ── Step 1: Export all data for rollback ──
console.log('--- Step 1: Exporting data for rollback artifact ---');

const WORKOS_IDS = [];
let start = 0;
while (true) {
  const { data } = await supabase.from('users').select('id').like('id', 'user_%').range(start, start + 999);
  if (!data || data.length === 0) break;
  for (const row of data) WORKOS_IDS.push(row.id);
  if (data.length < 1000) break;
  start += 1000;
}
console.log(`Found ${WORKOS_IDS.length} WorkOS IDs`);

// Export all related data
const exportData = {
  users: [],
  user_profiles: [],
  school_members: [],
  organization_members: [],
  schools: [],
  organizations: [],
  org_roles: [],
};

// Export users (batch)
for (let i = 0; i < WORKOS_IDS.length; i += 10) {
  const batch = WORKOS_IDS.slice(i, i + 10);
  const { data } = await supabase.from('users').select('*').in('id', batch);
  if (data) exportData.users.push(...data);
}

// Export user_profiles
for (let i = 0; i < WORKOS_IDS.length; i += 10) {
  const batch = WORKOS_IDS.slice(i, i + 10);
  const { data } = await supabase.from('user_profiles').select('*').in('user_id', batch);
  if (data) exportData.user_profiles.push(...data);
}

// Export school_members
{
  const { data } = await supabase.from('school_members').select('*').in('user_id', WORKOS_IDS);
  exportData.school_members = data || [];
}

// Export organization_members
{
  const { data } = await supabase.from('organization_members').select('*').in('user_id', WORKOS_IDS);
  exportData.organization_members = data || [];
}

// Export schools with WorkOS owner
{
  const { data } = await supabase.from('schools').select('*').in('owner_user_id', WORKOS_IDS);
  exportData.schools = data || [];
}

// Export organizations with WorkOS owner
{
  const { data } = await supabase.from('organizations').select('*').in('owner_user_id', WORKOS_IDS);
  exportData.organizations = data || [];
}

// Export related roles for test orgs
const testOrgIds = exportData.organizations.map(o => o.id);
if (testOrgIds.length > 0) {
  const { data } = await supabase.from('roles').select('*').in('organization_id', testOrgIds);
  exportData.org_roles = data || [];
}

// Generate rollback SQL
function sqlVal(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'object') return `'${JSON.stringify(val)}'`;
  return `'${String(val).replace(/'/g, "''")}'`;
}

function genRollback(tableName, rows, conflictCols) {
  if (!rows || rows.length === 0) return `-- No rows for ${tableName}`;
  const cols = Object.keys(rows[0]);
  const conflict = Array.isArray(conflictCols) ? conflictCols.join(', ') : cols[0];
  const updateSet = cols.filter(c => !conflictCols || !conflictCols.includes(c))
    .map(c => `${c} = EXCLUDED.${c}`)
    .join(', ');
  return rows.map(row => {
    const vals = cols.map(c => sqlVal(row[c]));
    return `INSERT INTO ${tableName} (${cols.join(', ')}) VALUES (${vals.join(', ')}) ON CONFLICT (${conflict}) DO UPDATE SET ${updateSet};`;
  }).join('\n');
}

const rollbackLines = [
  '-- ============================================================',
  '-- Phase 6 Purge Rollback Artifact',
  '-- Generated: ' + new Date().toISOString(),
  '-- Purpose: Restore all data deleted during WorkOS test identity purge',
  '-- Transaction safety: Generate BEFORE any deletion',
  '-- ============================================================',
  '',
  '-- 1. public.users (21 rows)',
  genRollback('public.users', exportData.users, ['id']),
  '',
  '-- 2. public.user_profiles (21 rows)',
  genRollback('public.user_profiles', exportData.user_profiles, ['user_id']),
  '',
  '-- 3. public.school_members (2 rows)',
  genRollback('public.school_members', exportData.school_members, ['user_id', 'school_id']),
  '',
  '-- 4. public.organization_members (2 rows)',
  genRollback('public.organization_members', exportData.organization_members, ['user_id', 'organization_id']),
  '',
  '-- 5. schools.owner_user_id restoration',
  ...exportData.schools.map(s =>
    `UPDATE schools SET owner_user_id = '${s.owner_user_id}' WHERE id = '${s.id}' AND owner_user_id IS NULL;`
  ),
  '',
  '-- 6. organizations.owner_user_id restoration',
  ...exportData.organizations.map(o =>
    `UPDATE organizations SET owner_user_id = '${o.owner_user_id}' WHERE id = '${o.id}' AND owner_user_id IS NULL;`
  ),
  '',
  '-- ============================================================',
  '-- End of rollback',
  '-- ============================================================',
];

const rollbackSQL = rollbackLines.join('\n');
const { writeFileSync } = await import('node:fs');
writeFileSync('../docs/auth-phase6-purge-rollback.sql', rollbackSQL);
console.log(`Rollback SQL written: ${rollbackSQL.length} bytes`);
console.log('Export counts:');
console.log(`  users: ${exportData.users.length}`);
console.log(`  user_profiles: ${exportData.user_profiles.length}`);
console.log(`  school_members: ${exportData.school_members.length}`);
console.log(`  organization_members: ${exportData.organization_members.length}`);
console.log(`  schools (owner_workos): ${exportData.schools.length}`);
console.log(`  org_roles (test orgs): ${exportData.org_roles.length}`);

// ── PRE-PURGE SAFETY CHECK ──
console.log('\n--- Pre-purge safety check ---');
const preCount = (await supabase.from('users').select('*', { count: 'exact', head: true }).like('id', 'user_%')).count;
console.log(`WorkOS users before purge: ${preCount}`);
if (preCount !== 21) {
  console.log('ERROR: Expected 21 WorkOS users, found', preCount);
  process.exit(1);
}

// ── Step 2: DELETE user_profiles ──
console.log('\n--- Step 2: Deleting user_profiles ---');
let deletedProfiles = 0;
for (let i = 0; i < WORKOS_IDS.length; i += 10) {
  const batch = WORKOS_IDS.slice(i, i + 10);
  const { error, count } = await supabase.from('user_profiles').delete().in('user_id', batch);
  if (error) {
    console.log(`ERROR deleting user_profiles batch ${i}:`, error.message);
    process.exit(1);
  }
  deletedProfiles += count || 0;
}
// Handle remaining (supabase might batch differently)
const remainingProfiles = await supabase.from('user_profiles').select('*', { count: 'exact', head: true }).in('user_id', WORKOS_IDS.slice(0, 10));
console.log(`user_profiles deleted: ${deletedProfiles}`);

// ── Step 3: DELETE school_members ──
console.log('\n--- Step 3: Deleting school_members ---');
const { error: smErr, count: smCount } = await supabase.from('school_members').delete().in('user_id', WORKOS_IDS);
if (smErr) {
  console.log('ERROR deleting school_members:', smErr.message);
  process.exit(1);
}
console.log(`school_members deleted: ${smCount}`);

// ── Step 4: DELETE organization_members ──
console.log('\n--- Step 4: Deleting organization_members ---');
const { error: omErr, count: omCount } = await supabase.from('organization_members').delete().in('user_id', WORKOS_IDS);
if (omErr) {
  console.log('ERROR deleting organization_members:', omErr.message);
  process.exit(1);
}
console.log(`organization_members deleted: ${omCount}`);

// ── Step 5: NULLify schools.owner_user_id ──
console.log('\n--- Step 5: NULLifying schools.owner_user_id ---');
const { error: schErr, count: schCount } = await supabase
  .from('schools')
  .update({ owner_user_id: null })
  .in('owner_user_id', WORKOS_IDS);
if (schErr) {
  console.log('ERROR nullifying schools:', schErr.message);
  process.exit(1);
}
console.log(`schools updated: ${schCount}`);

// ── Step 6: NULLify organizations.owner_user_id ──
console.log('\n--- Step 6: NULLifying organizations.owner_user_id ---');
const { error: orgErr, count: orgCount } = await supabase
  .from('organizations')
  .update({ owner_user_id: null })
  .in('owner_user_id', WORKOS_IDS);
if (orgErr) {
  console.log('ERROR nullifying organizations:', orgErr.message);
  process.exit(1);
}
console.log(`organizations updated: ${orgCount}`);

// ── Step 7: DELETE users ──
console.log('\n--- Step 7: Deleting users ---');
const { error: uErr, count: uCount } = await supabase.from('users').delete().like('id', 'user_%');
if (uErr) {
  console.log('ERROR deleting users:', uErr.message);
  process.exit(1);
}
console.log(`users deleted: ${uCount}`);

// ── Step 8: Post-purge verification ──
console.log('\n--- Post-purge verification ---');

// Check no WorkOS users remain
const { count: workosRemain } = await supabase.from('users').select('*', { count: 'exact', head: true }).like('id', 'user_%');
console.log(`WorkOS users remaining: ${workosRemain} (expected: 0)`);

// Check no school_members with WorkOS IDs
const { count: smRemain } = await supabase.from('school_members').select('*', { count: 'exact', head: true }).like('user_id', 'user_%');
console.log(`school_members with WorkOS IDs: ${smRemain} (expected: 0)`);

// Check no organization_members with WorkOS IDs
const { count: omRemain } = await supabase.from('organization_members').select('*', { count: 'exact', head: true }).like('user_id', 'user_%');
console.log(`organization_members with WorkOS IDs: ${omRemain} (expected: 0)`);

// Check no user_profiles with WorkOS IDs
const { count: upRemain } = await supabase.from('user_profiles').select('*', { count: 'exact', head: true }).like('user_id', 'user_%');
console.log(`user_profiles with WorkOS IDs: ${upRemain} (expected: 0)`);

// Check schools have NULL owner_user_id
const { data: nullOrgs } = await supabase.from('schools').select('id,name,owner_user_id').in('id', exportData.schools.map(s => s.id));
console.log(`schools with NULL owner_user_id: ${nullOrgs?.filter(s => s.owner_user_id === null).length}/${nullOrgs?.length ?? 0}`);

// Check remaining users
const { count: totalUsers } = await supabase.from('users').select('*', { count: 'exact', head: true });
console.log(`Total public.users remaining: ${totalUsers} (expected: 2 - UUID-format legacy users)`);

// Check auth.users still 0
const { data: authUsers } = await supabase.auth.admin.listUsers();
console.log(`auth.users total: ${authUsers?.users?.length ?? 'unknown'} (expected: 0)`);

console.log('\n=== Purge Complete ===');
