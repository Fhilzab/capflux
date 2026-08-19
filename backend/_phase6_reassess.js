/**
 * Phase 6 — Post-purge reassessment + SQL execution attempt
 *
 * 1. Verify remaining users are valid UUIDs
 * 2. Check column types via PostgREST OpenAPI
 * 3. Re-run safety checks for UUID conversion
 * 4. Attempt SQL execution via RPC for migration
 */
import 'dotenv/config';
import { supabase } from './supabaseClient.js';

console.log('=== Phase 6: Post-Purge Reassessment ===\n');

// ── 1. Verify remaining users ──
const { data: users, count: userCount } = await supabase
  .from('users').select('*', { count: 'exact' });
console.log(`Remaining public.users: ${userCount}`);
if (users) {
  for (const u of users) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(u.id);
    console.log(`  id=${u.id} email=${u.email} provider=${u.auth_provider} isUuid=${isUuid}`);
  }
}

// ── 2. Check school_members (should be empty) ──
const { count: smCount } = await supabase
  .from('school_members').select('*', { count: 'exact', head: true });
console.log(`\nRemaining school_members: ${smCount}`);

// ── 3. Check user_profiles ──
const { count: upCount } = await supabase
  .from('user_profiles').select('*', { count: 'exact', head: true });
console.log(`Remaining user_profiles: ${upCount}`);

// ── 4. UUID safety check on remaining data ──
console.log('\n--- UUID Safety Check (Post-Purge) ---');
let invalid = 0;
if (users) {
  for (const u of users) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(u.id)) {
      invalid++;
      console.log(`  INVALID UUID: ${u.id}`);
    }
  }
}
console.log(`Invalid UUIDs in public.users: ${invalid} (expected: 0)`);

// Also check user_profiles.user_id
const { data: upCheck } = await supabase.from('user_profiles').select('user_id');
let invalidUp = 0;
if (upCheck) {
  for (const p of upCheck) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(p.user_id)) {
      invalidUp++;
    }
  }
}
console.log(`Invalid UUIDs in user_profiles.user_id: ${invalidUp} (expected: 0)`);

// ── 5. Check auth.users count ──
const { data: authData } = await supabase.auth.admin.listUsers();
const authCount = authData?.users?.length ?? 0;
console.log(`\nauth.users count: ${authCount} (expected: 0)`);

// ── 6. Check existing schools ──
const { data: allSchools } = await supabase.from('schools').select('id, name, owner_user_id, is_active');
console.log(`\nAll schools: ${allSchools?.length ?? 0}`);
if (allSchools && allSchools.length > 0) {
  for (const s of allSchools) {
    console.log(`  ${s.id} "${s.name}" owner=${s.owner_user_id} active=${s.is_active}`);
  }
}

// ── 7. Check existing organizations ──
const { data: allOrgs } = await supabase.from('organizations').select('id, name, owner_user_id');
console.log(`\nAll organizations: ${allOrgs?.length ?? 0}`);
if (allOrgs && allOrgs.length > 0) {
  for (const o of allOrgs) {
    console.log(`  ${o.id} "${o.name}" owner=${o.owner_user_id}`);
  }
}

// ── 8. Check remaining user_profiles ──
const { data: remainingProfiles } = await supabase.from('user_profiles').select('*');
console.log(`\nRemaining user_profiles: ${remainingProfiles?.length ?? 0}`);
if (remainingProfiles && remainingProfiles.length > 0) {
  console.log('Profile data:', JSON.stringify(remainingProfiles, null, 2));
}

// ── 9. Try to determine column types ──
// PostgREST might expose column type info via a HEAD request
console.log('\n--- Column type inference ---');
// If a table accepts a UUID-format string, we can't tell if it's UUID or TEXT
// But we can check by trying an invalid operation

// ── 10. Try SQL execution via common RPC names ──
console.log('\n--- RPC SQL execution attempts ---');
const rpcNames = ['exec', 'sql', 'run_sql', 'query', 'execute_sql'];
for (const name of rpcNames) {
  const { error } = await supabase.rpc(name, { sql: 'SELECT 1' });
  if (error) {
    if (error.message.includes('not found') || error.message.includes('does not exist')) {
      console.log(`  ${name}: function does not exist`);
    } else {
      console.log(`  ${name}: exists but error: ${error.message}`);
    }
  } else {
    console.log(`  ${name}: EXISTS and works!`);
  }
}

// ── 11. Check if schema_migrations table is accessible ──
console.log('\n--- Migration history check ---');
for (const table of ['schema_migrations', '_schema_migrations', 'migrations', '_migrations', 'supabase_migrations', 'pg_migrations']) {
  try {
    const { data, error } = await supabase.from(table).select('*').limit(5);
    if (error) {
      console.log(`  ${table}: ${error.message.substring(0, 80)}`);
    } else {
      console.log(`  ${table}: ${data?.length ?? 0} rows`);
    }
  } catch (e) {
    console.log(`  ${table}: not accessible`);
  }
}

console.log('\n=== Reassessment Complete ===');
