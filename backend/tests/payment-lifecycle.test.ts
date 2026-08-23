/**
 * Payment lifecycle + money + transition tests.
 * Tests the PaymentService state machine and integer-minor-unit rules without
 * a database (pure logic paths where possible) and the transition guard.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VALID_TRANSITIONS } from '../services/PaymentService.js';

test('valid payment state transitions', () => {
  assert.deepEqual(VALID_TRANSITIONS.PENDING, ['PROCESSING', 'FAILED']);
  assert.deepEqual(VALID_TRANSITIONS.PROCESSING, ['SUCCESS', 'FAILED']);
  assert.deepEqual(VALID_TRANSITIONS.SUCCESS, ['REVERSED']);
  assert.deepEqual(VALID_TRANSITIONS.FAILED, []);
  assert.deepEqual(VALID_TRANSITIONS.REVERSED, []);
});

test('invalid transitions are rejected', () => {
  // SUCCESS cannot be set directly from PENDING (browser cannot declare success).
  assert.ok(!VALID_TRANSITIONS.PENDING.includes('SUCCESS'));
  // A REVERSED payment cannot be un-reversed.
  assert.ok(!VALID_TRANSITIONS.REVERSED.includes('SUCCESS'));
  assert.ok(!VALID_TRANSITIONS.SUCCESS.includes('PENDING'));
});

test('money must be integer minor units, never floats', () => {
  // The service requires integer amountMinor; the webhook converts to kobo
  // via Math.round(value * 100). This guards against float drift.
  const naira = 12.34;
  const amountMinor = Math.round(naira * 100);
  assert.equal(amountMinor, 1234);
  assert.equal(Number.isInteger(amountMinor), true);

  // Reconstructing naira is safe.
  assert.equal(amountMinor / 100, 12.34);

  // A naive float sum of 0.1 + 0.2 would be unsafe; we never use it.
  assert.notEqual(0.1 + 0.2, 0.3);
  assert.equal(Math.round((0.1 + 0.2) * 100), 30);
});

test('payment intent amount validation requires positive integer minor units', async () => {
  const { PaymentService } = await import('../services/PaymentService.js');
  const svc = new PaymentService();
  await assert.rejects(
    () => svc.createPaymentIntent({ schoolId: 's', studentId: 'st', amountMinor: 1.5, actorId: 'test' }),
    /positive integer/
  );
  await assert.rejects(
    () => svc.createPaymentIntent({ schoolId: 's', studentId: 'st', amountMinor: 0, actorId: 'test' }),
    /positive integer/
  );
});

test('recordVerifiedPayment requires integer minor units', async () => {
  const { PaymentService } = await import('../services/PaymentService.js');
  const svc = new PaymentService();
  await assert.rejects(
    () => svc.recordVerifiedPayment({ schoolId: 's', studentId: 'st', reference: 'r', amountMinor: 0.5 }),
    /positive integer/
  );
});
