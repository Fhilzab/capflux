/**
 * check-environment — verify the canonical environment variable surface
 * (backend/.env.example) covers every variable the code requires at runtime.
 */
import { matchLines, readFile, result, type CheckResult } from './lib.js';

const REQUIRED: ReadonlyArray<{ name: string; why: string; severity: 'high' | 'medium' }> = [
  { name: 'SUPABASE_URL', why: 'database client', severity: 'high' },
  { name: 'SUPABASE_SECRET_KEY', why: 'service-role database access', severity: 'high' },
  { name: 'PAYMENTS_PROVIDER_MODE', why: 'payment kill-switch / provider gating', severity: 'high' },
  { name: 'MONNIFY_WEBHOOK_SECRET', why: 'webhook signature verification', severity: 'high' },
  { name: 'PAYSTACK_WEBHOOK_SECRET', why: 'webhook signature verification', severity: 'high' },
  { name: 'MONNIFY_API_KEY', why: 'gateway credentials', severity: 'medium' },
  { name: 'MONNIFY_SECRET_KEY', why: 'gateway credentials', severity: 'medium' },
  { name: 'PAYSTACK_SECRET_KEY', why: 'gateway credentials', severity: 'medium' },
  { name: 'KYC_ENCRYPTION_KEY', why: 'BVN/NIN field encryption (AES-256-GCM)', severity: 'high' },
  { name: 'CORS_ORIGINS', why: 'origin allowlist', severity: 'high' },
  { name: 'CAPFLUX_STORAGE_SIGNING_SECRET', why: 'document signed-URL secret (currently falls back to weaker values — COMP-033)', severity: 'medium' },
];

export function run(): CheckResult {
  const example = readFile('backend/.env.example');
  if (!example) {
    return result('check-environment', 'Environment variable completeness', 'UNKNOWN', 'backend/.env.example not found.');
  }

  const declared = new Set(matchLines(example, /^([A-Z][A-Z0-9_]+)=/m).map((h) => (h.text.split('=')[0] ?? '').trim()));

  const findings: CheckResult['findings'] = [];
  let high = 0;
  for (const req of REQUIRED) {
    if (!declared.has(req.name)) {
      high += req.severity === 'high' ? 1 : 0;
      findings.push({ id: `ENV-MISSING-${req.name}`, detail: `${req.name} not documented in .env.example (${req.why}).`, severity: req.severity });
    }
  }

  // Placeholder hygiene: examples must not contain real-looking values.
  for (const hit of matchLines(example, /=\s*(?!your-|please-change|sandbox$|disabled|production$|\s*$)[A-Za-z0-9+/_-]{32,}$/m)) {
    if (/https?:\/\//.test(hit.text)) continue;
    findings.push({ id: 'ENV-REALISH', detail: '.env.example line looks like a real value rather than a placeholder.', file: 'backend/.env.example', line: hit.line, severity: 'high' });
  }

  let status: CheckResult['status'] = 'PASS';
  if (findings.some((f) => f.severity === 'high')) status = 'FAIL';
  else if (findings.length > 0) status = 'PARTIAL';

  return result(
    'check-environment',
    'Environment variable completeness',
    status,
    `${REQUIRED.length} required variables checked against backend/.env.example.`,
    findings
  );
}
