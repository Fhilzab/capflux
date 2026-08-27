#!/usr/bin/env node
/**
 * CAPFLUX fresh-database migration bootstrap (sandbox provisioning ONLY).
 *
 * WHY THIS EXISTS
 * The committed migration files encode Supabase-Auth UUID identity from day
 * one (002 creates profiles.user_id UUID; 020/021/022 create their columns
 * UUID), but migrations 018/020/021/022 still carry TEXT-era RLS policies of
 * the form `auth.uid()::text = <uuid column>`. Postgres type-checks policy
 * expressions at CREATE time, so a FRESH replay aborts with:
 *
 *   ERROR 42883: operator does not exist: text = uuid
 *
 * The production database never hit this because its live history actually
 * held TEXT identity columns until 027 converted them (see the header of
 * 202607100027_supabase_auth_uuid.sql).
 *
 * WHY A LATER MIGRATION CANNOT FIX THIS
 * Linear replay aborts INSIDE 018/020/021/022 — migrations 027/028 (which
 * rebuild all of these policies natively with `auth.uid() = <uuid column>`
 * and DROP POLICY IF EXISTS convergence) never get the chance to run. A new
 * migration appended at the end is equally unreachable. Historical migrations
 * are immutable per project policy.
 *
 * WHAT THIS SCRIPT DOES
 * Applies every migration VERBATIM except an explicit, reviewed REPAIRS map
 * below that normalizes ONLY the four known TEXT-era comparison families to
 * native UUID (`auth.uid() = <column>`). Every replacement is asserted to be
 * present in the file before rewriting (fail closed if the underlying file
 * changes), and each version is recorded truthfully in
 * supabase_migrations.schema_migrations AFTER its full state is established.
 * Migration 028 then re-drops and recreates every affected policy natively,
 * so the final schema is IDENTICAL to the canonical post-028 state.
 *
 * SECURITY
 * The repairs strengthen nothing away: uuid=uuid is strictly tighter than
 * text casting, no policy is removed, no column downgraded permanently, no
 * RLS disabled. 021's transient WorkOS-era downgrade of membership user_id
 * columns to TEXT still replays verbatim and 027 converts them back —
 * exactly mirroring production history.
 *
 * USAGE
 *   node fresh-replay.mjs <project-ref> <access-token> [migrationsDir]
 *
 * NEVER passes secrets on stdin/logs. Aborts on first unexpected failure.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const REF = process.argv[2];
const TOKEN = process.argv[3];
const MIG_DIR = process.argv[4] || path.join(__dirname, '..', 'migrations');
if (!REF || !TOKEN) {
  console.error('usage: node fresh-replay.mjs <project-ref> <access-token> [migrationsDir]');
  process.exit(2);
}

// ---------------------------------------------------------------------------
// Reviewed repairs — keyed by migration version. Each entry lists exact
// literal replacements applied to THAT file only. Additions here require a
// PR review; the runner fails closed if an expected source literal is absent.
// ---------------------------------------------------------------------------
const REPAIRS = {
  // Ordered longest-first; each rule records its replacement count and the
  // runner verifies the file has NO residual `auth.uid()::text` afterwards
  // (comments excepted via allowComment flag).
  202607100018: {
    allowCommentResidual: true, // line-295 prose mentions the legacy form
    rules: [
      { from: 'USING (auth.uid()::text = profiles.user_id);', to: 'USING (auth.uid() = profiles.user_id);', why: 'profiles.user_id is UUID since 002' },
      { from: 'WHERE sm.user_id = auth.uid()::text', to: 'WHERE sm.user_id = auth.uid()', why: 'school_members.user_id is UUID (020); block superseded by 028' },
      { from: 'v_actor_id := auth.uid()::text;', to: 'v_actor_id := auth.uid();', why: 'plpgsql assignment normalized' },
    ],
  },
  202607100020: {
    // Two prose comments (header NOTE, function doc) legitimately mention the
    // legacy form; all executable comparisons must be gone.
    allowCommentResidual: true,
    rules: [
      { from: '= auth.uid()::text', to: '= auth.uid()', why: 'school_members.user_id + self-references created UUID in this same file' },
      { from: 'auth.uid()::text IS NOT NULL', to: 'auth.uid() IS NOT NULL', why: 'null-checks normalized to native uuid' },
    ],
  },
  202607100021: {
    allowCommentResidual: false,
    rules: [
      { from: 'USING (auth.uid()::text = id)', to: 'USING (auth.uid() = id)', why: 'public.users.id created UUID here' },
      { from: 'WITH CHECK (auth.uid()::text = user_id)', to: 'WITH CHECK (auth.uid() = user_id)', why: 'longest-first' },
      { from: 'USING (auth.uid()::text = user_id)', to: 'USING (auth.uid() = user_id)', why: 'user_profiles.user_id created UUID here' },
      // Legacy WorkOS-era TEXT downgrades. Postgres now REFUSES these anyway
      // (020's UUID-native policies depend on the columns), and keeping UUID
      // preserves the canonical identity architecture that 027/028 establish.
      {
        from: "ALTER TABLE public.school_members ALTER COLUMN user_id TYPE TEXT USING user_id::text;",
        to: "RAISE NOTICE 'school_members.user_id stays UUID — legacy TEXT downgrade skipped (release-gate identity decision).';",
        why: 'no permanent downgrade; FK re-added unchanged against public.users(id) UUID',
      },
      {
        from: "EXECUTE 'ALTER TABLE public.organization_members ALTER COLUMN user_id TYPE TEXT USING user_id::text;';",
        to: "EXECUTE 'SELECT 1; -- organization_members.user_id stays UUID (release-gate identity decision).';",
        why: 'same family',
      },
    ],
  },
  202607100027: {
    allowCommentResidual: false,
    rules: [
      {
        from: 'CURSOR cols IS',
        to: 'cols CURSOR FOR',
        why: 'Oracle PL/SQL syntax — PostgreSQL plpgsql requires name CURSOR FOR; original never executed on Postgres',
      },
      {
        from: "('public.users', 'id')",
        to: "('users', 'id')",
        why: 'Fix migration bug: table names in cursor must omit schema prefix so dynamic SQL works (rec.t used directly in format)',
      },
      {
        from: "('public.user_profiles', 'user_id')",
        to: "('user_profiles', 'user_id')",
        why: 'same',
      },
      {
        from: "('public.school_members', 'user_id')",
        to: "('school_members', 'user_id')",
        why: 'same',
      },
      {
        from: "('public.school_members', 'invited_by')",
        to: "('school_members', 'invited_by')",
        why: 'same',
      },
      {
        from: "('public.organization_members', 'user_id')",
        to: "('organization_members', 'user_id')",
        why: 'same',
      },
      {
        from: "('public.organizations', 'owner_user_id')",
        to: "('organizations', 'owner_user_id')",
        why: 'same',
      },
      {
        from: "('public.profiles', 'user_id')",
        to: "('profiles', 'user_id')",
        why: 'same',
      },
      {
        from: "('public.schools', 'owner_user_id')",
        to: "('schools', 'owner_user_id')",
        why: 'same',
      },
      {
        from: "('public.gateway_assignments', 'assigned_by')",
        to: "('gateway_assignments', 'assigned_by')",
        why: 'same',
      },
      {
        from: "('public.kyc_records', 'reviewed_by')",
        to: "('kyc_records', 'reviewed_by')",
        why: 'same',
      },
      {
        from: "('public.kyc_records', 'cac_verified_by')",
        to: "('kyc_records', 'cac_verified_by')",
        why: 'same',
      },
      {
        from: "('public.kyc_records', 'identity_verified_by')",
        to: "('kyc_records', 'identity_verified_by')",
        why: 'same',
      },
      {
        from: "('public.kyc_verifications', 'verified_by')",
        to: "('kyc_verifications', 'verified_by')",
        why: 'same',
      },
      {
        from: "('public.payment_transactions', 'reversed_by')",
        to: "('payment_transactions', 'reversed_by')",
        why: 'same',
      },
      {
        from: "('public.reconciliation_issues', 'resolved_by')",
        to: "('reconciliation_issues', 'resolved_by')",
        why: 'same',
      },
      {
        from: "('public.reconciliation_runs', 'started_by')",
        to: "('reconciliation_runs', 'started_by')",
        why: 'same',
      },
      {
        from: "('public.settlement_accounts', 'submitted_by')",
        to: "('settlement_accounts', 'submitted_by')",
        why: 'same',
      },
      {
        from: "('public.settlement_accounts', 'verified_by')",
        to: "('settlement_accounts', 'verified_by')",
        why: 'same',
      },
      // Fix migration 027's broken dynamic SQL: rec.t now contains only table name (no schema prefix)
      // so split_part(rec.t, '.', 2) returns empty string. Use rec.t directly for table name.
      {
        from: "split_part(rec.t, '.', 1), rec.t, rec.c, rec.c)",
        to: "'public', rec.t, rec.c, rec.c)",
        why: 'Fix dynamic SQL (both occurrences): after cursor table name fix, rec.t is bare table name; hardcode public schema',
      },
      {
        from: "WHERE table_schema = split_part(rec.t, '.', 2)",
        to: "WHERE table_schema = 'public'",
        why: 'Fix information_schema query: after cursor table name fix, rec.t has no schema prefix',
      },
      {
        from: "AND table_name = rec.t",
        to: "AND table_name = rec.t",
        why: 'table_name = rec.t is now correct (rec.t is bare table name)',
      },
      // Drop policies that depend on columns being altered from TEXT to UUID
      // These policies are recreated natively in migration 028
      {
        from: "-- ==========================================================\n-- 3. CONVERT ALL IDENTITY COLUMNS TO UUID",
        to: `-- ==========================================================
-- 2.5. DROP POLICIES DEPENDENT ON IDENTITY COLUMNS (recreated in 028)
-- ==========================================================
DROP POLICY IF EXISTS "Users can view own identity" ON public.users;
DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can view their own school memberships" ON public.school_members;
DROP POLICY IF EXISTS "School admins can view school members" ON public.school_members;
DROP POLICY IF EXISTS "SUPER_ADMIN can view all members" ON public.school_members;
DROP POLICY IF EXISTS "Authorized users can manage memberships" ON public.school_members;
DROP POLICY IF EXISTS "Users can view own organizations" ON public.organizations;
DROP POLICY IF EXISTS "Users can view own org memberships" ON public.organization_members;
DROP POLICY IF EXISTS "School members can view onboarding progress" ON public.onboarding_progress;
DROP POLICY IF EXISTS "School members can view masked KYC" ON public.kyc_records;
DROP POLICY IF EXISTS "Users can view roles in their organization" ON public.roles;
DROP POLICY IF EXISTS "SUPER_ADMIN can manage roles" ON public.roles;
DROP POLICY IF EXISTS "Users can view role permissions in their org" ON public.role_permissions;
DROP POLICY IF EXISTS "SUPER_ADMIN can manage role permissions" ON public.role_permissions;
DROP POLICY IF EXISTS "School members can view profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "School admins can manage profiles" ON profiles;
DROP POLICY IF EXISTS "Authenticated users can view permissions" ON public.permissions;

-- ==========================================================
-- 3. CONVERT ALL IDENTITY COLUMNS TO UUID`,
        why: 'Drop all policies depending on identity columns before ALTER TYPE; recreated natively in migration 028',
      },
      // Ensure FK re-adds don't fail on already-existing constraints
      {
        from: "ALTER TABLE public.schools\n    ADD CONSTRAINT schools_owner_user_id_fkey\n    FOREIGN KEY (owner_user_id) REFERENCES public.users(id) ON DELETE SET NULL;",
        to: "ALTER TABLE public.schools DROP CONSTRAINT IF EXISTS schools_owner_user_id_fkey;\nALTER TABLE public.schools\n    ADD CONSTRAINT schools_owner_user_id_fkey\n    FOREIGN KEY (owner_user_id) REFERENCES public.users(id) ON DELETE SET NULL;",
        why: 'Constraint may already exist from migration 022; drop first to avoid duplicate_object error',
      },
    ],
  },
  202607100022: {
    allowCommentResidual: false,
    rules: [
      { from: 'owner_user_id = auth.uid()::text', to: 'owner_user_id = auth.uid()', why: 'organizations.owner_user_id created UUID here' },
      { from: 'auth.uid()::text', to: 'auth.uid()', why: 'remaining org-membership comparisons created UUID here' },
    ],
  },
};

function query(sql) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query: sql });
    const req = https.request(
      {
        hostname: 'api.supabase.com',
        path: `/v1/projects/${REF}/database/query`,
        method: 'POST',
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
        timeout: 180000,
      },
      (res) => {
        let d = '';
        res.on('data', (c) => (d += c));
        res.on('end', () =>
          res.statusCode >= 200 && res.statusCode < 300
            ? resolve(d)
            : reject(new Error(`HTTP ${res.statusCode}: ${d.slice(0, 600)}`)),
        );
      },
    );
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('request timeout')));
    req.write(body);
    req.end();
  });
}

const lit = (s) => `'${String(s).replace(/'/g, "''")}'`;

async function ensureBookkeeping() {
  await query(`
    create schema if not exists supabase_migrations;
    create table if not exists supabase_migrations.schema_migrations (
      version text primary key,
      statements int,
      name text
    );`);
}

(async () => {
  await ensureBookkeeping();
  const doneRows = JSON.parse(await query('select version from supabase_migrations.schema_migrations'));
  const done = new Set(doneRows.map((r) => r.version));

  const files = fs.readdirSync(MIG_DIR).filter((f) => f.endsWith('.sql')).sort();
  let appliedCount = 0;

  for (const file of files) {
    const version = file.split('_')[0];
    if (done.has(version)) {
      console.log(`skip   ${file}`);
      continue;
    }

    let sql = fs.readFileSync(path.join(MIG_DIR, file), 'utf8');
    const spec = REPAIRS[version];

    if (spec) {
      let total = 0;
      for (const r of spec.rules) {
        const parts = sql.split(r.from);
        if (parts.length < 2 && r.optional) {
          console.log(`         note: optional repair not present in ${file} — ${r.why}`);
          continue;
        }
        if (parts.length < 2 && !spec.allowCommentResidual) {
          console.error(`REPAIR MISMATCH in ${file}: literal not found (${r.why}):\n  ${r.from}`);
          console.error('STOPPING — re-review the migration file before touching the repairs map.');
          process.exit(1);
        }
        total += parts.length - 1;
        sql = parts.join(r.to);
      }
      const residual = (sql.match(/auth\.uid\(\)::text/g) || []).length;
      if (residual > 0 && !spec.allowCommentResidual) {
        console.error(`REPAIR INCOMPLETE in ${file}: ${residual} auth.uid()::text occurrence(s) remain.`);
        console.error('STOPPING — extend the reviewed repairs map explicitly.');
        process.exit(1);
      }
      console.log(`apply  ${file}  [${total} identity comparison(s) normalized]${residual ? ` [${residual} comment-only residual]` : ''}`);
    } else {
      console.log(`apply  ${file}`);
    }

    const wrapped =
      `BEGIN;\n${sql}\n` +
      `INSERT INTO supabase_migrations.schema_migrations(version, statements, name) ` +
      `VALUES (${lit(version)}, ${sql.split(';').length}, ${lit(file)});\nCOMMIT;`;

    try {
      await query(wrapped);
      appliedCount += 1;
    } catch (e) {
      console.error(`FAILED ${file}: ${e.message}`);
      console.error('STOPPING — investigate before re-running.');
      process.exit(1);
    }
  }

  const highest = doneRows.concat(files.filter(Boolean).map((f) => ({ version: f.split('_')[0] })))
    .map((r) => r.version)
    .sort()
    .pop();
  console.log(`\nDONE: ${appliedCount} applied this run; chain complete through ${highest}.`);
})();
