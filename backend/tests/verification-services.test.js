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
let MockIdentityProvider;
let ApprovedIdentityProvider;
let MockSettlementProvider;
let ApprovedSettlementProvider;
let compareIdentityAgainstSubmission;
let evaluateSettlementEligibility;
let sanitizeIdentityResult;
let FieldState;
let IdentityOutcome;
let SettlementOutcome;
let setIdentityProviderForTest;

test('services load with mock providers in test env', async () => {
  ({ default: identityVerificationService, MockIdentityProvider, ApprovedIdentityProvider, __setIdentityProviderForTest: setIdentityProviderForTest } = await import('../services/IdentityVerificationService.js'));
  ({ default: settlementVerificationService, MockSettlementProvider, ApprovedSettlementProvider } = await import('../services/SettlementVerificationService.js'));
  ({ compareIdentityAgainstSubmission, evaluateSettlementEligibility, sanitizeIdentityResult, FieldState, IdentityOutcome, SettlementOutcome } = await import('../services/verification-matching.js'));
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

// ---------------------------------------------------------------------------
// Capability-aware verification matching (correction: no field assumptions)
// ---------------------------------------------------------------------------

const makeIdentityVerification = (overrides = {}) => ({
  verified: true,
  verificationStatus: 'VERIFIED',
  verifiedFields: { name: true, dateOfBirth: true, phone: true, identityNumber: true },
  capabilities: { canVerifyIdentityNumber: true, canFetchName: true, canFetchDob: true, canFetchPhone: true },
  verifiedName: 'Adeola Okonkwo',
  verifiedDob: '1990-01-01',
  verifiedPhone: '08012345678',
  verifiedIdentityNumber: '12345678901',
  provider: 'mock',
  reference: 'mock-ref-123',
  providerMetadata: { mock: true },
  ...overrides,
});

const makeAccountVerification = (overrides = {}) => ({
  verified: true,
  verificationStatus: 'VERIFIED',
  verifiedFields: { accountNumber: true, accountName: true },
  capabilities: { canFetchAccountNumber: true, canFetchAccountName: true, canVerifyBvn: false },
  accountName: 'Adeola Okonkwo',
  reference: 'settle-ref-1',
  provider: 'mock',
  providerMetadata: { mock: true },
  ...overrides,
});

test('matcher: provider returns name + DOB -> compares name & DOB; phone NOT_PROVIDED, not MISMATCH', () => {
  const v = makeIdentityVerification({
    capabilities: { canVerifyIdentityNumber: true, canFetchName: true, canFetchDob: true, canFetchPhone: false },
    verifiedFields: { name: true, dateOfBirth: true, identityNumber: true },
  });
  const r = compareIdentityAgainstSubmission({
    submitted: { name: 'Adeola Okonkwo', dateOfBirth: '1990-01-01', phone: '08012345678' },
    verification: v,
  });
  assert.equal(r.fields.name, FieldState.MATCH);
  assert.equal(r.fields.dateOfBirth, FieldState.MATCH);
  assert.equal(r.fields.phone, FieldState.NOT_PROVIDED);
  assert.equal(r.overall, IdentityOutcome.MATCH);
});

test('matcher: provider returns name + DOB + phone -> compares all three', () => {
  const v = makeIdentityVerification({
    capabilities: { canVerifyIdentityNumber: true, canFetchName: true, canFetchDob: true, canFetchPhone: true },
    verifiedFields: { name: true, dateOfBirth: true, phone: true, identityNumber: true },
    verifiedPhone: '08012345678',
  });
  const r = compareIdentityAgainstSubmission({
    submitted: { name: 'Adeola Okonkwo', dateOfBirth: '1990-01-01', phone: '08012345678' },
    verification: v,
  });
  assert.equal(r.fields.name, FieldState.MATCH);
  assert.equal(r.fields.dateOfBirth, FieldState.MATCH);
  assert.equal(r.fields.phone, FieldState.MATCH);
  assert.equal(r.overall, IdentityOutcome.MATCH);
});

test('matcher: provider returns name only -> DOB & phone NOT_PROVIDED, name verified', () => {
  const v = makeIdentityVerification({
    capabilities: { canVerifyIdentityNumber: true, canFetchName: true, canFetchDob: false, canFetchPhone: false },
    verifiedFields: { name: true, identityNumber: true },
  });
  const r = compareIdentityAgainstSubmission({ submitted: { name: 'Adeola Okonkwo' }, verification: v });
  assert.equal(r.fields.name, FieldState.MATCH);
  assert.equal(r.fields.dateOfBirth, FieldState.NOT_PROVIDED);
  assert.equal(r.fields.phone, FieldState.NOT_PROVIDED);
  assert.equal(r.overall, IdentityOutcome.MATCH);
});

test('matcher: provider returns no phone -> phone NOT_PROVIDED, never MISMATCH', () => {
  const v = makeIdentityVerification({
    capabilities: { canVerifyIdentityNumber: true, canFetchName: true, canFetchDob: true, canFetchPhone: false },
    verifiedFields: { name: true, dateOfBirth: true, identityNumber: true },
  });
  const r = compareIdentityAgainstSubmission({
    submitted: { name: 'Adeola Okonkwo', dateOfBirth: '1990-01-01', phone: '09999999999' },
    verification: v,
  });
  assert.equal(r.fields.phone, FieldState.NOT_PROVIDED);
  assert.notEqual(r.fields.phone, FieldState.MISMATCH);
  assert.equal(r.overall, IdentityOutcome.MATCH);
});

test('matcher: provider returns mismatched DOB -> MISMATCH', () => {
  const v = makeIdentityVerification({
    capabilities: { canVerifyIdentityNumber: true, canFetchName: true, canFetchDob: true, canFetchPhone: false },
    verifiedFields: { name: true, dateOfBirth: true, identityNumber: true },
    verifiedDob: '1991-05-05',
  });
  const r = compareIdentityAgainstSubmission({
    submitted: { name: 'Adeola Okonkwo', dateOfBirth: '1990-01-01' },
    verification: v,
  });
  assert.equal(r.fields.dateOfBirth, FieldState.MISMATCH);
  assert.equal(r.fields.name, FieldState.MATCH);
  assert.equal(r.overall, IdentityOutcome.MISMATCH);
});

test('matcher: provider returns name MISMATCH -> overall MISMATCH', () => {
  const v = makeIdentityVerification({
    capabilities: { canVerifyIdentityNumber: true, canFetchName: true, canFetchDob: false, canFetchPhone: false },
    verifiedFields: { name: true, identityNumber: true },
    verifiedName: 'Wrong Name',
  });
  const r = compareIdentityAgainstSubmission({ submitted: { name: 'Adeola Okonkwo' }, verification: v });
  assert.equal(r.fields.name, FieldState.MISMATCH);
  assert.equal(r.overall, IdentityOutcome.MISMATCH);
});

test('matcher: provider returns name but no submitted name -> NOT_VERIFIED, never MISMATCH', () => {
  const v = makeIdentityVerification({
    capabilities: { canVerifyIdentityNumber: true, canFetchName: true, canFetchDob: false, canFetchPhone: false },
    verifiedFields: { name: true, identityNumber: true },
    verifiedName: 'Adeola Okonkwo',
  });
  const r = compareIdentityAgainstSubmission({ submitted: { name: '' }, verification: v });
  assert.equal(r.fields.name, FieldState.NOT_VERIFIED);
  assert.notEqual(r.fields.name, FieldState.MISMATCH);
  assert.equal(r.overall, IdentityOutcome.NOT_VERIFIED);
});

test('matcher: provider pending -> overall PENDING', () => {
  const v = makeIdentityVerification({ verificationStatus: 'PENDING', verifiedFields: {}, verifiedName: null, verifiedDob: null, verifiedPhone: null, verifiedIdentityNumber: null });
  const r = compareIdentityAgainstSubmission({ submitted: { name: 'Adeola Okonkwo' }, verification: v });
  assert.equal(r.overall, IdentityOutcome.PENDING);
});

test('matcher: provider failed -> overall FAILED', () => {
  const v = makeIdentityVerification({ verified: false, verificationStatus: 'FAILED', verifiedFields: {}, verifiedName: null });
  const r = compareIdentityAgainstSubmission({ submitted: { name: 'Adeola Okonkwo' }, verification: v });
  assert.equal(r.overall, IdentityOutcome.FAILED);
});

test('matcher: provider-specific fields do not affect matching', () => {
  const v = makeIdentityVerification({
    verifiedFields: { name: true, dateOfBirth: true },
    providerMetadata: { fincra_internal_id: 'abc-123', raw_response_code: 42, request_id: 'req-1' },
  });
  const r = compareIdentityAgainstSubmission({ submitted: { name: 'Wrong Name', dateOfBirth: '1990-01-01' }, verification: v });
  // Extra provider-specific keys are ignored; the name mismatch is still detected.
  assert.equal(r.fields.name, FieldState.MISMATCH);
  assert.equal(r.overall, IdentityOutcome.MISMATCH);
});

test('matcher: identityNumber match -> MATCH; mismatch -> MISMATCH', () => {
  const matching = makeIdentityVerification({
    capabilities: { canVerifyIdentityNumber: true, canFetchName: false, canFetchDob: false, canFetchPhone: false },
    verifiedFields: { identityNumber: true, name: false },
    verifiedIdentityNumber: '12345678901',
  });
  const r1 = compareIdentityAgainstSubmission({ submitted: { name: 'Adeola Okonkwo', identityNumber: '12345678901' }, verification: matching });
  assert.equal(r1.fields.identityNumber, FieldState.MATCH);
  assert.equal(r1.fields.name, FieldState.NOT_PROVIDED);
  assert.equal(r1.overall, IdentityOutcome.MATCH);

  const mismatching = makeIdentityVerification({ ...matching, verifiedIdentityNumber: '99999999999' });
  const r2 = compareIdentityAgainstSubmission({ submitted: { name: 'Adeola Okonkwo', identityNumber: '12345678901' }, verification: mismatching });
  assert.equal(r2.fields.identityNumber, FieldState.MISMATCH);
  assert.equal(r2.overall, IdentityOutcome.MISMATCH);
});

// --- Settlement eligibility (capability-aware ownership) ---

test('settlement: account verified + name matches -> OWNERSHIP_MATCH', () => {
  const res = evaluateSettlementEligibility({ accountVerification: makeAccountVerification(), registeredOwnerName: 'Adeola Okonkwo' });
  assert.equal(res.eligible, true);
  assert.equal(res.overall, SettlementOutcome.OWNERSHIP_MATCH);
  assert.equal(res.account.accountName, FieldState.MATCH);
  assert.equal(res.ownership.nameMatch, true);
});

test('settlement: account name differs -> NAME_MISMATCH, not eligible', () => {
  const res = evaluateSettlementEligibility({ accountVerification: makeAccountVerification({ accountName: 'Other Person' }), registeredOwnerName: 'Adeola Okonkwo' });
  assert.equal(res.eligible, false);
  assert.equal(res.overall, SettlementOutcome.NAME_MISMATCH);
  assert.equal(res.account.accountName, FieldState.MISMATCH);
});

test('settlement: provider cannot fetch name -> NOT_PROVIDED, not a MISMATCH', () => {
  const res = evaluateSettlementEligibility({
    accountVerification: makeAccountVerification({
      accountName: null,
      verifiedFields: { accountNumber: true },
      capabilities: { canFetchAccountName: false, canFetchAccountNumber: true, canVerifyBvn: false },
    }),
    registeredOwnerName: 'Adeola Okonkwo',
  });
  assert.equal(res.eligible, false);
  assert.equal(res.account.accountName, FieldState.NOT_PROVIDED);
  assert.notEqual(res.account.accountName, FieldState.MISMATCH);
  assert.equal(res.overall, SettlementOutcome.NAME_NOT_VERIFIED);
});

test('settlement: BVN name mismatches owner -> NAME_MISMATCH (BVN is separate from account name)', () => {
  const res = evaluateSettlementEligibility({
    accountVerification: makeAccountVerification(),
    bvnVerification: makeIdentityVerification({
      capabilities: { canVerifyIdentityNumber: true, canFetchName: true, canFetchDob: false, canFetchPhone: false },
      verifiedFields: { name: true, identityNumber: true },
      verifiedName: 'Different Person',
    }),
    registeredOwnerName: 'Adeola Okonkwo',
  });
  assert.equal(res.eligible, false);
  assert.equal(res.overall, SettlementOutcome.NAME_MISMATCH);
});

test('settlement: account not verified -> not eligible', () => {
  const res = evaluateSettlementEligibility({
    accountVerification: makeAccountVerification({ verified: false, verificationStatus: 'FAILED', accountName: null, verifiedFields: {} }),
    registeredOwnerName: 'Adeola Okonkwo',
  });
  assert.equal(res.eligible, false);
  assert.equal(res.account.valid, false);
});

// --- Provider abstraction contract ---

test('identity: mock provider declares conservative capabilities (no name/DOB/phone)', () => {
  const caps = new MockIdentityProvider().getCapabilities('NIN');
  assert.equal(caps.canVerifyIdentityNumber, true);
  assert.equal(caps.canFetchName, false);
  assert.equal(caps.canFetchDob, false);
  assert.equal(caps.canFetchPhone, false);
});

test('identity: approved provider is not configured (throws)', async () => {
  await assert.rejects(
    async () => new ApprovedIdentityProvider().verify({ type: 'NIN', value: '12345678901' }),
    /not configured/
  );
});

test('settlement: approved provider is not configured (throws)', async () => {
  await assert.rejects(
    async () => new ApprovedSettlementProvider().verifyAccount({ bankCode: '044', accountNumber: '1234567890' }),
    /not configured/
  );
});

test('identity: provider-thrown failure is normalized to FAILED (no throw, no raw error to caller)', async () => {
  setIdentityProviderForTest({
    getCapabilities: () => ({}),
    verify: async () => { throw new Error('upstream provider exploded'); },
    get providerName() { return 'test-fail'; },
  });
  try {
    const r = await identityVerificationService.verifyIdentity({ type: 'NIN', value: '12345678901' });
    assert.equal(r.verified, false);
    assert.equal(r.verificationStatus, 'FAILED');
    assert.equal(r.failureReason, 'PROVIDER_ERROR: upstream provider exploded');
    assert.equal(r.provider, 'test-fail');
    // Raw provider error message is sanitized (prefix only); no internal stack/PII leaked,
    // and providerMetadata carries no credentials/payload.
    assert.deepEqual(r.providerMetadata, {});
  } finally {
    setIdentityProviderForTest(null);
  }
});

// --- Security: PII never reaches the sanitized client view ---

test('security: sanitizeIdentityResult never exposes verified name/DOB/phone/identity-number/providerMetadata', () => {
  const result = {
    verified: true,
    verificationStatus: 'VERIFIED',
    verifiedName: 'Adeola Okonkwo',
    verifiedDob: '1990-01-01',
    verifiedPhone: '08012345678',
    verifiedIdentityNumber: '12345678901',
    verifiedBvn: '98765432109',
    capabilities: { canFetchName: true },
    verifiedFields: { name: true },
    provider: 'fincra',
    providerMetadata: { raw: 'secret', credentials: 'leaked' },
  };
  const safe = sanitizeIdentityResult(result);
  assert.equal(safe.verifiedName, undefined);
  assert.equal(safe.verifiedDob, undefined);
  assert.equal(safe.verifiedPhone, undefined);
  assert.equal(safe.verifiedIdentityNumber, undefined);
  assert.equal(safe.verifiedBvn, undefined);
  assert.equal(safe.providerMetadata, undefined);
  // Derived, non-PII capability/match data is retained for staff review.
  assert.deepEqual(safe.verifiedFields, { name: true });
  assert.equal(safe.provider, 'fincra');
});

test('security: NIN/BVN never appear in the sanitized result', () => {
  const nin = '12345678901';
  const bvn = '98765432109';
  const result = {
    verified: true,
    verificationStatus: 'VERIFIED',
    verifiedName: 'Okonkwo',
    verifiedDob: '1990-01-01',
    verifiedPhone: '08012345678',
    verifiedIdentityNumber: nin,
    verifiedBvn: bvn,
    verifiedFields: { identityNumber: true },
    capabilities: { canVerifyIdentityNumber: true, canFetchName: false },
  };
  const safe = sanitizeIdentityResult(result);
  assert.equal(safe.verifiedIdentityNumber, undefined);
  assert.equal(safe.verifiedBvn, undefined);
  assert.equal(JSON.stringify(safe).includes(nin), false);
  assert.equal(JSON.stringify(safe).includes(bvn), false);
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
