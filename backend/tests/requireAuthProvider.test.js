/**
 * requireAuthProvider — cutover switch tests.
 *
 * Verifies that:
 *   - getAuthProviderMode defaults to supabase_only when unset (pre-cutover safe)
 *   - invalid AUTH_PROVIDER_MODE fails closed (HTTP 500, no traffic served)
 *   - supabase_only delegates to Supabase validation (valid token → next)
 *   - workos_only rejects malformed Bearer tokens (401, no network dependency)
 *   - dual mode rejects when both validators reject (401)
 *   - x-user-id / body user IDs cannot bypass authentication
 *
 * Overrides supabase.auth.getUser and supabase.from on the singleton.
 * No network calls are made (malformed JWTs fail before JWKS fetch).
 */
import 'dotenv/config';
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { supabase } from '../supabaseClient.js';
import {
  requireAuthProvider,
  getAuthProviderMode,
} from '../middleware/requireAuthProvider.js';

const mockSupabaseUser = {
  id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  email: 'test@example.com',
  aud: 'authenticated',
  app_metadata: {},
  user_metadata: { full_name: 'Test User' },
  created_at: '2026-01-01T00:00:00Z',
};

const mockAppUser = {
  id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  email: 'test@example.com',
  auth_provider: 'supabase',
  email_verified: true,
  created_at: '2026-01-01T00:00:00Z',
};

const originalGetUser = supabase.auth.getUser;
const originalFrom = supabase.from;
const originalMode = process.env.AUTH_PROVIDER_MODE;

function setValidSupabaseMocks() {
  supabase.auth.getUser = async () => ({ data: { user: mockSupabaseUser }, error: null });
  supabase.from = (table) => {
    if (table === 'users') {
      return {
        select: () => ({
          eq: () => ({
            single: async () => ({ data: mockAppUser, error: null }),
          }),
        }),
      };
    }
    return {
      select: () => ({
        eq: () => ({
          single: async () => ({ data: null, error: null }),
        }),
      }),
    };
  };
}

function setInvalidSupabaseMocks() {
  supabase.auth.getUser = async () => ({
    data: { user: null },
    error: { message: 'invalid JWT', code: 'invalid' },
  });
}

function mockReqRes(token, extraHeaders = {}, body = {}) {
  const req = {
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...extraHeaders,
    },
    body,
  };
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  let nextCalled = false;
  const next = () => {
    nextCalled = true;
  };
  return { req, res, next, wasNextCalled: () => nextCalled };
}

beforeEach(() => {
  delete process.env.AUTH_PROVIDER_MODE;
});

afterEach(() => {
  supabase.auth.getUser = originalGetUser;
  supabase.from = originalFrom;
  if (originalMode === undefined) delete process.env.AUTH_PROVIDER_MODE;
  else process.env.AUTH_PROVIDER_MODE = originalMode;
});

describe('getAuthProviderMode', () => {
  it('defaults to supabase_only when unset (pre-cutover safe)', () => {
    assert.equal(getAuthProviderMode({}), 'supabase_only');
  });

  it('accepts all documented modes (case-insensitive)', () => {
    assert.equal(getAuthProviderMode({ AUTH_PROVIDER_MODE: 'supabase_only' }), 'supabase_only');
    assert.equal(getAuthProviderMode({ AUTH_PROVIDER_MODE: 'dual' }), 'dual');
    assert.equal(getAuthProviderMode({ AUTH_PROVIDER_MODE: 'workos_primary' }), 'workos_primary');
    assert.equal(getAuthProviderMode({ AUTH_PROVIDER_MODE: 'workos_only' }), 'workos_only');
    assert.equal(getAuthProviderMode({ AUTH_PROVIDER_MODE: ' DUAL ' }), 'dual');
  });

  it('returns invalid marker for unknown values (caller fails closed)', () => {
    const result = getAuthProviderMode({ AUTH_PROVIDER_MODE: 'magic' });
    assert.deepEqual(result, { invalid: 'magic' });
  });
});

describe('requireAuthProvider', () => {
  it('fails closed with 500 on invalid AUTH_PROVIDER_MODE', async () => {
    process.env.AUTH_PROVIDER_MODE = 'magic';
    setValidSupabaseMocks();
    const { req, res, next, wasNextCalled } = mockReqRes('any-token');
    await requireAuthProvider(req, res, next);
    assert.equal(res.statusCode, 500);
    assert.equal(wasNextCalled(), false);
  });

  it('supabase_only: valid Supabase token authenticates', async () => {
    process.env.AUTH_PROVIDER_MODE = 'supabase_only';
    setValidSupabaseMocks();
    const { req, res, next, wasNextCalled } = mockReqRes('valid-supabase-token');
    await requireAuthProvider(req, res, next);
    assert.equal(wasNextCalled(), true);
    assert.equal(req.user.id, mockAppUser.id);
  });

  it('supabase_only (default when unset): missing Bearer token → 401', async () => {
    setValidSupabaseMocks();
    const { req, res, next, wasNextCalled } = mockReqRes(null);
    await requireAuthProvider(req, res, next);
    assert.equal(res.statusCode, 401);
    assert.equal(wasNextCalled(), false);
  });

  it('workos_only: malformed Bearer token → 401', async () => {
    process.env.AUTH_PROVIDER_MODE = 'workos_only';
    const { req, res, next, wasNextCalled } = mockReqRes('not-a-jwt');
    await requireAuthProvider(req, res, next);
    assert.equal(res.statusCode, 401);
    assert.equal(wasNextCalled(), false);
  });

  it('dual: rejects when both validators reject → 401', async () => {
    process.env.AUTH_PROVIDER_MODE = 'dual';
    setInvalidSupabaseMocks();
    const { req, res, next, wasNextCalled } = mockReqRes('not-a-jwt');
    await requireAuthProvider(req, res, next);
    assert.equal(res.statusCode, 401);
    assert.equal(wasNextCalled(), false);
  });

  it('dual: client identity headers cannot bypass authentication', async () => {
    process.env.AUTH_PROVIDER_MODE = 'dual';
    setInvalidSupabaseMocks();
    const { req, res, next, wasNextCalled } = mockReqRes(null, {
      'x-user-id': mockAppUser.id,
      'x-school-id': 'some-school-id',
    });
    await requireAuthProvider(req, res, next);
    assert.equal(res.statusCode, 401);
    assert.equal(wasNextCalled(), false);
  });
});
