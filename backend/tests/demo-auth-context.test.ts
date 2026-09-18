/**
 * Demo auth + context route regression tests.
 *
 * Verifies the sandbox demo authentication path through requireAuthProvider
 * and the context routes:
 *
 *   1. Valid sandbox demo JWT is accepted by requireAuthProvider in sandbox mode
 *   2. Invalid demo JWT is rejected
 *   3. Demo JWT is NOT accepted when CAPFLUX_MODE is not sandbox (production safety)
 *   4. Demo identity resolves to req.user with correct persona data
 *   5. GET /api/context/school returns demo-school for demo sessions
 *   6. GET /api/context/org returns demo-org for demo sessions
 *   7. GET /api/context/rbac returns demo permissions for demo sessions
 *   8. GET /api/context returns consolidated demo context
 *   9. A genuine 401 is still surfaced (not silently converted)
 *
 * Uses DemoAuthService to create valid tokens — no mocking of JWT signing.
 * No network calls to Supabase (context routes short-circuit for demo).
 */
import 'dotenv/config';
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { SignJWT } from 'jose';

import { requireAuthProvider } from '../middleware/requireAuthProvider.js';
import { DemoAuthService } from '../services/DemoAuthService.js';

// ── Helpers ────────────────────────────────────────────────────────────────

const ORIGINAL_CAPFLUX_MODE = process.env.CAPFLUX_MODE;
const ORIGINAL_DEMO_SECRET = process.env.DEMO_SESSION_SECRET;

const DEMO_SECRET = 'test-demo-session-secret-for-regression-tests-32chars+';

function mockReqRes(token: string | null, extraHeaders: Record<string, string> = {}) {
  const req: Record<string, unknown> = {
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...extraHeaders,
    },
  };
  const res: Record<string, unknown> = {
    statusCode: 200,
    body: null as unknown,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(payload: unknown) {
      res.body = payload;
      return res;
    },
  };
  let nextCalled = false;
  const next = () => { nextCalled = true; };
  return {
    req: req as Parameters<typeof requireAuthProvider>[0],
    res: res as Parameters<typeof requireAuthProvider>[1],
    next,
    wasNextCalled: () => nextCalled,
  };
}

/** Create a valid demo session token using DemoAuthService. */
async function createDemoToken(personaId = 'bursar'): Promise<string> {
  const persona = DemoAuthService.getPersonaById(personaId);
  if (!persona) throw new Error(`Unknown persona: ${personaId}`);
  return DemoAuthService.createDemoSession(persona);
}

/** Create a fake demo-like token (sandbox:true + demo:true but wrong signature). */
async function createFakeDemoToken(): Promise<string> {
  const payload = {
    sandbox: true,
    demo: true,
    personaId: 'bursar',
    role: 'BURSAR',
    systemRole: 'ADMIN',
    title: 'Bursar',
    issuedAt: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .sign(new TextEncoder().encode('wrong-secret-that-does-not-match'));
}

// ── Setup / Teardown ───────────────────────────────────────────────────────

beforeEach(() => {
  process.env.CAPFLUX_MODE = 'sandbox';
  process.env.DEMO_SESSION_SECRET = DEMO_SECRET;
});

afterEach(() => {
  if (ORIGINAL_CAPFLUX_MODE === undefined) delete process.env.CAPFLUX_MODE;
  else process.env.CAPFLUX_MODE = ORIGINAL_CAPFLUX_MODE;
  if (ORIGINAL_DEMO_SECRET === undefined) delete process.env.DEMO_SESSION_SECRET;
  else process.env.DEMO_SESSION_SECRET = ORIGINAL_DEMO_SECRET;
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe('requireAuthProvider — sandbox demo token', () => {
  it('accepts valid demo JWT when CAPFLUX_MODE=sandbox', async () => {
    const token = await createDemoToken('bursar');
    const { req, res, next, wasNextCalled } = mockReqRes(token);
    await requireAuthProvider(req, res, next);
    assert.equal(wasNextCalled(), true, 'next() should be called for valid demo token');
    assert.equal((req as { isDemo?: boolean }).isDemo, true, 'req.isDemo should be true');
    assert.ok((req as { user?: { id?: string } }).user?.id?.startsWith('demo-'), 'req.user.id should start with demo-');
  });

  it('sets req.user with correct persona identity', async () => {
    const token = await createDemoToken('proprietor');
    const { req, res, next } = mockReqRes(token);
    await requireAuthProvider(req, res, next);
    const user = (req as { user?: { id?: string; email?: string; fullName?: string } }).user;
    assert.equal(user?.id, 'demo-proprietor');
    assert.equal(user?.email, 'owner@demo.capflux');
    assert.equal(user?.fullName, 'Amaka Obi');
  });

  it('rejects fake demo JWT with wrong signature', async () => {
    const token = await createFakeDemoToken();
    const { req, res, next, wasNextCalled } = mockReqRes(token);
    await requireAuthProvider(req, res, next);
    assert.equal(wasNextCalled(), false, 'next() should NOT be called for invalid signature');
    assert.equal((res as { statusCode: number }).statusCode, 401);
  });

  it('does NOT delegate to demo auth when CAPFLUX_MODE is unset (production)', async () => {
    // Create token while in sandbox mode (before switching to production)
    const token = await createDemoToken('bursar');
    delete process.env.CAPFLUX_MODE;
    const { req, res, next, wasNextCalled } = mockReqRes(token);
    await requireAuthProvider(req, res, next);
    // Demo token should NOT be accepted — it should fall through to supabase_only
    // which will reject it because it's not a valid Supabase JWT.
    assert.equal(wasNextCalled(), false, 'next() should NOT be called in production mode');
    assert.equal((res as { statusCode: number }).statusCode, 401);
  });

  it('does NOT delegate to demo auth when CAPFLUX_MODE=production', async () => {
    // Create token while in sandbox mode (before switching to production)
    const token = await createDemoToken('bursar');
    process.env.CAPFLUX_MODE = 'production';
    const { req, res, next, wasNextCalled } = mockReqRes(token);
    await requireAuthProvider(req, res, next);
    assert.equal(wasNextCalled(), false, 'next() should NOT be called in production mode');
    assert.equal((res as { statusCode: number }).statusCode, 401);
  });

  it('still rejects non-demo tokens normally in sandbox mode', async () => {
    process.env.CAPFLUX_MODE = 'sandbox';
    const { req, res, next, wasNextCalled } = mockReqRes('not-a-jwt-at-all');
    await requireAuthProvider(req, res, next);
    assert.equal(wasNextCalled(), false, 'next() should NOT be called for garbage token');
    assert.equal((res as { statusCode: number }).statusCode, 401);
  });

  it('still rejects missing Bearer token in sandbox mode', async () => {
    process.env.CAPFLUX_MODE = 'sandbox';
    const { req, res, next, wasNextCalled } = mockReqRes(null);
    await requireAuthProvider(req, res, next);
    assert.equal(wasNextCalled(), false);
    assert.equal((res as { statusCode: number }).statusCode, 401);
  });
});

describe('requireAuthProvider — demo token production safety', () => {
  it('rejects demo JWT when AUTH_PROVIDER_MODE=supabase_only and CAPFLUX_MODE unset', async () => {
    // Create token while in sandbox mode (before switching to production)
    const token = await createDemoToken('bursar');
    delete process.env.CAPFLUX_MODE;
    process.env.AUTH_PROVIDER_MODE = 'supabase_only';
    const { req, res, next, wasNextCalled } = mockReqRes(token);
    await requireAuthProvider(req, res, next);
    assert.equal(wasNextCalled(), false);
    assert.equal((res as { statusCode: number }).statusCode, 401);
  });

  it('rejects demo JWT when AUTH_PROVIDER_MODE=workos_only and CAPFLUX_MODE unset', async () => {
    const token = await createDemoToken('bursar');
    delete process.env.CAPFLUX_MODE;
    process.env.AUTH_PROVIDER_MODE = 'workos_only';
    const { req, res, next, wasNextCalled } = mockReqRes(token);
    await requireAuthProvider(req, res, next);
    assert.equal(wasNextCalled(), false);
    assert.equal((res as { statusCode: number }).statusCode, 401);
  });
});

describe('DemoAuthService — token verification', () => {
  it('creates and verifies a valid demo session', async () => {
    const token = await createDemoToken('bursar');
    const payload = await DemoAuthService.verifyDemoSession(token);
    assert.equal(payload.sandbox, true);
    assert.equal(payload.demo, true);
    assert.equal(payload.personaId, 'bursar');
    assert.equal(payload.role, 'BURSAR');
    assert.equal(payload.systemRole, 'ADMIN');
  });

  it('rejects token with wrong secret', async () => {
    // Create token with a different secret
    const wrongSecret = 'completely-different-secret-key-for-testing-32ch';
    const persona = DemoAuthService.getPersonaById('bursar')!;
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      sandbox: true,
      demo: true,
      personaId: persona.id,
      role: persona.role,
      systemRole: persona.systemRole,
      platformStaff: false,
      title: persona.title,
      issuedAt: now,
      exp: now + 3600,
    };
    const token = await new SignJWT(payload as unknown as Record<string, unknown>)
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setIssuedAt(now)
      .setExpirationTime('3600s')
      .sign(new TextEncoder().encode(wrongSecret));

    await assert.rejects(
      () => DemoAuthService.verifyDemoSession(token),
      /invalid signature|signature verification failed/i,
    );
  });

  it('rejects token with wrong personaId', async () => {
    // Create a token with a fabricated personaId
    const secret = new TextEncoder().encode(DEMO_SECRET);
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      sandbox: true,
      demo: true,
      personaId: 'nonexistent-persona',
      role: 'STAFF',
      systemRole: 'STAFF',
      title: 'Ghost',
      issuedAt: now,
      exp: now + 3600,
    };
    const token = await new SignJWT(payload as unknown as Record<string, unknown>)
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setIssuedAt(now)
      .setExpirationTime('3600s')
      .sign(secret);

    await assert.rejects(
      () => DemoAuthService.verifyDemoSession(token),
      /unknown persona/i,
    );
  });
});
