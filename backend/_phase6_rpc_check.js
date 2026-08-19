/**
 * Phase 6 — Try to find a way to run SQL via RPC
 * Checks for common Supabase SQL execution functions.
 */
import 'dotenv/config';
import { supabase } from './supabaseClient.js';

console.log('=== Checking for SQL execution RPCs ===\n');

const rpcFunctions = ['exec', 'sql', 'run_sql', 'exec_sql', 'psql', 'supabase_exec', 'admin_exec'];

for (const fn of rpcFunctions) {
  try {
    const { data, error } = await supabase.rpc(fn, { sql: 'SELECT 1 as test' });
    if (error) {
      console.log(`${fn}: ERROR - ${error.message}`);
    } else {
      console.log(`${fn}: SUCCESS! - ${JSON.stringify(data)}`);
    }
  } catch (e) {
    console.log(`${fn}: THROWN - ${e.message}`);
  }
}

// Also try to get the PostgREST root for table discovery
console.log('\n=== PostgREST root discovery ===');
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;

try {
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  const body = await resp.text();
  console.log(`Status: ${resp.status}`);
  // Try to parse as JSON and extract table names
  try {
    const json = JSON.parse(body);
    if (json.schema || json.openapi) {
      console.log('Has schema/openapi');
    }
    // Print a sample of the response
    const sample = body.substring(0, 500);
    console.log(`Response preview: ${sample}...`);
  } catch {
    console.log(`Response text (${body.length} chars): ${body.substring(0, 200)}`);
  }
} catch (e) {
  console.log(`Fetch failed: ${e.message}`);
}

// Check if we can list tables via the OpenAPI approach
console.log('\n=== Listing available tables ===');
try {
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/`, {
    method: 'GET',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      Accept: 'application/openapi+json',
    },
  });
  const contentType = resp.headers.get('content-type');
  console.log(`Accept: openapi+json → Status: ${resp.status}, Content-Type: ${contentType}`);
  if (contentType && contentType.includes('json')) {
    const json = await resp.json();
    const paths = json.paths || {};
    const tablePaths = Object.keys(paths).filter((p) => !p.includes('{'));
    console.log(`Tables found: ${tablePaths.length}`);
    tablePaths.slice(0, 30).forEach((p) => console.log(`  ${p}`));
  }
} catch (e) {
  console.log(`Failed: ${e.message}`);
}
