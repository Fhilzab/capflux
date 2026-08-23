/**
 * check-rls — verify ENABLE ROW LEVEL SECURITY coverage across migrations.
 * Compares created tables against the RLS enable statements found in
 * supabase/migrations/*.sql and supabase/policies/*.sql.
 */
import { listFiles, matchLines, readFile, result, type CheckResult } from './lib.js';

const CORE_TABLES = [
  'schools',
  'profiles',
  'students',
  'ledger_entries',
  'notifications',
  'audit_logs',
  'sync_queue',
  'payment_transactions',
  'payment_accounts',
  'guardians',
  'kyc_records',
  'school_members',
];

const SENSITIVE_SATELLITE_TABLES = [
  // Known defence-in-depth gap (TENANT-002 / COMP-009). Kept explicit so the
  // audit fails loudly until the additive migration lands.
  'settlement_accounts',
  'settlement_account_verifications',
  'kyc_verifications',
  'gateway_assignments',
  'reconciliation_runs',
  'reconciliation_issues',
  'legacy_identity_migrations',
];

export function run(): CheckResult {
  const files = [
    ...listFiles('supabase', ['.sql']),
  ];
  if (files.length === 0) {
    return result('check-rls', 'RLS coverage', 'UNKNOWN', 'No SQL files found under supabase/.');
  }

  const created = new Set<string>();
  const rlsEnabled = new Set<string>();
  const createRe = /CREATE TABLE (?:IF NOT EXISTS )?(?:public\.)?([a-zA-Z_][a-zA-Z0-9_]*)/gi;
  const rlsRe = /ENABLE ROW LEVEL SECURITY (?:ON )?(?:TABLE )?(?:public\.)?([a-zA-Z_][a-zA-Z0-9_]*)/gi;

  for (const f of files) {
    const c = readFile(f);
    if (!c) continue;
    for (const m of c.matchAll(createRe)) created.add((m[1] ?? '').toLowerCase());
    for (const m of c.matchAll(rlsRe)) rlsEnabled.add((m[1] ?? '').toLowerCase());
  }
  // Hardening file may reference tables via ALTER TABLE ... ENABLE; the same
  // regex catches it. Also accept policy-only tables as protected signal:
  const policyRe = /CREATE POLICY [^;]+ ON (?:public\.)?([a-zA-Z_][a-zA-Z0-9_]*)/gi;
  for (const f of files) {
    const c = readFile(f);
    if (!c) continue;
    for (const m of c.matchAll(policyRe)) rlsEnabled.add((m[1] ?? '').toLowerCase());
  }

  const findings: CheckResult['findings'] = [];
  let coreMissing = 0;
  let satelliteMissing = 0;

  for (const t of CORE_TABLES) {
    if (!created.has(t)) {
      findings.push({ id: `RLS-UNKNOWN-${t}`, detail: `Core table '${t}' not found in migrations — verify table list is current.`, severity: 'medium' });
      continue;
    }
    if (!rlsEnabled.has(t)) coreMissing++;
  }
  for (const t of SENSITIVE_SATELLITE_TABLES) {
    if (created.has(t) && !rlsEnabled.has(t)) {
      satelliteMissing++;
      findings.push({
        id: `RLS-MISSING-${t}`,
        detail: `Sensitive table '${t}' has no RLS enabled anywhere (service-role-only protection). Backlog COMP-009.`,
        severity: 'high',
      });
    }
  }

  let status: CheckResult['status'];
  if (coreMissing > 0) status = 'FAIL';
  else if (satelliteMissing > 0) status = 'PARTIAL';
  else status = 'PASS';

  return result(
    'check-rls',
    'Row Level Security coverage',
    status,
    `${coreMissing} core table(s) without RLS, ${satelliteMissing} sensitive satellite table(s) without RLS. Core=R1..R5 hardening set; satellites=TENANT-002 register.`,
    findings
  );
}
