/**
 * check-cors — verify CORS configuration cannot allow all origins in
 * production and that the dev escape hatch is properly gated.
 */
import { matchLines, readFile, result, type CheckResult } from './lib.js';

export function run(): CheckResult {
  const index = readFile('backend/index.ts');
  if (!index) {
    return result('check-cors', 'CORS posture', 'UNKNOWN', 'backend/index.ts not found.');
  }

  const findings: CheckResult['findings'] = [];

  const hasAllowlist = /CORS_ORIGINS/.test(index);
  if (!hasAllowlist) {
    findings.push({ id: 'CORS-NO-ALLOWLIST', detail: 'CORS_ORIGINS env allowlist not referenced.', severity: 'critical' });
  }

  const gatedDev = /CORS_ALLOW_ALL[^;\n]*NODE_ENV[^;\n]*production|NODE_ENV[^;\n]*!==\s*'production'[^;\n]*CORS_ALLOW_ALL/s.test(index);
  const rawCorsAll = matchLines(index, /CORS_ALLOW_ALL/);
  let prodGated = false;
  for (const hit of rawCorsAll) {
    // Look at a window around the usage for production gating.
    const start = Math.max(0, hit.line - 4);
    const window = index.split(/\r?\n/).slice(start, hit.line + 4).join('\n');
    if (/NODE_ENV[^]*?production/.test(window) || /!\s*isProduction/.test(window)) {
      prodGated = true;
      break;
    }
  }
  if (!prodGated) {
    findings.push({ id: 'CORS-DEV-HATCH', detail: 'CORS_ALLOW_ALL usage not demonstrably gated to non-production within ±4 lines.', severity: 'high' });
  }

  const creds = matchLines(index, /credentials:\s*true/);
  if (creds.length > 0) {
    findings.push({
      id: 'CORS-CREDENTIALS',
      detail: 'credentials:true is set unconditionally (required for legacy WorkOS cookie; keep origin allowlist strict).',
      severity: 'low',
    });
  }

  const noOrigin = matchLines(index, /!origin\s*\|\|/);
  for (const hit of noOrigin) {
    findings.push({
      id: 'CORS-NOORIGIN-ALLOW',
      detail: `Requests without Origin header are allowed (server-to-server/curl). Standard but means non-browser clients are never CORS-restricted. line ${hit.line}.`,
      severity: 'info',
    });
  }

  let status: CheckResult['status'] = 'PASS';
  if (findings.some((f) => f.severity === 'critical' || f.severity === 'high')) status = 'FAIL';

  return result('check-cors', 'CORS posture', status, `allowlist=${hasAllowlist}, dev-hatch-gated=${prodGated}`, findings);
}
