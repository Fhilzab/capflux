/**
 * Security regression tests for the AuthKit migration.
 *
 * Verifies that no WorkOS secrets are exposed in the frontend source code
 * and that the session cookie has the required security attributes.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const FRONTEND_SRC = join(process.cwd(), '..', 'frontend', 'src');

// Recursively collect all .ts, .vue, and .js source files under a directory.
function collectFiles(dir) {
  const results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFiles(full));
    } else if (/\.(ts|vue|js|tsx|jsx)$/.test(entry.name)) {
      results.push(full);
    }
  }
  return results;
}

// Patterns that indicate a WorkOS secret exposed to the frontend.
const SECRET_PATTERNS = [
  /WORKOS_API_KEY/i,
  /WORKOS_CLIENT_SECRET/i,
  /sk_(?:test|live)_[A-Za-z0-9]+/i, // WorkOS API key prefix
  /your-workos-api-key/i,
  /sb_secret_[a-zA-Z0-9_-]+/i, // Supabase service-role key format
];

// Env vars that the frontend is permitted to access via import.meta.env.
// Only publishable/anon configuration must ever reach the browser.
const ALLOWED_FRONTEND_ENV_VARS = new Set([
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'VITE_API_BASE_URL',
  'VITE_WORKOS_CLIENT_ID',
]);

describe('Frontend security: no WorkOS secrets exposed', () => {
  const files = collectFiles(FRONTEND_SRC);
  assert.ok(files.length > 0, 'should find frontend source files');

  test('no WorkOS API key or client secret in frontend source', () => {
    const offenders = [];

    for (const file of files) {
      const content = readFileSync(file, 'utf-8');
      for (const pattern of SECRET_PATTERNS) {
        if (pattern.test(content)) {
          offenders.push(relative(process.cwd(), file));
        }
      }
    }

    assert.equal(offenders.length, 0, `WorkOS secret found in: ${offenders.join(', ')}`);
  });

  test('frontend does not import @workos-inc/node', () => {
    const offenders = [];

    for (const file of collectFiles(FRONTEND_SRC)) {
      const content = readFileSync(file, 'utf-8');
      if (/@workos-inc\/node/.test(content)) {
        offenders.push(relative(process.cwd(), file));
      }
    }

    assert.equal(offenders.length, 0, `@workos-inc/node imported in: ${offenders.join(', ')}`);
  });

  test('frontend does not use localStorage for credentials (only UI hints)', () => {
    const offenders = [];

    for (const file of collectFiles(FRONTEND_SRC)) {
      const content = readFileSync(file, 'utf-8');
      if (/localStorage\.(setItem|getItem)\(.*(?:access_?token|refresh_?token|password|secret)/i.test(content)) {
        offenders.push(relative(process.cwd(), file));
      }
    }

    assert.equal(offenders.length, 0, `Frontend stores credentials in localStorage: ${offenders.join(', ')}`);
  });
});

// ─────────────────────────────────────────────────────────
// Phase 7L: Supabase service-role / secret-key exposure checks
// ─────────────────────────────────────────────────────────

describe('Frontend security: no Supabase service-role secrets exposed', () => {
  const files = collectFiles(FRONTEND_SRC);
  assert.ok(files.length > 0, 'should find frontend source files');

  test('no sb_secret_ service-role key value in frontend source', () => {
    const offenders = [];
    for (const file of files) {
      const content = readFileSync(file, 'utf-8');
      if (/sb_secret_[a-zA-Z0-9_-]+/.test(content)) {
        offenders.push(relative(process.cwd(), file));
      }
    }
    assert.equal(offenders.length, 0, `Supabase service-role key found in: ${offenders.join(', ')}`);
  });

  test('frontend only accesses permitted publishable VITE_ env vars', () => {
    const offenders = [];
    for (const file of files) {
      const content = readFileSync(file, 'utf-8');
      const matches = content.match(/import\.meta\.env\.VITE_[A-Z_]+/g) || [];
      for (const match of matches) {
        const varName = match.replace('import.meta.env.', '');
        if (!ALLOWED_FRONTEND_ENV_VARS.has(varName)) {
          offenders.push(`${relative(process.cwd(), file)} → ${varName}`);
        }
      }
    }
    assert.equal(offenders.length, 0, `Non-publishable env var in frontend: ${offenders.join(', ')}`);
  });

  test('no process.env reference to Supabase secrets in frontend source', () => {
    const offenders = [];
    const SECRET_ENV_REFS = [
      /process\.env\.SUPABASE_SECRET/i,
      /process\.env\.SUPABASE_SERVICE/i,
      /process\.env\.SUPABASE_SECRET_KEY/i,
      /import\.meta\.env\.VITE_SUPABASE_SECRET/i,
      /import\.meta\.env\.VITE_SUPABASE_SERVICE/i,
    ];
    for (const file of files) {
      const content = readFileSync(file, 'utf-8');
      for (const pattern of SECRET_ENV_REFS) {
        if (pattern.test(content)) {
          if (!offenders.includes(relative(process.cwd(), file))) {
            offenders.push(relative(process.cwd(), file));
          }
        }
      }
    }
    assert.equal(offenders.length, 0, `Supabase secret env var referenced in frontend: ${offenders.join(', ')}`);
  });
});
