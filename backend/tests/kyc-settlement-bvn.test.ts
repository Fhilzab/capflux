/**
 * Phase 2 regression tests — KYC settlement BVN verification audit row.
 *
 * Regression context: the POST /api/kyc/settlement flow fetched the school's
 * KYC record with `.select('principal_name')` but later guarded the intended
 * `kyc_verifications` (BVN evidence) insert on `kycRecord?.id`, which was
 * always undefined — so the audit row was silently never written (defect
 * introduced in commit 879a21a, phase 8.kyc_onboarding).
 *
 * Fix under test:
 *   1. select now includes `id`
 *   2. the insert became an upsert on idempotency_key (financial-admin
 *      pattern) so a same-BVN resubmission cannot violate
 *      uq_kyc_verifications_idempotency and turn into a 500.
 *
 * These tests drive the REAL kyc router over HTTP with the typed fake Supabase
 * boundary (tests/helpers/fakeSupabase.ts). Verification providers are stubbed
 * at the service singleton boundary; matching/eligibility logic runs for real.
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import express from 'express';

process.env.KYC_ENCRYPTION_KEY = process.env.KYC_ENCRYPTION_KEY || 'A'.repeat(32);

import 'dotenv/config';
import { supabase } from '../supabaseClient.js';
import identityVerificationService from '../services/IdentityVerificationService.js';
import settlementVerificationService from '../services/SettlementVerificationService.js';
import kycRouter from '../routes/kyc.js';
import { installFakeSupabase, FakeBuilder, okSingle } from './helpers/fakeSupabase.js';

interface CapturedKycVerificationWrite {
  row: Record<string, unknown>;
  opts: unknown;
}

let restoreSupabase: { restore: () => void } | null = null;
let kycVerificationWrites: CapturedKycVerificationWrite[] = [];
let settlementAccountVerifWrites: Record<string, unknown>[] = [];

const CREATED_SETTLEMENT = {
  id: 'sa-1',
  status: 'PENDING_VERIFICATION',
  account_number: '1234567890',
};

/** settlement_accounts builder whose awaited result switches once stored. */
class SettlementAccountsBuilder extends FakeBuilder {
  private thenStored = false;

  constructor() {
    super({ data: null, error: null });
    // Own-property handlers (no override needed): any of these mutations
    // means the row is now stored, so subsequent awaits see the stored row.
    const self = this;
    const writable = this as unknown as {
      insert: (...args: unknown[]) => SettlementAccountsBuilder;
      upsert: (...args: unknown[]) => SettlementAccountsBuilder;
      update: (...args: unknown[]) => SettlementAccountsBuilder;
    };
    writable.insert = () => self.markStored();
    writable.upsert = (..._args: unknown[]) => self.markStored();
    writable.update = () => self.markStored();
  }

  markStored(): this {
    this.thenStored = true;
    return this;
  }

  protected override resolve(): ReturnType<FakeBuilder['resolve']> {
    return this.thenStored
      ? okSingle(CREATED_SETTLEMENT)
      : { data: null, error: null };
  }
}

function installScenario(): void {
  kycVerificationWrites = [];
  settlementAccountVerifWrites = [];

  restoreSupabase = installFakeSupabase({
    getUser: async () => ({ data: { user: { id: 'user-1' } }, error: null }),
    from: (table: string): FakeBuilder => {
      switch (table) {
        case 'users':
          // requireAuthSupabase resolves the CAPFLUX app user from public.users.
          return new FakeBuilder(okSingle({ id: 'user-1', email: 'test@capflux.dev' }));
        case 'school_members':
          return new FakeBuilder(okSingle({ school_id: 'sch-1' }));
        case 'schools':
          return new FakeBuilder(okSingle({ status: 'ACTIVE', payment_status: 'READY', name: 'Test School' }));
        case 'kyc_records':
          // Serves both the status pre-check and the owner-name/id lookup.
          return new FakeBuilder(okSingle({ id: 'kyc-1', status: 'VERIFIED', principal_name: 'Ada Obi' }));
        case 'settlement_accounts':
          return new SettlementAccountsBuilder();
        case 'settlement_account_verifications': {
          const b = new FakeBuilder(okSingle({ id: 'sav-1' }));
          b.insert = (values?: unknown): FakeBuilder => {
            settlementAccountVerifWrites.push(values as Record<string, unknown>);
            return b;
          };
          return b;
        }
        case 'kyc_verifications': {
          const b = new FakeBuilder(okSingle({ id: 'kv-1' }));
          b.upsert = (values?: unknown, opts?: unknown): FakeBuilder => {
            kycVerificationWrites.push({
              row: values as Record<string, unknown>,
              opts,
            });
            return b;
          };
          return b;
        }
        case 'audit_logs':
          return new FakeBuilder(okSingle({ id: 'al-1' }));
        default:
          throw new Error(`Unexpected table in kyc settlement scenario: ${table}`);
      }
    },
  });
}

// ── Service stubs (providers external; matching logic real) ─────────────

const originalIdentityVerify = identityVerificationService.verifyIdentity;
const originalSettlementVerify = settlementVerificationService.verifyAccount;

function stubProviders(): void {
  identityVerificationService.verifyIdentity = (async ({ type }: { type?: unknown }) => ({
    verified: true,
    verificationStatus: 'VERIFIED',
    reference: `mock-${String(type).toLowerCase()}-ref`,
    providerReference: `mock-${String(type).toLowerCase()}-ref`,
    provider: 'mock',
    verifiedAt: new Date().toISOString(),
    verifiedFields: { identityNumber: true },
    capabilities: { canVerifyIdentityNumber: true, canFetchName: false, canFetchDob: false, canFetchPhone: false },
    providerMetadata: { mock: true },
  })) as typeof identityVerificationService.verifyIdentity;

  settlementVerificationService.verifyAccount = (async () => ({
    // Name matches "Ada Obi" per namesPlausiblyMatch token overlap.
    verified: true,
    verificationStatus: 'VERIFIED',
    reference: 'mock-settle-ref',
    providerReference: 'mock-settle-ref',
    accountName: 'ADA OBI VENTURES',
    failureReason: null,
    provider: 'mock',
    verifiedAt: new Date().toISOString(),
    verifiedFields: { accountNumber: true, accountName: true },
    capabilities: { canFetchAccountName: true, canFetchAccountNumber: true, canVerifyBvn: false },
    providerMetadata: { mock: true },
  })) as typeof settlementVerificationService.verifyAccount;
}

// ── HTTP harness ─────────────────────────────────────────────────────────

const app = express();
app.use(express.json());
app.use(kycRouter);

describe('KYC settlement — BVN verification audit row (Phase 2 fix)', () => {
  let server!: import('node:http').Server;
  let baseUrl = '';

  before(async () => {
    server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    baseUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  });

  after(async () => {
    restoreSupabase?.restore();
    restoreSupabase = null;
    identityVerificationService.verifyIdentity = originalIdentityVerify;
    settlementVerificationService.verifyAccount = originalSettlementVerify;
    server.closeAllConnections?.();
    await new Promise((resolve) => server.close(resolve));
  });

  function postSettlement(body: Record<string, unknown>): Promise<Response> {
    return fetch(`${baseUrl}/settlement`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-token' },
      body: JSON.stringify(body),
    });
  }

  test('BVN submission writes the previously-dead kyc_verifications audit row', async () => {
    installScenario();
    stubProviders();

    const res = await postSettlement({ bankCode: '058', accountNumber: '1234567890', bvn: '22212345678' });
    const body = (await res.json()) as { data: { account_number_last4: string; ownership_match_status: string } };

    assert.equal(res.status, 200, JSON.stringify(body));
    assert.equal(body.data.account_number_last4, '7890');
    assert.equal(body.data.ownership_match_status, 'OWNERSHIP_MATCH');

    assert.equal(kycVerificationWrites.length, 1);
    const write = kycVerificationWrites[0]!;
    assert.equal(write.row.kyc_record_id, 'kyc-1');
    assert.equal(write.row.school_id, 'sch-1');
    assert.equal(write.row.verification_type, 'BVN');
    assert.equal(write.row.status, 'VERIFIED');
    assert.equal(write.row.idempotency_key, 'mock-bvn-ref');
    assert.deepEqual(write.opts, { onConflict: 'idempotency_key' });
    assert.equal(settlementAccountVerifWrites.length, 1);
  });

  test('submission WITHOUT bvn does not write a kyc_verifications row', async () => {
    installScenario();
    stubProviders();

    const res = await postSettlement({ bankCode: '058', accountNumber: '1234567890' });
    assert.equal(res.status, 200);
    assert.equal(kycVerificationWrites.length, 0);
    assert.equal(settlementAccountVerifWrites.length, 1);
  });

  test('same-BVN resubmission cannot violate the idempotency unique index (upsert path)', async () => {
    installScenario();
    stubProviders();

    const payload = { bankCode: '058', accountNumber: '1234567890', bvn: '22212345678' };
    const res1 = await postSettlement(payload);
    const res2 = await postSettlement(payload);

    assert.equal(res1.status, 200);
    assert.equal(res2.status, 200);
    assert.equal(kycVerificationWrites.length, 2);
  });
});
