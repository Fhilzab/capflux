/**
 * SandboxGateway contract tests.
 *
 * Mirrors the provider-contract conventions used for Paystack/TestGateway:
 * every adapter resolvable through GatewayFactory must implement the full
 * 18-method gateway surface, and production must be structurally unable to
 * construct or use the sandbox adapter (fail closed).
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';

const { SandboxGateway } = await import('../services/gateways/SandboxGateway.js');
const { GatewayFactory } = await import('../services/gateways/GatewayFactory.js');

const requiredMethods = [
  'getProviderName', 'getAccessToken',
  'createStudentPaymentAccount', 'deactivatePaymentAccount',
  'verifyPayment', 'getTransaction', 'reconcilePayments',
  'verifyWebhookSignature', 'processWebhook',
  'parseWebhookReference', 'parseWebhookEventId', 'parseWebhookAmount', 'parseWebhookDVA', 'parseSettlementDetails',
  'normalizeTransactionStatus', 'normalizeSettlementStatus',
  'getSettlementStatus', 'listSettlements',
];

beforeEach(() => {
  process.env.NODE_ENV = 'test';
});

test('SandboxGateway implements the full provider contract', () => {
  const gateway = new SandboxGateway();
  for (const method of requiredMethods) {
    assert.equal(typeof (gateway as unknown as Record<string, unknown>)[method], 'function', `missing ${method}`);
  }
});

test('SandboxGateway is deterministic and demo-branded', () => {
  const gateway = new SandboxGateway();
  assert.equal(gateway.getProviderName(), 'sandbox');
  const dva1 = gateway.nextDemoAccountNumber();
  const dva2 = gateway.nextDemoAccountNumber();
  assert.match(dva1, /^100\d{7}$/);
  assert.match(dva2, /^100\d{7}$/);
  assert.notEqual(dva1, dva2);

  assert.equal(gateway.buildDemoReference(1), 'DEMO-PAY-000001');
  assert.equal(gateway.buildDemoReference(42), 'DEMO-PAY-000042');
});

test('SandboxGateway creates Demo Bank DVAs with masked-safe naming', async () => {
  const gateway = new SandboxGateway();
  const account = await gateway.createStudentPaymentAccount({
    school_id: 'sbx-school',
    student_id: 'stu-1',
    student_name: 'Ada Nwosu',
    email: 'ada@demo.ng',
  });
  assert.equal(account.provider, 'sandbox');
  assert.equal(account.account_status, 'ACTIVE');
  assert.match(account.bank_name, /demo/i);
  // Account name must not leak beyond the demo tenant context.
  assert.ok(account.account_name.includes('Ada Nwosu'));
});

test('SandboxGateway verifies its own webhook signatures and rejects forgeries', async () => {
  const gateway = new SandboxGateway();
  const payload = JSON.stringify({ reference: 'DEMO-PAY-000001', event: 'charge.success' });
  const signature = gateway.signSandboxWebhook(payload);
  assert.equal(await gateway.verifyWebhookSignature(signature, payload), true);
  assert.equal(await gateway.verifyWebhookSignature('deadbeef', payload), false);
  assert.equal(
    await gateway.verifyWebhookSignature(signature, JSON.stringify({ reference: 'tampered' })),
    false,
  );
});

test('production cannot construct or resolve the sandbox gateway (fail closed)', async () => {
  process.env.NODE_ENV = 'production';
  process.env.CAPFLUX_MODE = 'production';
  try {
    assert.throws(() => new SandboxGateway(), /not available in production/);
    // Release-gate hardening: resolution now THROWS (loud) instead of
    // silently returning null.
    assert.throws(() => GatewayFactory.get('sandbox'), /PRODUCTION_CONFIGURATION_ERROR/);
  } finally {
    process.env.NODE_ENV = 'test';
    delete process.env.CAPFLUX_MODE;
  }
});

test('SandboxGateway normalizes canonical statuses', () => {
  const gateway = new SandboxGateway();
  assert.equal(gateway.normalizeTransactionStatus('success'), 'SUCCESS');
  assert.equal(gateway.normalizeTransactionStatus('reversed'), 'REVERSED');
  assert.equal(gateway.normalizeTransactionStatus('nonsense'), 'UNKNOWN');
});
