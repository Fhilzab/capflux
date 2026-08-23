/**
 * check-webhook-security — static verification that webhook signature
 * verification remains mandatory/fail-closed and provider handling intact.
 */
import { readFile, result, type CheckResult } from './lib.js';

export function run(): CheckResult {
  const route = readFile('backend/routes/webhook.ts');
  const verifier = readFile('backend/services/WebhookVerifier.ts');

  if (!route || !verifier) {
    return result('check-webhook-security', 'Webhook security shape', 'UNKNOWN', 'webhook route or WebhookVerifier source not found.');
  }

  const findings: CheckResult['findings'] = [];
  let status: CheckResult['status'] = 'PASS';

  const must = (cond: boolean, id: string, detail: string, severity: CheckResult['findings'][number]['severity'] = 'critical'): boolean => {
    if (!cond) {
      findings.push({ id, detail: `MISSING: ${detail}`, severity });
      return false;
    }
    return true;
  };

  let ok = true;
  ok = must(route.includes("['monnify', 'paystack']"), 'WEBHOOK-PROVIDER-ALLOWLIST', 'provider param allowlist') && ok;
  ok = must(/NODE_ENV === 'production'/.test(route) && route.includes('Missing webhook signature'), 'WEBHOOK-FAILCLOSED-ROUTE', 'production fail-closed on missing signature') && ok;
  ok = must(verifier.includes("process.env.NODE_ENV === 'production' ? false :"), 'WEBHOOK-FAILCLOSED-VERIFIER', 'missing secret fails closed in production') && ok;
  ok = must(verifier.includes("createHmac('sha512'"), 'WEBHOOK-HMAC-SHA512', 'HMAC-SHA512 signature computation') && ok;
  ok = must(verifier.includes('verifyWithAPI'), 'WEBHOOK-API-VERIFY', 'API re-verification pipeline') && ok;
  ok = must(route.includes('verifySignature'), 'WEBHOOK-SIGNATURE-CALL', 'route invokes signature verification') && ok;

  // Documented partials — presence expected; absence would IMPROVE posture.
  if (route.includes('MONNIFY_WEBHOOK_IPS.length > 0')) {
    // empty-list skip pattern exists
    findings.push({
      id: 'WEBHOOK-IPOPT',
      detail: 'IP allowlist skips enforcement when unset even in production (WEBHOOK-003 / COMP-025).',
      severity: 'medium',
    });
    status = 'PARTIAL';
  }
  if (!verifier.includes('timingSafeEqual')) {
    findings.push({
      id: 'WEBHOOK-TIMING',
      detail: 'HMAC comparison is not constant-time (timingSafeEqual). Low practical risk for hex digests; hardening item COMP-008b.',
      severity: 'low',
    });
  }
  if (/amountPaid = gateway\.parseWebhookAmount\(payload\)/.test(verifier)) {
    findings.push({
      id: 'WEBHOOK-AMOUNT-SRC',
      detail: 'Posted amount derives from webhook body; not compared to API-verified transaction amount (WEBHOOK-005 / COMP-008). Financial-core remediation requires owner sign-off.',
      severity: 'high',
    });
    status = 'PARTIAL';
  }

  if (!ok) status = 'FAIL';

  return result(
    'check-webhook-security',
    'Webhook security structure',
    status,
    `Fail-closed production signature enforcement ${ok ? 'verified' : 'MISSING'}. Known partials listed as findings.`,
    findings
  );
}
