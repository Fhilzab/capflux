/**
 * Demo KYC contract + gate regression tests (sandbox KYC fix).
 *
 * Proves, against the REAL route handlers (no handler stubbing):
 *   1. Demo GET /api/kyc/status returns the canonical 'VERIFIED' status.
 *   2. Demo KYC shape matches the real handler contract
 *      ({ kyc, schoolStatus, paymentStatus, businessType }).
 *   3. No fabricated identity evidence (no '0000' last4s, no MATCH results,
 *      no invented verification timestamps).
 *   4. Production mode-gating unchanged (demo token rejected when not sandbox).
 *   5. Demo financial write rejection intact (POST /api/payments/intent → 403).
 *   6. Unauthenticated requests still 401 (bypass does not leak).
 *
 * Uses DemoAuthService to create valid tokens + an ephemeral express app —
 * no Supabase network (demo requests short-circuit before any DB call).
 */
import 'dotenv/config';
import { describe, it, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';

import { DemoAuthService } from '../services/DemoAuthService.js';
import kycRouter from '../routes/kyc.js';
import paymentsRouter from '../routes/payments.js';

const ORIGINAL_CAPFLUX_MODE = process.env.CAPFLUX_MODE;
const ORIGINAL_DEMO_SECRET = process.env.DEMO_SESSION_SECRET;

const DEMO_SECRET = 'test-demo-session-secret-for-regression-tests-32chars+';

let baseUrl = '';

before(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/kyc', kycRouter);
  app.use('/api/payments', paymentsRouter);
  await new Promise<void>((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

after(() => {
  if (ORIGINAL_CAPFLUX_MODE === undefined) delete process.env.CAPFLUX_MODE;
  else process.env.CAPFLUX_MODE = ORIGINAL_CAPFLUX_MODE;
  if (ORIGINAL_DEMO_SECRET === undefined) delete process.env.DEMO_SESSION_SECRET;
  else process.env.DEMO_SESSION_SECRET = ORIGINAL_DEMO_SECRET;
});

beforeEach(() => {
  process.env.CAPFLUX_MODE = 'sandbox';
  process.env.DEMO_SESSION_SECRET = DEMO_SECRET;
});

async function createDemoToken(personaId = 'bursar'): Promise<string> {
  const persona = DemoAuthService.getPersonaById(personaId);
  if (!persona) throw new Error(`Unknown persona: ${personaId}`);
  return DemoAuthService.createDemoSession(persona);
}

async function call(method: string, path: string, token: string | null, body?: unknown) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, body: json as any };
}

describe('demo KYC contract — canonical verified status', () => {
  it("returns kyc.status 'VERIFIED' for a demo session", async () => {
    const token = await createDemoToken('bursar');
    const { status, body } = await call('GET', '/api/kyc/status', token);
    assert.equal(status, 200);
    assert.equal(body?.success, true);
    assert.equal(body?.data?.kyc?.status, 'VERIFIED');
  });

  it('matches the real handler contract shape ({ kyc, schoolStatus, paymentStatus, businessType })', async () => {
    const token = await createDemoToken('proprietor');
    const { status, body } = await call('GET', '/api/kyc/status', token);
    assert.equal(status, 200);
    const data = body?.data;
    assert.deepEqual(Object.keys(data).sort(), ['businessType', 'kyc', 'paymentStatus', 'schoolStatus']);
    assert.equal(data.schoolStatus, 'ACTIVE');
    assert.equal(data.paymentStatus, 'READY');
    assert.ok(!('school' in data), 'legacy nested data.school shape must be gone');
  });

  it('contains no fabricated identity evidence', async () => {
    const token = await createDemoToken('bursar');
    const { status, body } = await call('GET', '/api/kyc/status', token);
    assert.equal(status, 200);
    const serialized = JSON.stringify(body);
    assert.ok(!serialized.includes('0000'), 'no fabricated last4 values');
    assert.ok(!serialized.includes('MATCH'), 'no fabricated MATCH results');
    assert.ok(!serialized.includes('APPROVED'), 'no non-canonical APPROVED literal');
    const kyc = body?.data?.kyc;
    assert.equal(kyc?.bvn_last4, null);
    assert.equal(kyc?.nin_last4, null);
    assert.equal(kyc?.bvn_masked, null);
    assert.equal(kyc?.submitted_at, null);
    assert.equal(kyc?.reviewed_at, null);
    assert.equal(kyc?.verification_provider, null);
  });
});

describe('demo KYC — mode gating and write rejection intact', () => {
  it('rejects demo tokens when CAPFLUX_MODE=production (gating unchanged)', async () => {
    const token = await createDemoToken('bursar');
    process.env.CAPFLUX_MODE = 'production';
    const { status } = await call('GET', '/api/kyc/status', token);
    assert.equal(status, 401);
  });

  it('still rejects unauthenticated requests with 401', async () => {
    const { status } = await call('GET', '/api/kyc/status', null);
    assert.equal(status, 401);
  });

  it('still rejects demo payment-intent writes with 403', async () => {
    const token = await createDemoToken('bursar');
    const { status, body } = await call('POST', '/api/payments/intent', token, {
      student_id: 'stu-1',
      amount_minor: 1000,
    });
    assert.equal(status, 403);
    assert.match(String(body?.error || ''), /not available in sandbox demo mode/);
  });

  it('demo payments summary bypass still returns the zero shape', async () => {
    const token = await createDemoToken('bursar');
    const { status, body } = await call('GET', '/api/payments/summary', token);
    assert.equal(status, 200);
    assert.deepEqual(body?.data, {
      total_payments: 0,
      successful_payments: 0,
      pending_payments: 0,
      failed_payments: 0,
      reversed_payments: 0,
      today_collections_minor: 0,
      month_collections_minor: 0,
      total_collected_minor: 0,
    });
  });
});
