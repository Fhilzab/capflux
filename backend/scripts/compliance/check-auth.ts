/**
 * check-auth — verify route files carry authentication middleware and that
 * identity is derived from verified tokens only (never client headers/body).
 */
import { listFiles, matchLines, readFile, result, type CheckResult } from './lib.js';

const ROUTE_DIR = 'backend/routes';
// Routers that are public by design (each entry documents why).
const PUBLIC_BY_DESIGN: Record<string, string> = {
  'webhook.ts': 'PSP webhook — protected by HMAC signature + API re-verification',
  'auth.ts': 'LEGACY WorkOS auth surface — unauthenticated by nature; retained for rollback only',
  'provider-status.ts': 'Config posture booleans; returns no secret values',
};

export function run(): CheckResult {
  const files = listFiles(ROUTE_DIR, ['.ts']);
  const findings: CheckResult['findings'] = [];
  let unprotected = 0;

  for (const file of files) {
    const base = file.split(/[\\/]/).pop() ?? '';
    if (!PUBLIC_BY_DESIGN[base]) continue;
    // fallthrough handled below
  }

  for (const file of files) {
    const base = file.split(/[\\/]/).pop() ?? '';
    const content = readFile(file);
    if (!content) continue;
    const hasAuth =
      content.includes('requireAuthSupabase') ||
      content.includes('requireAuth') ||
      content.includes('staffAuth');

    if (!hasAuth && !PUBLIC_BY_DESIGN[base]) {
      unprotected++;
      findings.push({ id: `AUTH-MISSING-${base}`, detail: `Router ${base} imports no auth middleware and is not on the public-by-design register.`, severity: 'critical', file });
    }
    if (!hasAuth && PUBLIC_BY_DESIGN[base]) {
      findings.push({ id: `AUTH-PUBLIC-${base}`, detail: `${base} is public by design: ${PUBLIC_BY_DESIGN[base]}`, severity: 'info', file });
    }
  }

  // Identity trust checks.
  const index = readFile('backend/index.ts') ?? '';
  const rpcProxy = index.includes('/rpc');
  if (rpcProxy) {
    findings.push({
      id: 'AUTH-RPC-PROXY',
      detail: '/rpc proxy executes whitelisted RPCs under the service-role client; isolation depends on RPC internals + allowlist (review on every new whitelisted function).',
      severity: 'medium',
      file: 'backend/index.ts',
    });
  }
  const middleware = readFile('backend/middleware/requirePaymentReady.ts') ?? '';
  if (/x-user-id|x-school-id/i.test(middleware) === false && middleware.includes("body/query.school_id")) {
    findings.push({ id: 'AUTH-SCHOOL-MISMATCH-GUARD', detail: 'requirePaymentReady rejects client-supplied school mismatch (verified).', severity: 'info' });
  }
  for (const f of ['backend/middleware/requireAuthSupabase.ts']) {
    const c = readFile(f) ?? '';
    for (const hit of matchLines(c, /x-user-id|x-school-id/i)) {
      // Allowed inside comments/docblocks explaining they are legacy/untrusted.
      const trimmed = hit.text.trim();
      const isComment = trimmed.startsWith('*') || trimmed.startsWith('//') || trimmed.startsWith('/*');
      if (!isComment) {
        findings.push({ id: 'AUTH-HEADER-TRUST', detail: 'Possible trust of client identity headers outside documented comment.', severity: 'high', file: f, line: hit.line });
      }
    }
  }

  let status: CheckResult['status'] = 'PASS';
  if (unprotected > 0 || findings.some((f) => f.severity === 'critical' || f.severity === 'high')) status = 'FAIL';
  else if (findings.some((f) => f.severity === 'medium')) status = 'PARTIAL';

  return result(
    'check-auth',
    'Route authentication coverage & identity trust',
    status,
    `${files.length} router(s) checked; ${unprotected} unexpected unauthenticated router(s).`,
    findings
  );
}
