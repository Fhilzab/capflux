/**
 * Try to connect to Supabase PostgreSQL via pg module
 * using various pooler configurations.
 */
import 'dotenv/config';
import pg from 'pg';
const { Client } = pg;

const projectRef = 'ootrovtrpoztmooiirxo';
const serviceRoleKey = process.env.SUPABASE_SECRET_KEY;

if (!serviceRoleKey) {
  console.error('SUPABASE_SECRET_KEY not set');
  process.exit(1);
}

const configs = [
  // Pooler (common Supabase format - EU West 1 for Ireland)
  {
    host: 'aws-0-eu-west-1.pooler.supabase.com',
    port: 5432,
    database: projectRef,
    user: `${projectRef}.database`,
    password: serviceRoleKey,
    ssl: { rejectUnauthorized: false },
    label: 'Pooler EU-West-1',
  },
  // Pooler with project ref as user
  {
    host: `${projectRef}.pooler.supabase.com`,
    port: 5432,
    database: projectRef,
    user: `${projectRef}.database`,
    password: serviceRoleKey,
    ssl: { rejectUnauthorized: false },
    label: 'Pooler project-ref.supabase.com',
  },
  // Direct connection
  {
    host: `db.${projectRef}.supabase.co`,
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: serviceRoleKey,
    ssl: { rejectUnauthorized: false },
    label: 'Direct db host',
  },
  // Pooler with project-ref as user
  {
    host: `aws-0-eu-west-1.pooler.supabase.com`,
    port: 5432,
    database: projectRef,
    user: projectRef,
    password: serviceRoleKey,
    ssl: { rejectUnknown: false, rejectUnauthorized: false },
    label: 'Pooler EU-West-1 (simple user)',
  },
];

for (const config of configs) {
  try {
    console.log(`Trying ${config.label}...`);
    const client = new Client({
      ...config,
      connectionTimeoutMillis: 5000,
    });
    await client.connect();
    const result = await client.query('SELECT version() as v, current_user');
    console.log(`  SUCCESS: ${JSON.stringify(result.rows[0])}`);
    await client.end();
    console.log('  Connection works!');
  } catch (err) {
    console.log(`  FAILED: ${err.message.substring(0, 100)}`);
  }
}

console.log('\nDone.');
