/**
 * check-file-storage — verify upload/download guards: validation, signed
 * access, expiry, traversal containment, and secret-strength posture.
 */
import { readFile, result, type CheckResult } from './lib.js';

export function run(): CheckResult {
  const storage = readFile('backend/services/storage.ts');
  const kyc = readFile('backend/routes/kyc.ts');
  const validators = readFile('backend/services/validators.ts');

  if (!storage || !kyc || !validators) {
    return result('check-file-storage', 'File storage guards', 'UNKNOWN', 'storage.ts / kyc.ts / validators.ts not all readable.');
  }

  const findings: CheckResult['findings'] = [];
  let failed = false;

  const must = (cond: boolean, id: string, detail: string, severity: CheckResult['findings'][number]['severity']): void => {
    if (!cond) {
      findings.push({ id, detail: `MISSING: ${detail}`, severity });
      failed = true;
    }
  };

  must(validators.includes('isAllowedCacFile'), 'FILE-VALIDATOR', 'CAC file validator present in validators.ts', 'critical');
  must(/sniffMimeType|magic/.test(kyc), 'FILE-MAGIC', 'magic-byte MIME sniffing on upload route', 'high');
  must(storage.includes('createHmac') || storage.includes('createHmac('), 'FILE-SIGNED', 'HMAC-signed URL issuance', 'critical');
  must(storage.includes('expires'), 'FILE-EXPIRY', 'signed URL expiry parameter handling', 'high');
  must(storage.includes('startsWith(path.resolve'), 'FILE-TRAVERSAL', 'path containment check on serve (prefix guard)', 'high');

  // Documented weaknesses.
  if (storage.includes("'dev-secret'")) {
    findings.push({
      id: 'FILE-DEVSECRET',
      detail: "Signing secret fallback chain ends in 'dev-secret' — must be impossible in production (COMP-033).",
      severity: 'medium',
    });
  }
  if (!storage.includes('path.relative')) {
    findings.push({
      id: 'FILE-PREFIX-GUARD',
      detail: 'Traversal guard is prefix-based (startsWith) rather than separator-aware path.relative check — hardening note COMP-034.',
      severity: 'low',
    });
  }

  const status: CheckResult['status'] = failed ? 'FAIL' : findings.some((f) => f.severity === 'medium') ? 'PARTIAL' : 'PASS';

  return result(
    'check-file-storage',
    'File storage guards',
    status,
    `Core guards ${failed ? 'INCOMPLETE' : 'present'}; documented weaknesses listed.`,
    findings
  );
}
