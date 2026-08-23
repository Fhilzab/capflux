/**
 * check-sensitive-fields — verify sensitive identifiers are encrypted at rest
 * and masked on egress, and surface known plaintext-exposure patterns.
 */
import { listFiles, matchLines, readFile, result, type CheckResult } from './lib.js';

export function run(): CheckResult {
  const migrations = listFiles('supabase/migrations', ['.sql']);
  const findings: CheckResult['findings'] = [];
  let status: CheckResult['status'] = 'PASS';

  const hasCol = (re: RegExp) => migrations.some((f) => {
    const c = readFile(f);
    return c !== null && re.test(c);
  });

  const encCols =
    hasCol(/bvn_encrypted/) &&
    hasCol(/nin_encrypted/) &&
    hasCol(/bvn_last4/);

  if (!encCols) {
    findings.push({ id: 'SF-ENC-COLUMNS', detail: 'Encrypted BVN/NIN columns (bvn_encrypted/nin_encrypted/*_last4) not found in migrations.', severity: 'critical' });
    status = 'FAIL';
  }

  const crypto = readFile('backend/services/cryptoFields.ts') ?? '';
  if (!crypto.includes("aes-256-gcm")) {
    findings.push({ id: 'SF-AES-GCM', detail: 'cryptoFields.ts does not use AES-256-GCM.', severity: 'critical' });
    status = 'FAIL';
  }
  if (!crypto.includes('maskLast4') || !crypto.includes('maskIdentifier')) {
    findings.push({ id: 'SF-MASK', detail: 'Masking helpers missing from cryptoFields.ts.', severity: 'high' });
    if (status === 'PASS') status = 'PARTIAL';
  }

  // Key rotation capability.
  if (!/key[_-]?version|keyVersion|key_id/i.test(crypto)) {
    findings.push({ id: 'SF-KEY-ROTATION', detail: 'No key-versioning in encryption envelope — rotation would orphan existing ciphertexts (COMP-032).', severity: 'medium' });
    if (status === 'PASS') status = 'PARTIAL';
  }

  // Plaintext exposure on devices (documented SEC-006 / COMP-010).
  const store = readFile('frontend/src/stores/financialActivationStore.ts') ?? '';
  if (store.includes('kycSubmissionDraft')) {
    findings.push({
      id: 'SF-LOCAL-DRAFT',
      detail: 'KYC submission draft persisted to localStorage (plaintext BVN/NIN/account numbers reach staff devices) — COMP-010.',
      severity: 'high',
      file: 'frontend/src/stores/financialActivationStore.ts',
    });
    status = status === 'FAIL' ? 'FAIL' : 'PARTIAL';
  }

  // Masked egress spot-checks in admin surfaces.
  const finAdmin = readFile('backend/routes/financial-admin.ts') ?? '';
  if (!finAdmin.includes('last4') && !finAdmin.includes('mask')) {
    findings.push({ id: 'SF-EGRESS-MASK', detail: 'financial-admin.ts shows no masking calls — verify identity fields are masked before response.', severity: 'medium' });
    if (status === 'PASS') status = 'PARTIAL';
  }

  return result(
    'check-sensitive-fields',
    'Sensitive field encryption & masking',
    status,
    `Encryption columns ${encCols ? 'present' : 'MISSING'}; device-side exposure and masking posture listed as findings.`,
    findings
  );
}
