/**
 * Demo onboarding contract regression test (sandbox onboarding-contract fix).
 *
 * The frontend normalizeStatus() flat-RPC branch reads `school_status` (not
 * `status`) and the `*_completed` flags. When those keys were missing, the demo
 * school silently defaulted to PENDING_SETUP and every financial page showed
 * the Setup lock. This test pins the demo payload to the exact keys the
 * frontend normalizer consumes — against the REAL route handler.
 *
 * No Supabase network (demo requests short-circuit before any DB call).
 */
import 'dotenv/config';
import { describe, it, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';

import { DemoAuthService } from '../services/DemoAuthService.js';
import onboardingRouter from '../routes/onboarding.js';

const ORIGINAL_CAPFLUX_MODE = process.env.CAPFLUX_MODE;
const ORIGINAL_DEMO_SECRET = process.env.DEMO_SESSION_SECRET;

const DEMO_SECRET = 'test-demo-session-secret-for-regression-tests-32chars+';

let baseUrl = '';

before(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/onboarding', onboardingRouter);
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

async function call(path: string, token: string | null) {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${baseUrl}${path}`, { headers });
  return { status: res.status, body: (await res.json()) as any };
}

describe('demo onboarding contract — frontend normalizer compatibility', () => {
  it('returns school_status ACTIVE (the key normalizeStatus reads)', async () => {
    const token = await createDemoToken('bursar');
    const { status, body } = await call('/api/onboarding/status', token);
    assert.equal(status, 200);
    assert.equal(body?.success, true);
    assert.equal(body?.data?.school_status, 'ACTIVE');
  });

  it('provides every key the flat-RPC normalizer branch consumes', async () => {
    const token = await createDemoToken('proprietor');
    const { status, body } = await call('/api/onboarding/status', token);
    assert.equal(status, 200);
    const data = body?.data;
    assert.equal(data?.has_school, true);
    assert.equal(data?.school_id, 'demo-school');
    assert.equal(typeof data?.school_name, 'string');
    assert.equal(typeof data?.school_slug, 'string');
    assert.equal(data?.school_status, 'ACTIVE');
    assert.equal(data?.payment_status, 'READY');
    assert.equal(data?.profile_completed, true);
    assert.equal(data?.organization_completed, true);
    assert.equal(data?.school_completed, true);
    assert.equal(data?.owner_completed, true);
  });

  it('preserves the pre-existing demo contract fields', async () => {
    const token = await createDemoToken('bursar');
    const { status, body } = await call('/api/onboarding/status', token);
    assert.equal(status, 200);
    const data = body?.data;
    assert.equal(data?.status, 'ACTIVE');
    assert.equal(data?.requires_setup, false);
    assert.equal(data?.requires_kyc, false);
    assert.equal(data?.requires_settlement, false);
    assert.equal(data?.organization_id, 'demo-org');
  });
});

describe('demo onboarding — auth gating intact', () => {
  it('rejects demo tokens when CAPFLUX_MODE=production', async () => {
    const token = await createDemoToken('bursar');
    process.env.CAPFLUX_MODE = 'production';
    const { status } = await call('/api/onboarding/status', token);
    assert.equal(status, 401);
  });

  it('still rejects unauthenticated requests with 401', async () => {
    const { status } = await call('/api/onboarding/status', null);
    assert.equal(status, 401);
  });
});
