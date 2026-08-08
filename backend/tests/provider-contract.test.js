/**
 * Provider contract tests — verifies every gateway implements the canonical
 * PaymentGatewayInterface without provider-specific code paths.
 */

// Override NODE_ENV so TestGateway can be instantiated in test suite.
// Must be set before the first dynamic import of TestGateway.
process.env.NODE_ENV = 'test';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PaymentGatewayInterface } from '../services/gateways/PaymentGatewayInterface.js';
import { PaystackGateway } from '../services/gateways/PaystackGateway.js';
import { GatewayFactory } from '../services/gateways/GatewayFactory.js';

const requiredMethods = [
  'getProviderName', 'getAccessToken',
  'createStudentPaymentAccount', 'deactivatePaymentAccount',
  'verifyPayment', 'getTransaction', 'reconcilePayments',
  'verifyWebhookSignature', 'processWebhook',
  'parseWebhookReference', 'parseWebhookEventId', 'parseWebhookAmount', 'parseWebhookDVA', 'parseSettlementDetails',
  'normalizeTransactionStatus', 'normalizeSettlementStatus',
  'getSettlementStatus', 'listSettlements',
];

// --- Abstract interface tests ---

test('PaymentGatewayInterface throws on unimplemented methods', async () => {
  const iface = new PaymentGatewayInterface();
  const syncMethods = ['getProviderName', 'parseWebhookReference', 'parseWebhookEventId', 'parseWebhookAmount', 'parseWebhookDVA', 'parseSettlementDetails', 'normalizeTransactionStatus', 'normalizeSettlementStatus'];
  const asyncMethods = requiredMethods.filter(m => !syncMethods.includes(m));

  for (const method of syncMethods) {
    assert.throws(() => { iface[method](); }, /must be implemented/);
  }
  for (const method of asyncMethods) {
    await assert.rejects(() => iface[method](), /must be implemented/);
  }
});

test('PaymentGatewayInterface sync parse methods throw', () => {
  const iface = new PaymentGatewayInterface();
  assert.throws(() => iface.parseWebhookReference({}), /must be implemented/);
  assert.throws(() => iface.parseWebhookAmount({}), /must be implemented/);
  assert.throws(() => iface.normalizeTransactionStatus('pending'), /must be implemented/);
});

// --- Paystack adapter tests ---

test('PaystackGateway implements all required methods', () => {
  const gw = new PaystackGateway();
  assert.equal(gw.getProviderName(), 'paystack');
  for (const method of requiredMethods) {
    assert.equal(typeof gw[method], 'function', `PaystackGateway missing ${method}`);
  }
});

test('PaystackGateway reports not configured when credentials absent', async () => {
  const gw = GatewayFactory.get('paystack');
  assert.ok(gw);
  try {
    await gw.getTransaction('ref-123');
    assert.fail('Should have thrown');
  } catch (err) {
    assert.match(err.message, /Paystack is not configured/);
  }
});

// --- TestGateway tests (dynamic import after NODE_ENV override) ---

test('TestGateway implements all required methods', async () => {
  const { TestGateway } = await import('../services/gateways/TestGateway.js');
  const gw = new TestGateway();
  assert.equal(gw.getProviderName(), 'test');
  for (const method of requiredMethods) {
    assert.equal(typeof gw[method], 'function', `TestGateway missing ${method}`);
  }
});

test('TestGateway DVA creation returns deterministic account', async () => {
  const { TestGateway } = await import('../services/gateways/TestGateway.js');
  const gw = new TestGateway();
  const result = await gw.createStudentPaymentAccount({
    student_id: 'student-1',
    student_name: 'Test Student',
  });
  assert.equal(result.provider, 'test');
  assert.ok(result.virtual_account_number.startsWith('2000'));
  assert.equal(result.account_status, 'ACTIVE');
  assert.equal(result.bank_name, 'Test Bank');
});

test('TestGateway DVA deactivation works', async () => {
  const { TestGateway } = await import('../services/gateways/TestGateway.js');
  const gw = new TestGateway();
  const dva = await gw.createStudentPaymentAccount({ student_id: 's1', student_name: 'S' });
  const result = await gw.deactivatePaymentAccount({ virtual_account_number: dva.virtual_account_number });
  assert.equal(result.deactivated, true);
  assert.equal(result.account_status, 'INACTIVE');
});

test('TestGateway normalizeTransactionStatus maps correctly', async () => {
  const { TestGateway } = await import('../services/gateways/TestGateway.js');
  const gw = new TestGateway();
  assert.equal(gw.normalizeTransactionStatus('pending'), 'PENDING');
  assert.equal(gw.normalizeTransactionStatus('processing'), 'PROCESSING');
  assert.equal(gw.normalizeTransactionStatus('success'), 'SUCCESS');
  assert.equal(gw.normalizeTransactionStatus('failed'), 'FAILED');
  assert.equal(gw.normalizeTransactionStatus('reversed'), 'REVERSED');
  assert.equal(gw.normalizeTransactionStatus('unknown-status'), 'UNKNOWN');
});

test('TestGateway normalizeSettlementStatus maps correctly', async () => {
  const { TestGateway } = await import('../services/gateways/TestGateway.js');
  const gw = new TestGateway();
  assert.equal(gw.normalizeSettlementStatus('pending'), 'PENDING');
  assert.equal(gw.normalizeSettlementStatus('success'), 'SUCCESS');
  assert.equal(gw.normalizeSettlementStatus('failed'), 'FAILED');
  assert.equal(gw.normalizeSettlementStatus('bogus'), 'UNKNOWN');
});

test('TestGateway verify/process webhook roundtrips', async () => {
  const { TestGateway } = await import('../services/gateways/TestGateway.js');
  const gw = new TestGateway();
  gw.injectTxn('ref-abc', { reference: 'ref-abc', amount: 5000, status: 'success' });

  const txn = await gw.getTransaction('ref-abc');
  assert.equal(txn.amount, 5000);

  const webhook = await gw.processWebhook({ reference: 'ref-abc', amount: 5000 });
  assert.equal(webhook.reference, 'ref-abc');
  assert.equal(webhook.success, true);
});

// --- GatewayFactory tests ---

test('GatewayFactory registers monnify and paystack', () => {
  assert.ok(GatewayFactory.get('monnify'));
  assert.ok(GatewayFactory.get('paystack'));
  assert.equal(GatewayFactory.get('unknown-provider'), null);
});

test('GatewayFactory getAllProviders includes monnify and paystack', () => {
  const providers = GatewayFactory.getAllProviders();
  assert.ok(providers.includes('monnify'));
  assert.ok(providers.includes('paystack'));
});
