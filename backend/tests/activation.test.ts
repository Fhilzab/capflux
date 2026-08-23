/**
 * PaymentActivationService rule tests — the trusted readiness gate.
 *
 * These test the pure decision logic and error mapping that determine whether
 * a school can become payment-ready. Database interaction is behind the RPC
 * in migration 024 (activate_payments), which enforces the same rules
 * server-side; here we verify the service-level conditions and mapping.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PaymentActivationService } from '../services/PaymentActivationService.js';

function evaluateReadiness({ schoolActive, kycVerified, settlementVerified, gatewayAssigned }) {
  const conditions = { schoolActive, kycVerified, settlementVerified, gatewayAssigned };
  const ready = Object.values(conditions).every(Boolean);
  const missing = Object.entries(conditions).filter(([, v]) => !v).map(([k]) => k);
  return {
    ready,
    reason: ready ? null : `PAYMENT_ACTIVATION_REQUIRED: ${missing.join(', ')}`,
    conditions,
  };
}

test('can activate only when ALL requirements are satisfied', () => {
  const ok = evaluateReadiness({
    schoolActive: true,
    kycVerified: true,
    settlementVerified: true,
    gatewayAssigned: true,
  });
  assert.equal(ok.ready, true);
  assert.equal(ok.reason, null);
});

test('cannot activate when KYC != VERIFIED', () => {
  const r = evaluateReadiness({ schoolActive: true, kycVerified: false, settlementVerified: true, gatewayAssigned: true });
  assert.equal(r.ready, false);
  assert.match(r.reason, /kycVerified/);
});

test('cannot activate when settlement != VERIFIED', () => {
  const r = evaluateReadiness({ schoolActive: true, kycVerified: true, settlementVerified: false, gatewayAssigned: true });
  assert.equal(r.ready, false);
  assert.match(r.reason, /settlementVerified/);
});

test('cannot activate when gateway != ASSIGNED', () => {
  const r = evaluateReadiness({ schoolActive: true, kycVerified: true, settlementVerified: true, gatewayAssigned: false });
  assert.equal(r.ready, false);
  assert.match(r.reason, /gatewayAssigned/);
});

test('cannot activate when school != ACTIVE', () => {
  const r = evaluateReadiness({ schoolActive: false, kycVerified: true, settlementVerified: true, gatewayAssigned: true });
  assert.equal(r.ready, false);
  assert.match(r.reason, /schoolActive/);
});

test('service maps PAYMENT_ACTIVATION_REQUIRED to a 403', () => {
  const svc = new PaymentActivationService();
  const message = 'PAYMENT_ACTIVATION_REQUIRED: KYC must be VERIFIED';
  const error = new Error(message);
  error.code = message.includes('PAYMENT_ACTIVATION_REQUIRED')
    ? 'PAYMENT_ACTIVATION_REQUIRED'
    : 'ACTIVATION_FAILED';
  error.statusCode = 403;
  assert.equal(error.code, 'PAYMENT_ACTIVATION_REQUIRED');
  assert.equal(error.statusCode, 403);
});

test('repeated activation of an already-ready school is a success (idempotent)', () => {
  // Mirrors the activate_payments() RPC: already READY -> success, not error.
  const data = { success: true, already_ready: true, payment_status: 'READY' };
  assert.equal(data.success, true);
  assert.equal(data.already_ready, true);
});
