/**
 * check-sensitive-logging — heuristic scan for console logging of sensitive
 * identifiers (BVN, NIN, tokens, passwords, account numbers). Catches both
 * literal strings and known sensitive variable names in console statements.
 */
import { listFiles, matchLines, readFile, result, type CheckResult } from './lib.js';

const TARGET_DIRS = ['backend/routes', 'backend/services', 'backend/middleware', 'frontend/src'];
const EXTS = ['.ts', '.js', '.vue'];

// Statements that PRINT a sensitive value (interpolation or direct mention of
// bvn/nin identifiers). Warnings about *missing* configuration ("no webhook
// secret configured") are benign and must not match.
const LITERAL_RE = /console\.(log|error|warn|info)\([^)]*\$\{[^}]*(bvn|nin|password|secret|api[_-]?key|token)/i;
const BVN_NIN_MENTION_RE = /console\.(log|error|warn|info)\(\s*['"`][^'"`]*\b(bvn|nin)\b/i;
// Sensitive runtime values that must never reach logs unmasked.
const VARIABLE_RE = /console\.(log|error|warn|info)\([^)]*(dvaAccount|virtual_account|accountNumber|account_number|refresh_token|access_token)/;

export function run(): CheckResult {
  const findings: CheckResult['findings'] = [];
  let literals = 0;
  let variables = 0;

  for (const dir of TARGET_DIRS) {
    for (const file of listFiles(dir, EXTS)) {
      if (file.includes('__tests__') || file.includes('.test.')) continue;
      const content = readFile(file);
      if (!content) continue;
      for (const hit of matchLines(content, LITERAL_RE)) {
        literals++;
        findings.push({ id: 'LOG-LITERAL', detail: `Console statement interpolates a sensitive identifier/value.`, file, line: hit.line, severity: 'high' });
      }
      for (const hit of matchLines(content, BVN_NIN_MENTION_RE)) {
        literals++;
        findings.push({ id: 'LOG-BVN-NIN', detail: `Console statement mentions BVN/NIN in its message text.`, file, line: hit.line, severity: 'high' });
      }
      for (const hit of matchLines(content, VARIABLE_RE)) {
        variables++;
        findings.push({ id: 'LOG-VARIABLE', detail: `Console statement prints a sensitive runtime value (mask before logging — COMP-037 class).`, file, line: hit.line, severity: 'medium' });
      }
    }
  }

  let status: CheckResult['status'] = 'PASS';
  if (literals > 0) status = 'FAIL';
  else if (variables > 0) status = 'PARTIAL';

  return result(
    'check-sensitive-logging',
    'Sensitive data in application logs',
    status,
    `${literals} literal and ${variables} variable-based sensitive log statement(s) found in non-test sources.`,
    findings
  );
}
