/**
 * requireAuthSupabase — middleware tests.
 *
 * Verifies that:
 *   - Missing / malformed / empty Bearer tokens → 401
 *   - Invalid / expired / service-error tokens → 401
 *   - Valid Supabase access token → calls next() with req.user set
 *   - x-user-id / x-school-id headers CANNOT bypass authentication
 *   - User IDs from request body CANNOT bypass authentication
 *
 * Loads dotenv to provide Supabase env vars, then overrides the real
 * supabase.auth.getUser and supabase.from methods on the singleton
 * instance. No network calls to Supabase are made.
 */
import 'dotenv/config';
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';

// Import the real singleton supabase object
import { supabase } from '../supabaseClient.js';
// Import the middleware AFTER supabase env is available
import { requireAuthSupabase } from '../middleware/requireAuthSupabase.js';

// ── State ──

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

// Store originals to restore after each test
const originalGetUser = supabase.auth.getUser;
const originalFrom = supabase.from;

// ── Mock helpers ──

function setValidTokenMocks() {
  supabase.auth.getUser = async (token) => ({
    data: { user: mockSupabaseUser },
    error: null,
  });
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

function setInvalidTokenMocks() {
  supabase.auth.getUser = async (token) => ({
    data: { user: null },
    error: { message: 'invalid JWT', code: 'invalid' },
  });
}

function setExpiredTokenMocks() {
  supabase.auth.getUser = async (token) => ({
    data: { user: null },
    error: { message: 'JWT expired', code: 'PGJTM0' },
  });
}

function setServiceErrorMocks() {
  supabase.auth.getUser = async (token) => {
    throw new Error('Supabase service unavailable');
  };
}

function setMissingAppUserMocks() {
  supabase.auth.getUser = async (token) => ({
    data: { user: mockSupabaseUser },
    error: null,
  });
  supabase.from = (table) => ({
    select: () => ({
      eq: () => ({
        single: async () => ({
          data: null,
          error: { message: 'No rows found', code: 'PGRST116' },
        }),
      }),
    }),
  });
}

function restoreSupabase() {
  supabase.auth.getUser = originalGetUser;
  supabase.from = originalFrom;
}

// ── Mock req / res / next ──

function createMockReq(overrides = {}) {
  return {
    headers: { ...overrides.headers },
    body: { ...overrides.body },
  };
}

function createMockRes() {
  const res = {};
  res.statusCode = null;
  res.body = null;
  res.status = function (code) { res.statusCode = code; return res; };
  res.json = function (data) { res.body = data; return res; };
  return res;
}

function createMockNext() {
  let called = false;
  let arg = undefined;
  const fn = (err) => { called = true; arg = err; };
  fn.wasCalled = () => called;
  fn.arg = () => arg;
  return fn;
}

// ── Tests ──

describe('requireAuthSupabase', () => {
  before(() => {
    // Ensure supabase is configured for import
  });

  after(() => {
    restoreSupabase();
  });

  describe('A. no Authorization header', () => {
    it('returns 401', async () => {
      const req = createMockReq();
      const res = createMockRes();
      const next = createMockNext();

      await requireAuthSupabase(req, res, next);

      assert.equal(res.statusCode, 401);
      assert.equal(res.body.error, 'Unauthorized: Bearer token required.');
      assert.equal(next.wasCalled(), false);
    });
  });

  describe('B. Authorization header without "Bearer " prefix', () => {
    it('returns 401', async () => {
      const req = createMockReq({ headers: { authorization: 'Basic dXNlcjpwYXNz' } });
      const res = createMockRes();
      const next = createMockNext();

      await requireAuthSupabase(req, res, next);

      assert.equal(res.statusCode, 401);
      assert.equal(next.wasCalled(), false);
    });
  });

  describe('C. empty Bearer token', () => {
    it('returns 401', async () => {
      const req = createMockReq({ headers: { authorization: 'Bearer ' } });
      const res = createMockRes();
      const next = createMockNext();

      await requireAuthSupabase(req, res, next);

      assert.equal(res.statusCode, 401);
      assert.equal(next.wasCalled(), false);
    });
  });

  describe('D. invalid token', () => {
    it('returns 401', async () => {
      setInvalidTokenMocks();

      const req = createMockReq({ headers: { authorization: 'Bearer invalid.token.here' } });
      const res = createMockRes();
      const next = createMockNext();

      await requireAuthSupabase(req, res, next);

      assert.equal(res.statusCode, 401);
      assert.equal(res.body.error, 'Unauthorized: invalid or expired token.');
      assert.equal(next.wasCalled(), false);
    });
  });

  describe('E. expired token', () => {
    it('returns 401', async () => {
      setExpiredTokenMocks();

      const req = createMockReq({ headers: { authorization: 'Bearer expired.token.here' } });
      const res = createMockRes();
      const next = createMockNext();

      await requireAuthSupabase(req, res, next);

      assert.equal(res.statusCode, 401);
      assert.equal(next.wasCalled(), false);
    });
  });

  describe('F. valid Supabase access token', () => {
    it('calls next() and sets req.user', async () => {
      setValidTokenMocks();
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.valid';

      const req = createMockReq({ headers: { authorization: `Bearer ${token}` } });
      const res = createMockRes();
      const next = createMockNext();

      await requireAuthSupabase(req, res, next);

      assert.equal(next.wasCalled(), true);
      assert.equal(next.arg(), undefined);
      assert.equal(req.user.id, mockAppUser.id);
      assert.equal(req.user.email, 'test@example.com');
      assert.equal(req.supabaseUser.id, mockSupabaseUser.id);
      assert.equal(req.token, token);
    });
  });

  describe('G. Supabase auth.getUser throws (service error)', () => {
    it('returns 401', async () => {
      setServiceErrorMocks();

      const req = createMockReq({ headers: { authorization: 'Bearer some.token' } });
      const res = createMockRes();
      const next = createMockNext();

      await requireAuthSupabase(req, res, next);

      assert.equal(res.statusCode, 401);
      assert.equal(res.body.error, 'Unauthorized: authentication failed.');
      assert.equal(next.wasCalled(), false);
    });
  });

  describe('G2. Supabase auth.getUser returns error object', () => {
    it('returns 401', async () => {
      setInvalidTokenMocks();

      const req = createMockReq({ headers: { authorization: 'Bearer bad.token' } });
      const res = createMockRes();
      const next = createMockNext();

      await requireAuthSupabase(req, res, next);

      assert.equal(res.statusCode, 401);
      assert.equal(next.wasCalled(), false);
    });
  });

  describe('H. x-user-id cannot bypass authentication', () => {
    it('returns 401 — no Authorization header', async () => {
      const req = createMockReq({
        headers: { 'x-user-id': 'fake-user-id-123' },
      });
      const res = createMockRes();
      const next = createMockNext();

      await requireAuthSupabase(req, res, next);

      assert.equal(res.statusCode, 401);
      assert.equal(next.wasCalled(), false);
    });
  });

  describe('I. x-school-id cannot bypass authentication', () => {
    it('returns 401 — no Authorization header', async () => {
      const req = createMockReq({
        headers: { 'x-school-id': 'fake-school-id-456' },
      });
      const res = createMockRes();
      const next = createMockNext();

      await requireAuthSupabase(req, res, next);

      assert.equal(res.statusCode, 401);
      assert.equal(next.wasCalled(), false);
    });
  });

  describe('J. user ID in request body cannot bypass authentication', () => {
    it('returns 401 — no Authorization header', async () => {
      const req = createMockReq({
        body: { userId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' },
      });
      const res = createMockRes();
      const next = createMockNext();

      await requireAuthSupabase(req, res, next);

      assert.equal(res.statusCode, 401);
      assert.equal(next.wasCalled(), false);
    });
  });

  describe('K. Bearer token that is a user ID (not a JWT)', () => {
    it('returns 401 — Supabase rejects non-JWT tokens', async () => {
      supabase.auth.getUser = async (token) => ({
        data: { user: null },
        error: { message: 'invalid JWT' },
      });

      const req = createMockReq({
        headers: { authorization: 'Bearer a1b2c3d4-e5f6-7890-abcd-ef1234567890' },
      });
      const res = createMockRes();
      const next = createMockNext();

      await requireAuthSupabase(req, res, next);

      assert.equal(res.statusCode, 401);
      assert.equal(next.wasCalled(), false);
    });
  });

  describe('L. CAPFLUX user not found after valid Supabase auth', () => {
    it('returns 401 — no matching public.users row', async () => {
      setMissingAppUserMocks();

      const req = createMockReq({ headers: { authorization: 'Bearer valid.token' } });
      const res = createMockRes();
      const next = createMockNext();

      await requireAuthSupabase(req, res, next);

      assert.equal(res.statusCode, 401);
      assert.equal(res.body.error, 'Unauthorized: CAPFLUX user not found.');
      assert.equal(next.wasCalled(), false);
    });
  });

  describe('M. headers cannot override authenticated identity', () => {
    it('uses JWT-derived user, ignores spoofed x-user-id/x-school-id', async () => {
      setValidTokenMocks();

      const req = createMockReq({
        headers: {
          authorization: 'Bearer legitimate-jwt',
          'x-user-id': 'spoofed-user-id',
          'x-school-id': 'spoofed-school-id',
        },
      });
      const res = createMockRes();
      const next = createMockNext();

      await requireAuthSupabase(req, res, next);

      assert.equal(next.wasCalled(), true);
      assert.equal(req.user.id, mockAppUser.id);
      assert.notEqual(req.user.id, 'spoofed-user-id');
    });
  });

  describe('N. Bearer token is extracted correctly', () => {
    it('passes the token (without "Bearer " prefix) to supabase.auth.getUser', async () => {
      let receivedToken = null;
      supabase.auth.getUser = async (token) => {
        receivedToken = token;
        return { data: { user: mockSupabaseUser }, error: null };
      };
      supabase.from = (table) => ({
        select: () => ({
          eq: () => ({
            single: async () => ({ data: mockAppUser, error: null }),
          }),
        }),
      });

      const testToken = 'my.jwt.token.string';
      const req = createMockReq({ headers: { authorization: `Bearer ${testToken}` } });
      const res = createMockRes();
      const next = createMockNext();

      await requireAuthSupabase(req, res, next);

      assert.equal(receivedToken, testToken);
      assert.equal(next.wasCalled(), true);
    });
  });
});
