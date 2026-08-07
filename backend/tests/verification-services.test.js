/**
 * Identity + Settlement verification service tests (mock provider).
 *
 * IMPORTANT: NODE_ENV here is 'production' in this environment, and the
 * services refuse the mock provider in production. We set NODE_ENV=test and
 * use dynamic imports AFTER the env assignments so the services load with the
 * mock provider allowed.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.IDENTITY_VERIFICATION_PROVIDER = 'mock';
process.env.SETTLEMENT_VERIFICATION_PROVIDER = 'mock';
process.env.NODE_ENV = 'test';

let identityVerificationService;
let settlementVerificationService;

test('services load with mock providers in test env', async () => {
  ({ default: identityVerificationService } = await import('../services/IdentityVerificationService.js'));
  ({ default: settlementVerificationService } = await import('../services/SettlementVerificationService.js'));
  assert.ok(identityVerificationService);
  assert.ok(settlementVerificationService);
});

test('identity verify: NIN succeeds for 11-digit identifier', async () => {
  const result = await identityVerificationService.verifyIdentity({ type: 'NIN', value: '12345678901' });
  assert.equal(result.verified, true);
  assert.ok(result.reference);
  assert.equal(result.provider, 'mock');
});

test('identity verify: NIN starting with 0 fails', async () => {
  const result = await identityVerificationService.verifyIdentity({ type: 'NIN', value: '02345678901' });
  assert.equal(result.verified, false);
  assert.ok(result.failureReason);
});

test('identity verify: BVN succeeds', async () => {
  const result = await identityVerificationService.verifyIdentity({ type: 'BVN', value: '12345678901' });
  assert.equal(result.verified, true);
});

test('identity verify: empty value fails cleanly', async () => {
  const result = await identityVerificationService.verifyIdentity({ type: 'BVN', value: '' });
  assert.equal(result.verified, false);
});

test('settlement verify: account starting with 0 not found', async () => {
  const result = await settlementVerificationService.verifyAccount({ bankCode: '044', accountNumber: '0123456789' });
  assert.equal(result.verified, false);
  assert.equal(result.failureReason, 'ACCOUNT_NOT_FOUND');
});

test('settlement verify: found account returns a name', async () => {
  const result = await settlementVerificationService.verifyAccount({ bankCode: '044', accountNumber: '1234567890' });
  assert.equal(result.verified, true);
  assert.ok(result.accountName);
  assert.ok(result.reference);
});

test('settlement verify: malformed inputs yield structured failure', async () => {
  const result = await settlementVerificationService.verifyAccount({ bankCode: '', accountNumber: '' });
  assert.equal(result.verified, false);
});
