/**
 * Phase 6 — Complete schema inspection and WorkOS ID reference search
 * Uses PostgREST OpenAPI schema to discover all tables/columns,
 * then queries every table for WorkOS ID references.
 */
import 'dotenv/config';
import { supabase } from './supabaseClient.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;

console.log('=== Phase 6: Complete Schema & Reference Audit ===\n');

// ── 1. Fetch OpenAPI schema ──
const resp = await fetch(`${SUPABASE_URL}/rest/v1/`, {
  headers: {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    Accept: 'application/openapi+json',
  },
});
const openapi = await resp.json();

// Extract table definitions
const tableDefs = {};
for (const [path, methods] of Object.entries(openapi.paths || {})) {
  if (path === '/' || path.includes('{')) continue;
  const tableName = path.replace(/^\//, '');
  for (const [method, spec] of Object.entries(methods)) {
    if (method.toLowerCase() === 'get' && spec.parameters) {
      const cols = {};
      for (const p of spec.parameters) {
        if (p.in === 'query' && p.name.startsWith('select=') === false && p.name !== 'select' && p.name !== 'order' && p.name !== 'limit' && p.name !== 'offset' && p.name !== 'single' && p.name !== 'head' && p.name !== 'csv' && p.name !== 'exact') {
          // Column name is the parameter name, type from description
          if (p.schema) {
            cols[p.name] = p.schema.type || 'unknown';
          } else if (p.description) {
            cols[p.name] = p.description;
          }
        }
      }
      if (Object.keys(cols).length > 0) {
        tableDefs[tableName] = cols;
      }
    }
  }
}

console.log(`Discovered ${Object.keys(tableDefs).length} tables with column info`);

// Find all columns that might reference user IDs
const USER_REF_PATTERNS = ['user_id', 'created_by', 'updated_by', 'owner_id', 'invited_by',
  'approved_by', 'processed_by', 'performed_by', 'actor_id', 'created_by_user_id',
  'requested_by', 'verified_by', 'owner_user_id', 'updated_by_user_id',
  'requested_by_user_id', 'performed_by_user_id', 'author_id', 'assigned_to'];

const potentialUserRefColumns = [];
for (const [table, cols] of Object.entries(tableDefs)) {
  for (const [col, type] of Object.entries(cols)) {
    if (USER_REF_PATTERNS.includes(col)) {
      potentialUserRefColumns.push({ table, column: col, type });
    }
  }
}

console.log(`\nFound ${potentialUserRefColumns.length} potential user-reference columns:`);
for (const { table, column, type } of potentialUserRefColumns) {
  console.log(`  ${table}.${column} (${type})`);
}

// ── 2. Get the 21 WorkOS IDs ──
const WORKOS_IDS = [];
let start = 0;
const batchSize = 1000;
while (true) {
  const { data, error } = await supabase
    .from('users')
    .select('id')
    .like('id', 'user_%')
    .range(start, start + batchSize - 1);
  if (error) { console.log('Error:', error.message); break; }
  if (!data || data.length === 0) break;
  for (const row of data) WORKOS_IDS.push(row.id);
  if (data.length < batchSize) break;
  start += batchSize;
}

console.log(`\n${WORKOS_IDS.length} WorkOS IDs to check`);

// ── 3. Search ALL potential user-ref columns for WorkOS IDs ──
console.log('\n--- Scanning all tables for WorkOS ID references ---');
const allReferences = {};
const inBatchSize = 10;

for (const { table, column, type } of potentialUserRefColumns) {
  // Batch query in groups of 10 (Supabase IN clause limit)
  for (let i = 0; i < WORKOS_IDS.length; i += inBatchSize) {
    const batch = WORKOS_IDS.slice(i, i + inBatchSize);
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true })
        .in(column, batch);
      if (!error && data && data.length > 0) {
        if (!allReferences[table]) allReferences[table] = {};
        if (!allReferences[table][column]) allReferences[table][column] = 0;
        allReferences[table][column] += data.length;
        console.log(`FOUND: ${table}.${column} — ${data.length} references (batch ${i/batchSize + 1})`);
      }
    } catch (e) {
      // Column doesn't exist or other error
    }
  }
}

// ── 4. Also check schools.owner_user_id specifically ──
console.log('\n--- Checking schools for owner_user_id references ---');
const { data: schools } = await supabase
  .from('schools')
  .select('*')
  .in('owner_user_id', WORKOS_IDS);
console.log(`Schools with WorkOS owner_user_id: ${schools?.length ?? 0}`);
if (schools && schools.length > 0) {
  for (const s of schools) {
    console.log(`  School ${s.id}: name="${s.name}", owner_user_id=${s.owner_user_id}`);
  }
}

// Check if schools.owner_user_id has a FK constraint by trying to set it to NULL
console.log('\n--- Checking schools.owner_user_id FK constraint ---');
if (schools && schools.length > 0) {
  for (const s of schools) {
    const { error: updErr } = await supabase
      .from('schools')
      .update({ owner_user_id: null })
      .eq('id', s.id);
    if (updErr) {
      console.log(`  Cannot NULLify owner_user_id for school ${s.id}: ${updErr.message}`);
      // Try restoring
      await supabase.from('schools').update({ owner_user_id: s.owner_user_id }).eq('id', s.id);
    } else {
      console.log(`  OK: owner_user_id can be NULL for school ${s.id}`);
      // Restore immediately (we're just testing, actual purge will do this)
      await supabase.from('schools').update({ owner_user_id: s.owner_user_id }).eq('id', s.id);
    }
  }
} else {
  console.log('  No schools with WorkOS owner_user_id found');
}

// ── 5. Check organizations for owner_user_id references ──
console.log('\n--- Checking organizations for WorkOS references ---');
const orgColumns = tableDefs['organizations'] || {};
console.log('  organizations columns:', Object.keys(orgColumns).slice(0, 20));
for (const col of ['owner_user_id', 'created_by', 'user_id', 'owner_id']) {
  try {
    const { data: orgs, error } = await supabase
      .from('organizations')
      .select('id,name,organization_id')
      .in(col, WORKOS_IDS);
    if (!error && orgs && orgs.length > 0) {
      console.log(`  FOUND: organizations.${col} — ${orgs.length} references`);
      orgs.forEach((o) => console.log(`    Org ${o.id}: name="${o.name}"`));
    }
  } catch (e) {
    // column doesn't exist
  }
}

// ── 6. Check for orphaned rows in key tables ──
console.log('\n--- Orphan and dependency summary ---');

// Count all dependent rows for each WorkOS user
const totalRefs = {};
totalRefs['user_profiles'] = 0;
totalRefs['school_members'] = 0;
totalRefs['organization_members'] = 0;

for (let i = 0; i < WORKOS_IDS.length; i += inBatchSize) {
    const batch = WORKOS_IDS.slice(i, i + inBatchSize);
  for (const table of ['user_profiles', 'school_members', 'organization_members']) {
    const { count } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })
      .in('user_id', batch);
    totalRefs[table] = (totalRefs[table] || 0) + (count || 0);
  }
}

console.log('Delete summary (rows to be removed):');
console.log(`  user_profiles: ${totalRefs['user_profiles']} (1:1 with WorkOS users)`);
console.log(`  school_members: ${totalRefs['school_members']} (memberships of WorkOS users)`);
console.log(`  organization_members: ${totalRefs['organization_members']} (org memberships)`);
console.log(`  users: ${WORKOS_IDS.length} (the WorkOS users themselves)`);

// ── 7. Check if auth.users exists via admin API ──
console.log('\n--- Final auth.users check ---');
try {
  const { data: authData, error: authErr } = await supabase.auth.admin.listUsers();
  console.log(`auth.users total: ${authData?.users?.length ?? 'unknown'}`);
  console.log(`auth.users error: ${authErr?.message || 'none'}`);
} catch (e) {
  console.log(`auth.admin.listUsers error: ${e.message}`);
}

console.log('\n=== Complete Audit Finished ===');
