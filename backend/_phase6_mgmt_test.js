/**
 * Test Supabase Management API SQL endpoint
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const accessToken = readFileSync(
  resolve(process.env.HOME, '.supabase/access-token'),
  'utf-8'
).trim();

console.log('Access token loaded (length:', accessToken.length, ')');

const projectRef = 'ootrovtrpoztmooiirxo';
const apiBase = 'https://api.supabase.com/v1';

async function execSQL(query) {
  const response = await fetch(`${apiBase}/projects/${projectRef}/sql`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });

  const ct = response.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    const data = await response.json();
    return data;
  }
  const text = await response.text();
  return { raw: text, status: response.status };
}

// Test 1: Simple query
console.log('\n--- Test 1: SELECT 1 ---');
const r1 = await execSQL('SELECT 1 as test');
console.log(JSON.stringify(r1).substring(0, 200));

// Test 2: Check users
console.log('\n--- Test 2: SELECT count(*) FROM users ---');
const r2 = await execSQL('SELECT count(*) FROM public.users');
console.log(JSON.stringify(r2).substring(0, 200));

// Test 3: Check column type
console.log('\n--- Test 3: Check school_members.user_id type ---');
const r3 = await execSQL(`
  SELECT column_name, data_type 
  FROM information_schema.columns 
  WHERE table_schema = 'public' 
    AND table_name = 'school_members' 
    AND column_name = 'user_id'
`);
console.log(JSON.stringify(r3).substring(0, 200));

// Test 4: Check auth.users
console.log('\n--- Test 4: auth.users count ---');
const r4 = await execSQL('SELECT count(*) FROM auth.users');
console.log(JSON.stringify(r4).substring(0, 200));

console.log('\n=== Management API test complete ===');
