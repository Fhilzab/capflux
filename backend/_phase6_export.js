/**
 * Phase 6 — Export all data for rollback artifact
 * Exports all rows that will be deleted during the purge.
 */
import 'dotenv/config';
import { supabase } from './supabaseClient.js';
import { writeFileSync } from 'node:fs';

console.log('=== Phase 6: Rollback Data Export ===\n');

// ── 1. Export the 21 WorkOS users ──
const WORKOS_IDS = [];
let start = 0;
const batchSize = 1000;
while (true) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .like('id', 'user_%')
    .range(start, start + batchSize - 1);
  if (error) break;
  if (!data || data.length === 0) break;
  for (const row of data) WORKOS_IDS.push(row.id);
  if (data.length < batchSize) break;
  start += batchSize;
}
console.log(`WorkOS IDs: ${WORKOS_IDS.length}`);

// Export all 21 users (batch to stay within IN clause limits)
const allUserData = [];
for (let i = 0; i < WORKOS_IDS.length; i += 10) {
  const batch = WORKOS_IDS.slice(i, i + 10);
  const { data } = await supabase.from('users').select('*').in('id', batch);
  if (data) allUserData.push(...data);
}
console.log(`Users exported: ${allUserData.length}`);

// Export all 21 user_profiles
const allProfileData = [];
for (let i = 0; i < WORKOS_IDS.length; i += 10) {
  const batch = WORKOS_IDS.slice(i, i + 10);
  const { data } = await supabase.from('user_profiles').select('*').in('user_id', batch);
  if (data) allProfileData.push(...data);
}
console.log(`User profiles exported: ${allProfileData.length}`);

// Export school_members for the 2 WorkOS users
const { data: smData } = await supabase.from('school_members').select('*').in('user_id', WORKOS_IDS);
console.log(`School memberships exported: ${smData?.length ?? 0}`);

// Export organization_members for the 2 WorkOS users
const { data: omData } = await supabase.from('organization_members').select('*').in('user_id', WORKOS_IDS);
console.log(`Organization memberships exported: ${omData?.length ?? 0}`);

// Export schools with WorkOS owner_user_id
const { data: schoolsData } = await supabase.from('schools').select('*').in('owner_user_id', WORKOS_IDS);
console.log(`Schools with WorkOS owner: ${schoolsData?.length ?? 0}`);

// Export organizations with WorkOS owner_user_id
const { data: orgsData } = await supabase.from('organizations').select('*').in('owner_user_id', WORKOS_IDS);
console.log(`Organizations with WorkOS owner: ${orgsData?.length ?? 0}`);

// ── 2. Generate rollback SQL ──
function genInserts(tableName, rows, pkCol) {
  if (!rows || rows.length === 0) return `-- No rows for ${tableName}`;

  const allCols = new Set();
  for (const row of rows) {
    for (const col of Object.keys(row)) {
      allCols.add(col);
    }
  }
  const cols = Array.from(allCols);
  const sqlLines = [`-- Rollback: ${tableName} (${rows.length} rows)`];

  for (const row of rows) {
    const values = cols.map((col) => {
      const val = row[col];
      if (val === null || val === undefined) return 'NULL';
      if (typeof val === 'boolean') return val ? 'true' : 'false';
      if (typeof val === 'number') return String(val);
      if (typeof val === 'object') return `'${JSON.stringify(val)}'`;
      // Escape single quotes
      return `'${String(val).replace(/'/g, "''")}'`;
    });
    sqlLines.push(
      `INSERT INTO ${tableName} (${cols.join(', ')}) VALUES (${values.join(', ')}) ` +
      `ON CONFLICT (${pkCol || cols[0]}) DO UPDATE SET ` +
      cols.filter(c => c !== (pkCol || cols[0])).map(c => `${c} = EXCLUDED.${c}`).join(', ') +
      ';'
    );
  }
  return sqlLines.join('\n');
}

const rollbackSQL = `-- ============================================================
-- Phase 6 Rollback Artifact
-- Generated: ${new Date().toISOString()}
-- Purpose: Restore all data deleted during the WorkOS test identity purge
-- ============================================================

-- ── 1. users (21 WorkOS test identities) ──
${genInserts('public.users', allUserData, 'id')}

-- ── 2. user_profiles (21 profile records) ──
${genInserts('public.user_profiles', allProfileData, 'user_id')}

-- ── 3. school_members (2 membership records) ──
${genInserts('public.school_members', smData, 'user_id')}

-- ── 4. organization_members (2 org membership records) ──
${genInserts('public.organization_members', omData, 'user_id')}

-- ── 5. schools owner_user_id restoration ──
DO $$
BEGIN
${schoolsData && schoolsData.length > 0
  ? schoolsData.map(s =>
    `  IF EXISTS (SELECT 1 FROM schools WHERE id = '${s.id}' AND owner_user_id IS NULL) THEN
    UPDATE schools SET owner_user_id = '${s.owner_user_id}' WHERE id = '${s.id}';
  END IF;`
  ).join('\n')
  : '  -- No school owner_user_id changes needed'}
END $$;

-- ── 6. organizations owner_user_id restoration ──
DO $$
BEGIN
${orgsData && orgsData.length > 0
  ? orgsData.map(o =>
    `  IF EXISTS (SELECT 1 FROM organizations WHERE id = '${o.id}' AND owner_user_id IS NULL) THEN
    UPDATE organizations SET owner_user_id = '${o.owner_user_id}' WHERE id = '${o.id}';
  END IF;`
  ).join('\n')
  : '  -- No organization owner_user_id changes needed'}
END $$;

-- ============================================================
-- End of rollback
-- ============================================================`;

const rollbackPath = './docs/auth-phase6-purge-rollback.sql';
try {
  writeFileSync(rollbackPath, rollbackSQL);
  console.log(`\nRollback artifact written to: ${rollbackPath}`);
  console.log(`Rollback artifact size: ${rollbackSQL.length} bytes`);
} catch (e) {
  console.log(`Error writing rollback: ${e.message}`);
  console.log('Writing to scratchpad instead...');
}

// Also dump all data to JSON for reference
const dump = {
  workosUserIds: WORKOS_IDS,
  users: allUserData,
  userProfiles: allProfileData,
  schoolMembers: smData || [],
  organizationMembers: omData || [],
  schoolsWithWorkosOwner: schoolsData || [],
  organizationsWithWorkosOwner: orgsData || [],
  exportTimestamp: new Date().toISOString(),
};

console.log('\n--- Data Summary ---');
console.log(`WorkOS user IDs: ${WORKOS_IDS.length}`);
console.log(`Users to delete: ${allUserData.length}`);
console.log(`User profiles to delete: ${allProfileData.length}`);
console.log(`School memberships to delete: ${smData?.length ?? 0}`);
console.log(`Organization memberships to delete: ${omData?.length ?? 0}`);
console.log(`Schools with owner_user_id to NULLify: ${schoolsData?.length ?? 0}`);
console.log(`Organizations with owner_user_id to NULLify: ${orgsData?.length ?? 0}`);

// Print user details for classification
console.log('\n--- User Details (21 WorkOS users) ---');
for (let i = 0; i < allUserData.length; i++) {
  const u = allUserData[i];
  const profile = allProfileData.find(p => p.user_id === u.id);
  const sm = smData?.find(s => s.user_id === u.id);
  const om = omData?.find(o => o.user_id === u.id);
  console.log(`${i + 1}. id=${u.id}`);
  console.log(`   email=${u.email}, auth_provider=${u.auth_provider}`);
  console.log(`   profile: ${profile ? 'exists' : 'missing'}`);
  console.log(`   school_members: ${sm ? `school_id=${sm.school_id}, role_id=${sm.role_id}` : 'none'}`);
  console.log(`   organization_members: ${om ? `org_id=${om.organization_id}` : 'none'}`);
}

console.log('\n=== Export Complete ===');
