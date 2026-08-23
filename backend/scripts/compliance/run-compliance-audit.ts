/**
 * run-compliance-audit — aggregate runner for all CAPFLUX compliance checks.
 *
 * Output:
 *   - human-readable summary on stdout
 *   - machine-readable JSON (stdout with --json, or written to
 *     backend/compliance-audit-report.json unless --no-file)
 *   - exit code 0 by default; 1 with --strict when any check is FAIL/UNKNOWN.
 *
 * This tool reports TECHNICAL CONTROL status only. It never asserts legal,
 * regulatory, or organizational compliance.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { repoRoot, type CheckResult } from './lib.js';
import { run as runSecrets } from './check-secrets.js';
import { run as runRls } from './check-rls.js';
import { run as runLogging } from './check-sensitive-logging.js';
import { run as runIdempotency } from './check-payment-idempotency.js';
import { run as runWebhook } from './check-webhook-security.js';
import { run as runAuth } from './check-auth.js';
import { run as runCors } from './check-cors.js';
import { run as runSensitiveFields } from './check-sensitive-fields.js';
import { run as runFileStorage } from './check-file-storage.js';
import { run as runEnvironment } from './check-environment.js';

interface Report {
  generatedAt: string;
  product: string;
  company: string;
  jurisdiction: string;
  tool: string;
  disclaimer: string;
  checks: CheckResult[];
}

const CHECKS = [
  runSecrets,
  runRls,
  runLogging,
  runIdempotency,
  runWebhook,
  runAuth,
  runCors,
  runSensitiveFields,
  runFileStorage,
  runEnvironment,
];

const args = new Set(process.argv.slice(2));
const strict = args.has('--strict');
const jsonOnly = args.has('--json');
const noFile = args.has('--no-file');

const report: Report = {
  generatedAt: new Date().toISOString(),
  product: 'CAPFLUX',
  company: 'FHILZAB NIG LTD',
  jurisdiction: 'Nigeria',
  tool: 'backend/scripts/compliance/run-compliance-audit.ts',
  disclaimer:
    'Technical control audit only. No legal or regulatory compliance conclusion is made or implied.',
  checks: CHECKS.map((run) => run()),
};

if (!jsonOnly) {
  process.stdout.write('\n=== CAPFLUX COMPLIANCE AUDIT (technical controls) ===\n\n');
  for (const c of report.checks) {
    const icon =
      c.status === 'PASS' ? '[PASS]   ' :
      c.status === 'PARTIAL' ? '[PARTIAL]' :
      c.status === 'FAIL' ? '[FAIL]   ' :
      c.status === 'UNKNOWN' ? '[UNKNOWN]' : '[LEGAL?] ';
    process.stdout.write(`${icon} ${c.id} — ${c.title}\n         ${c.summary}\n`);
    for (const f of c.findings) {
      if (f.severity === 'info') continue;
      const loc = f.file ? ` (${f.file}${f.line ? ':' + f.line : ''})` : '';
      process.stdout.write(`           - (${f.severity}) ${f.id}: ${f.detail}${loc}\n`);
    }
    process.stdout.write('\n');
  }
  const counts = tally(report.checks);
  process.stdout.write(
    `SUMMARY PASS=${counts.PASS} PARTIAL=${counts.PARTIAL} FAIL=${counts.FAIL} UNKNOWN=${counts.UNKNOWN} REQUIRES_LEGAL_REVIEW=${counts.REQUIRES_LEGAL_REVIEW}\n`
  );
  process.stdout.write('This audit does NOT assert legal/regulatory compliance.\n\n');
} else {
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
}

if (!noFile) {
  const outPath = join(repoRoot(), 'backend', 'compliance-audit-report.json');
  writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
  if (!jsonOnly) process.stdout.write(`Machine-readable report written to backend/compliance-audit-report.json\n`);
}

function tally(checks: CheckResult[]): Record<string, number> {
  const t: Record<string, number> = {
    PASS: 0,
    PARTIAL: 0,
    FAIL: 0,
    UNKNOWN: 0,
    REQUIRES_LEGAL_REVIEW: 0,
  };
  for (const c of checks) t[c.status] = (t[c.status] ?? 0) + 1;
  return t;
}

if (strict) {
  const bad = report.checks.filter((c) => c.status === 'FAIL' || c.status === 'UNKNOWN').length;
  if (bad > 0) {
    process.exitCode = 1;
  }
}
