/**
 * Phase 7I — Provisioning Regression
 *
 * Verifies the Supabase Auth provisioning chain remains idempotent and
 * type-consistent after the Phase 6 UUID migration.
 *
 * Identity chain: auth.users.id (UUID) → public.users.id (UUID) → user_profiles.user_id (UUID)
 *
 * The provisioning trigger (handle_new_supabase_user) uses INSERT ... ON CONFLICT
 * DO UPDATE, so repeated Supabase Auth sign-ups or email-confirmation updates
 * never create duplicate public.users or user_profiles rows.
 *
 * This test performs static analysis of migration 027 (the migration that
 * created the provisioning trigger) to confirm idempotency is structurally
 * enforced. It does NOT modify the database.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATIONS_DIR = join(process.cwd(), '..', 'supabase', 'migrations');

/** Read all migration files that relate to Supabase Auth provisioning. */
function readProvisioningMigration() {
  const files = readdirSync(MIGRATIONS_DIR).filter(
    (f) => f.endsWith('supabase_auth_uuid.sql') || f.endsWith('supabase_rls_migration.sql')
  );
  return files.map((f) => readFileSync(join(MIGRATIONS_DIR, f), 'utf-8')).join('\n');
}

describe('Phase 7I: Provisioning idempotency', () => {
  const migrationSQL = readProvisioningMigration();

  describe('trigger idempotency (ON CONFLICT)', () => {
    it('provisioning trigger uses INSERT ... ON CONFLICT DO UPDATE for public.users', () => {
      // ON CONFLICT (id) ensures re-sign-up or re-confirmation does NOT create a duplicate
      assert.match(
        migrationSQL,
        /ON CONFLICT\s*\(\s*id\s*\)\s*DO UPDATE/i,
        'public.users insert must be idempotent (ON CONFLICT DO UPDATE on id)'
      );
    });

    it('provisioning trigger uses INSERT ... ON CONFLICT DO UPDATE for user_profiles', () => {
      // user_profiles.user_id is the PK; ON CONFLICT (user_id) prevents duplicates
      assert.match(
        migrationSQL,
        /ON CONFLICT\s*\(\s*user_id\s*\)\s*DO UPDATE/i,
        'user_profiles insert must be idempotent (ON CONFLICT DO UPDATE on user_id)'
      );
    });

    it('provisioning trigger is AFTER INSERT on auth.users', () => {
      assert.match(
        migrationSQL,
        /AFTER INSERT ON auth\.users/i,
        'trigger fires after new Supabase Auth user is created'
      );
    });

    it('provisioning trigger is AFTER UPDATE OF email_confirmed_at on auth.users', () => {
      assert.match(
        migrationSQL,
        /AFTER UPDATE OF email_confirmed_at ON auth\.users/i,
        'trigger fires when email is confirmed (re-provisions profile)'
      );
    });

    it('delete trigger cascades auth.users → public.users deletion', () => {
      assert.match(
        migrationSQL,
        /AFTER DELETE ON auth\.users/i,
        'delete trigger cascades user removal from auth.users'
      );
    });

    it('delete trigger calls DELETE FROM public.users WHERE id = OLD.id', () => {
      assert.match(
        migrationSQL,
        /DELETE FROM public\.users WHERE id = OLD\.id/i,
        'delete trigger removes the public.users row (cascade to user_profiles via FK)'
      );
    });

    it('trigger function is SECURITY DEFINER with restricted search_path', () => {
      assert.match(
        migrationSQL,
        /SECURITY\s+DEFINER/i,
        'trigger function runs as SECURITY DEFINER'
      );
      assert.match(
        migrationSQL,
        /SET search_path = 'public'/i,
        'trigger function restricts search_path to public'
      );
    });

    it('trigger does NOT create school_members or organization_members', () => {
      // The provisioning trigger should NOT auto-create tenant membership.
      // Extract the trigger function body for inspection.
      const triggerFnMatch = migrationSQL.match(
        /CREATE OR REPLACE FUNCTION public\.handle_new_supabase_user\(\)[\s\S]*?\$\$;/
      );
      assert.ok(triggerFnMatch, 'handle_new_supabase_user function should exist');
      const fnBody = triggerFnMatch[0];

      assert.ok(
        !/INSERT INTO public\.school_members/i.test(fnBody),
        'provisioning must NOT insert into school_members'
      );
      assert.ok(
        !/INSERT INTO public\.organization_members/i.test(fnBody),
        'provisioning must NOT insert into organization_members'
      );
    });
  });

  describe('UUID identity consistency', () => {
    it('all 18 user-reference columns are converted to UUID in migration 027', () => {
      // The migration should ALTER each column TYPE ... USING ...::uuid
      const uuidConversions = migrationSQL.match(/ALTER COLUMN\s+(\w+)\s+TYPE\s+UUID/g) || [];
      assert.ok(uuidConversions.length >= 18, `expected at least 18 UUID column conversions, got ${uuidConversions.length}`);
    });

    it('no auth.uid()::text casts remain in RLS policies (migration 028)', () => {
      const rlsMigration = readFileSync(
        join(MIGRATIONS_DIR, '202607100028_supabase_rls_migration.sql'),
        'utf-8'
      );
      // Strip SQL line comments so we only check actual code, not documentation.
      const codeLines = rlsMigration
        .split('\n')
        .filter((line) => !line.trim().startsWith('--'))
        .join('\n');
      // The old pattern auth.uid()::text is prohibited; policies must use
      // native UUID comparison (auth.uid() = column).
      const uidTextCasts = codeLines.match(/auth\.uid\(\)::text/g) || [];
      assert.equal(uidTextCasts.length, 0, `RLS migration should have 0 auth.uid()::text casts, found ${uidTextCasts.length}`);
    });

    it('RLS policies use native UUID comparison (auth.uid() = column, no casts)', () => {
      const rlsMigration = readFileSync(
        join(MIGRATIONS_DIR, '202607100028_supabase_rls_migration.sql'),
        'utf-8'
      );
      // auth.uid() should be compared directly to UUID columns
      assert.match(rlsMigration, /auth\.uid\(\)\s*=\s*user_id/i, 'user_profiles policy uses native UUID comparison');
      assert.match(rlsMigration, /auth\.uid\(\)\s*=\s*id/i, 'users policy uses native UUID comparison');
    });
  });

  describe('identity chain referential integrity', () => {
    it('user_profiles.user_id foreign key references public.users(id) with CASCADE', () => {
      assert.match(
        migrationSQL,
        /user_profiles_user_id_fkey.*FOREIGN KEY.*user_id.*REFERENCES public\.users\(id\).*ON DELETE CASCADE/is,
        'user_profiles.user_id → users.id with CASCADE'
      );
    });

    it('school_members.user_id foreign key references public.users(id) with CASCADE', () => {
      assert.match(
        migrationSQL,
        /school_members_user_id_fkey.*FOREIGN KEY.*user_id.*REFERENCES public\.users\(id\).*ON DELETE CASCADE/is,
        'school_members.user_id → users.id with CASCADE'
      );
    });
  });
});
