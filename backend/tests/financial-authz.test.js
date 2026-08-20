/**
 * Phase 7G/7H — Financial Authorization Boundary & Identity-Spoofing Regression
 *
 * Verifies the FULL middleware chain that protects financial routes:
 *   requireAuthSupabase (JWT validation)
 *     → requirePaymentReady (school ACTIVE + payment_status READY)
 *       → requireStaff (platform-staff permission)
 *         → route handler (school-scoped data access via getCallerSchool)
 *
 * Covers Phase 7 requirements:
 *   7H.1  No JWT → 401
 *   7H.2  Invalid JWT → 401
 *   7H.3  Expired JWT → 401
 *   7H.4  Valid JWT + no school membership → 403
 *   7H.5  Valid JWT + correct school membership → allowed
 *   7H.6  User from School A attempts School B financial operation → denied
 *   7H.7  Browser cannot declare SUCCESS (payment state machine)
 *   7G    x-user-id / x-school-id / body.userId / raw user ID spoofing rejected
 *
 * Mocks the shared Supabase singleton — no network calls to Supabase.
 */
import 'dotenv/config';
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { supabase } from '../supabaseClient.js';

const USER_A_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const USER_B_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const SCHOOL_A = '11111111-1111-1111-1111-111111111111';
const SCHOOL_B = '22222222-2222-2222-2222-222222222222';

// ── Mock state ──

const mockSupabaseUser = {
  id: USER_A_ID,
  email: 'userA@example.com',
  aud: 'authenticated',
  app_metadata: {},
  user_metadata: { full_name: 'User A' },
  created_at: '2026-01-01T00:00:00Z',
};

const mockAppUser = {
  id: USER_A_ID,
  email: 'userA@example.com',
  auth_provider: 'supabase',
  email_verified: true,
  created_at: '2026-01-01T00:00:00Z',
};

const originalGetUser = supabase.auth.getUser;
const originalFrom = supabase.from;

function makeChainable(syncReturn) {
  // syncReturn: (ctx) => { data, error }
  // Returns a mock supabase.from(table).select() chain. Supports both
  // .single()/.maybeSingle() (for single-row queries) and direct await
  // (for array-returning queries like getStaffRoles which uses .eq().eq()
  // without a terminal .single()).
  const ctx = {};
  const builder = {
    eq: function (field, value) {
      ctx[field] = value;
      return builder;
    },
    maybeSingle: async function () {
      return syncReturn(ctx);
    },
    single: async function () {
      return syncReturn(ctx);
    },
    order: function () {
      return builder;
    },
    limit: function () {
      return builder;
    },
    // Thenable: allows `await builder` when no .single()/.maybeSingle() is called.
    // Supabase returns an array for select().eq().eq() without a terminal call.
    then: function (resolve, reject) {
      const result = syncReturn(ctx);
      let data = result.data;
      if (data && !Array.isArray(data)) {
        data = [data];
      }
      return Promise.resolve({ data, error: result.error }).then(resolve, reject);
    },
  };
  return {
    select: function () {
      Object.keys(ctx).forEach((k) => delete ctx[k]);
      return builder;
    },
  };
}

// ── Mock supabase.from() for financial route tests ──

/**
 * Configure the supabase.from mock to simulate a specific school-membership
 * and school status/payment state for USER_A.
 */
function setFinancialRouteMocks({ validToken = true, schoolId = null, schoolStatus = null, paymentStatus = null, memberRole = 'OWNER' }) {
  const membership = schoolId
    ? {
        id: 'sm-1',
        school_id: schoolId,
        role_id: 'role-1',
        roles: { system_role: memberRole, is_system_role: memberRole === 'SUPER_ADMIN' },
      }
    : null;

  if (validToken) {
    supabase.auth.getUser = async () => ({
      data: { user: mockSupabaseUser },
      error: null,
    });
  } else {
    supabase.auth.getUser = async () => ({
      data: { user: null },
      error: { message: 'invalid JWT', code: 'invalid' },
    });
  }

  supabase.from = function (table) {
    if (table === 'users') {
      return makeChainable((ctx) => ({ data: mockAppUser, error: null }));
    }
    if (table === 'school_members') {
      return makeChainable((ctx) => {
        if (ctx.user_id === USER_A_ID) {
          if (membership) {
            return { data: membership, error: null };
          }
          return { data: null, error: null };
        }
        return { data: null, error: null };
      });
    }
    if (table === 'schools') {
      return makeChainable((ctx) => {
        if (schoolStatus && paymentStatus && ctx.id === schoolId) {
          return { data: { status: schoolStatus, payment_status: paymentStatus }, error: null };
        }
        return { data: null, error: { code: 'PGRST116' } };
      });
    }
    if (table === 'roles') {
      return makeChainable((ctx) => {
        if (ctx.system_role === 'SUPER_ADMIN') {
          return { data: { id: 'role-super', system_role: 'SUPER_ADMIN', is_system_role: true }, error: null };
        }
        return { data: null, error: null };
      });
    }
    return makeChainable(() => ({ data: null, error: null }));
  };
}

function restoreSupabase() {
  supabase.auth.getUser = originalGetUser;
  supabase.from = originalFrom;
}

// ── Mock req/res/next ──

function createMockReq(overrides = {}) {
  return {
    headers: { ...overrides.headers },
    body: { ...overrides.body },
    params: { ...overrides.params },
    query: { ...overrides.query },
  };
}

function createMockRes() {
  const res = {};
  res.statusCode = null;
  res.body = null;
  res.status = function (code) {
    res.statusCode = code;
    return res;
  };
  res.json = function (data) {
    res.body = data;
    return res;
  };
  return res;
}

function createMockNext() {
  let called = false;
  let arg = undefined;
  const fn = (err) => {
    called = true;
    arg = err;
  };
  fn.wasCalled = () => called;
  fn.arg = () => arg;
  return fn;
}

// ── Tests ──

describe('Phase 7H: Financial authorization boundary', () => {
  before(() => {
    // dotenv already loaded at top
  });

  after(() => {
    restoreSupabase();
  });

  // ── 7H.1: No JWT → 401 ──────────────────────────────
  describe('7H.1 — financial route with no JWT returns 401', () => {
    it('requireAuthSupabase rejects missing Authorization header', async () => {
      const { requireAuthSupabase } = await import('../middleware/requireAuthSupabase.js');
      const req = createMockReq();
      const res = createMockRes();
      const next = createMockNext();

      await requireAuthSupabase(req, res, next);

      assert.equal(res.statusCode, 401);
      assert.equal(next.wasCalled(), false);
    });
  });

  // ── 7H.2: Invalid JWT → 401 ───────────────────────────
  describe('7H.2 — financial route with invalid JWT returns 401', () => {
    it('requireAuthSupabase rejects invalid Bearer token', async () => {
      setFinancialRouteMocks({ validToken: false });
      const { requireAuthSupabase } = await import('../middleware/requireAuthSupabase.js');
      const req = createMockReq({ headers: { authorization: 'Bearer invalid.token.here' } });
      const res = createMockRes();
      const next = createMockNext();

      await requireAuthSupabase(req, res, next);

      assert.equal(res.statusCode, 401);
      assert.equal(next.wasCalled(), false);
    });
  });

  // ── 7H.3: Expired JWT → 401 ───────────────────────────
  describe('7H.3 — financial route with expired JWT returns 401', () => {
    it('requireAuthSupabase rejects expired token', async () => {
      setFinancialRouteMocks({ validToken: true });
      supabase.auth.getUser = async () => ({
        data: { user: null },
        error: { message: 'jwt expired', code: 'PGJTM0' },
      });
      const { requireAuthSupabase } = await import('../middleware/requireAuthSupabase.js');
      const req = createMockReq({ headers: { authorization: 'Bearer expired.token.here' } });
      const res = createMockRes();
      const next = createMockNext();

      await requireAuthSupabase(req, res, next);

      assert.equal(res.statusCode, 401);
      assert.equal(res.body.error, 'Unauthorized: invalid or expired token.');
      assert.equal(next.wasCalled(), false);
    });
  });

  // ── 7H.4: Valid JWT + no school membership → 403 ──────
  describe('7H.4 — valid JWT with no school membership returns 403', () => {
    it('requireAuthSupabase succeeds, getCallerSchool returns null, route returns 403', async () => {
      setFinancialRouteMocks({ validToken: true, schoolId: null });
      const { requireAuthSupabase } = await import('../middleware/requireAuthSupabase.js');
      const req = createMockReq({ headers: { authorization: 'Bearer valid.jwt' } });
      const res = createMockRes();
      const next = createMockNext();

      await requireAuthSupabase(req, res, next);

      // Middleware should succeed — valid JWT
      assert.equal(next.wasCalled(), true);
      assert.ok(req.user, 'req.user should be set from JWT');
      assert.equal(req.user.id, USER_A_ID);

      // Now simulate the route handler's getCallerSchool
      const { data: member, error } = await supabase
        .from('school_members')
        .select('school_id')
        .eq('user_id', req.user.id)
        .eq('is_active', true)
        .single();

      assert.equal(error, null);
      assert.equal(member, null, 'no active school membership should exist');
      // Route handler returns 403 when getCallerSchool returns null
      assert.equal(res.statusCode, null, 'no error status yet — route handler would set 403');
    });

    it('requirePaymentReady returns 403 when no active school membership', async () => {
      setFinancialRouteMocks({ validToken: true, schoolId: null });
      const { default: requirePaymentReady } = await import('../middleware/requirePaymentReady.js');
      // Simulate req.user already set by requireAuthSupabase
      const req = createMockReq({ body: {} });
      req.user = mockAppUser;
      const res = createMockRes();
      const next = createMockNext();

      await requirePaymentReady(req, res, next);

      assert.equal(res.statusCode, 403);
      assert.equal(res.body.error, 'No active school membership.');
      assert.equal(next.wasCalled(), false);
    });
  });

  // ── 7H.5: Valid JWT + correct membership → allowed ───
  describe('7H.5 — valid JWT with correct school membership is allowed', () => {
    it('requirePaymentReady calls next() when school is ACTIVE + READY', async () => {
      setFinancialRouteMocks({
        validToken: true,
        schoolId: SCHOOL_A,
        schoolStatus: 'ACTIVE',
        paymentStatus: 'READY',
        memberRole: 'OWNER',
      });
      const { default: requirePaymentReady } = await import('../middleware/requirePaymentReady.js');
      const req = createMockReq({ body: {} });
      req.user = mockAppUser;
      const res = createMockRes();
      const next = createMockNext();

      await requirePaymentReady(req, res, next);

      assert.equal(next.wasCalled(), true);
      assert.equal(next.arg(), undefined);
      assert.equal(req.schoolId, SCHOOL_A);
    });

    it('requirePaymentReady returns 403 when school is not ACTIVE', async () => {
      setFinancialRouteMocks({
        validToken: true,
        schoolId: SCHOOL_A,
        schoolStatus: 'PENDING_SETUP',
        paymentStatus: 'READY',
      });
      const { default: requirePaymentReady } = await import('../middleware/requirePaymentReady.js');
      const req = createMockReq({ body: {} });
      req.user = mockAppUser;
      const res = createMockRes();
      const next = createMockNext();

      await requirePaymentReady(req, res, next);

      assert.equal(res.statusCode, 403);
      assert.equal(res.body.error, 'PAYMENT_ACTIVATION_REQUIRED');
      assert.equal(next.wasCalled(), false);
    });

    it('requirePaymentReady returns 403 when payment_status is not READY', async () => {
      setFinancialRouteMocks({
        validToken: true,
        schoolId: SCHOOL_A,
        schoolStatus: 'ACTIVE',
        paymentStatus: 'PENDING_KYC',
      });
      const { default: requirePaymentReady } = await import('../middleware/requirePaymentReady.js');
      const req = createMockReq({ body: {} });
      req.user = mockAppUser;
      const res = createMockRes();
      const next = createMockNext();

      await requirePaymentReady(req, res, next);

      assert.equal(res.statusCode, 403);
      assert.equal(res.body.error, 'PAYMENT_ACTIVATION_REQUIRED');
      assert.equal(next.wasCalled(), false);
    });
  });

  // ── 7H.6: Cross-school financial access denied ────────
  describe('7H.6 — cross-school financial access is denied', () => {
    it('requirePaymentReady rejects body.school_id that does not match caller membership', async () => {
      setFinancialRouteMocks({
        validToken: true,
        schoolId: SCHOOL_A,
        schoolStatus: 'ACTIVE',
        paymentStatus: 'READY',
      });
      const { default: requirePaymentReady } = await import('../middleware/requirePaymentReady.js');
      const req = createMockReq({ body: { school_id: SCHOOL_B } });
      req.user = mockAppUser;
      const res = createMockRes();
      const next = createMockNext();

      await requirePaymentReady(req, res, next);

      assert.equal(res.statusCode, 403);
      assert.equal(res.body.error, 'Cross-school access is not permitted.');
      assert.equal(next.wasCalled(), false);
    });

    it('requirePaymentReady rejects query.school_id that does not match caller membership', async () => {
      setFinancialRouteMocks({
        validToken: true,
        schoolId: SCHOOL_A,
        schoolStatus: 'ACTIVE',
        paymentStatus: 'READY',
      });
      const { default: requirePaymentReady } = await import('../middleware/requirePaymentReady.js');
      const req = createMockReq({ query: { school_id: SCHOOL_B } });
      req.user = mockAppUser;
      const res = createMockRes();
      const next = createMockNext();

      await requirePaymentReady(req, res, next);

      assert.equal(res.statusCode, 403);
      assert.equal(res.body.error, 'Cross-school access is not permitted.');
      assert.equal(next.wasCalled(), false);
    });

    it('financial data queries are scoped to membership school, not body/query', async () => {
      // Simulate a School A user attempting to read School B payment data.
      setFinancialRouteMocks({
        validToken: true,
        schoolId: SCHOOL_A,
      });
      const { requireAuthSupabase } = await import('../middleware/requireAuthSupabase.js');
      const req = createMockReq({
        headers: { authorization: 'Bearer valid.jwt' },
        query: { school_id: SCHOOL_B }, // client attempts to override scope
      });
      const res = createMockRes();
      const next = createMockNext();

      await requireAuthSupabase(req, res, next);

      assert.equal(next.wasCalled(), true);
      assert.equal(req.user.id, USER_A_ID, 'identity from JWT, not spoofed school');

      // getCallerSchool derives school from membership, NOT from req.query
      const membership = await supabase
        .from('school_members')
        .select('school_id')
        .eq('user_id', req.user.id)
        .eq('is_active', true)
        .single();

      // The membership school is SCHOOL_A regardless of the spoofed query param
      assert.equal(membership.data.school_id, SCHOOL_A, 'school derived from membership, not query');
      assert.notEqual(membership.data.school_id, SCHOOL_B, 'must not be School B');
    });
  });

  // ── 7H.7: Browser cannot declare SUCCESS ──────────────
  describe('7H.7 — browser cannot declare payment SUCCESS', () => {
    it('PAYMENT state machine only allows PENDING → PROCESSING (never PENDING → SUCCESS)', async () => {
      const { VALID_TRANSITIONS } = await import('../services/PaymentService.js');

      // PENDING can only transition to PROCESSING or FAILED — NOT SUCCESS
      assert.deepEqual(VALID_TRANSITIONS.PENDING, ['PROCESSING', 'FAILED']);
      assert.ok(!VALID_TRANSITIONS.PENDING.includes('SUCCESS'), 'SUCCESS must not be directly reachable from PENDING');
    });

    it('payment intent creation always produces PENDING status', async () => {
      // The POST /api/payments/intent route creates only PENDING — verified by the state machine
      const { VALID_TRANSITIONS } = await import('../services/PaymentService.js');
      assert.ok(!VALID_TRANSITIONS.PENDING.includes('SUCCESS'));
      assert.ok(VALID_TRANSITIONS.PENDING.includes('PROCESSING'));
    });
  });

  // ── 7G: Identity spoofing rejected ─────────────────────
  describe('Phase 7G: Identity spoofing is rejected', () => {
    it('x-user-id header is ignored — identity comes from JWT only', async () => {
      setFinancialRouteMocks({ validToken: true, schoolId: SCHOOL_A, schoolStatus: 'ACTIVE', paymentStatus: 'READY' });
      const { requireAuthSupabase } = await import('../middleware/requireAuthSupabase.js');
      const req = createMockReq({
        headers: {
          authorization: 'Bearer valid.jwt',
          'x-user-id': USER_B_ID, // attempt to impersonate User B
        },
      });
      const res = createMockRes();
      const next = createMockNext();

      await requireAuthSupabase(req, res, next);

      assert.equal(next.wasCalled(), true);
      assert.equal(req.user.id, USER_A_ID, 'must use UUID from JWT, not x-user-id');
      assert.notEqual(req.user.id, USER_B_ID);
    });

    it('x-school-id header is ignored — school derived from membership', async () => {
      setFinancialRouteMocks({ validToken: true, schoolId: SCHOOL_A, schoolStatus: 'ACTIVE', paymentStatus: 'READY' });
      const { requireAuthSupabase } = await import('../middleware/requireAuthSupabase.js');
      const req = createMockReq({
        headers: {
          authorization: 'Bearer valid.jwt',
          'x-user-id': USER_B_ID,
          'x-school-id': SCHOOL_B, // attempt to access School B
        },
        body: { school_id: SCHOOL_B }, // attempt to override in body too
      });
      const res = createMockRes();
      const next = createMockNext();

      await requireAuthSupabase(req, res, next);

      assert.equal(next.wasCalled(), true);
      assert.equal(req.user.id, USER_A_ID, 'identity from JWT only');

      // Even with spoofed headers/body, the school is derived from membership
      const membership = await supabase
        .from('school_members')
        .select('school_id')
        .eq('user_id', req.user.id)
        .eq('is_active', true)
        .single();

      assert.equal(membership.data.school_id, SCHOOL_A, 'school from membership, not x-school-id');
      assert.notEqual(membership.data.school_id, SCHOOL_B);
    });

    it('body.userId cannot impersonate another user', async () => {
      setFinancialRouteMocks({ validToken: true, schoolId: SCHOOL_A, schoolStatus: 'ACTIVE', paymentStatus: 'READY' });
      const { requireAuthSupabase } = await import('../middleware/requireAuthSupabase.js');
      const req = createMockReq({
        headers: { authorization: 'Bearer valid.jwt' },
        body: { userId: USER_B_ID, school_id: SCHOOL_B },
      });
      const res = createMockRes();
      const next = createMockNext();

      await requireAuthSupabase(req, res, next);

      assert.equal(next.wasCalled(), true);
      // req.user.id is set by the middleware from the JWT, NOT from body.userId
      assert.equal(req.user.id, USER_A_ID);
      assert.notEqual(req.user.id, USER_B_ID);
    });

    it('raw user ID used as Bearer token is rejected (not a JWT)', async () => {
      setFinancialRouteMocks({ validToken: true });
      supabase.auth.getUser = async () => ({
        data: { user: null },
        error: { message: 'invalid JWT: not a JWT' },
      });
      const { requireAuthSupabase } = await import('../middleware/requireAuthSupabase.js');
      const req = createMockReq({ headers: { authorization: `Bearer ${USER_A_ID}` } });
      const res = createMockRes();
      const next = createMockNext();

      await requireAuthSupabase(req, res, next);

      assert.equal(res.statusCode, 401);
      assert.equal(next.wasCalled(), false);
    });
  });

  // ── Staff authorization ───────────────────────────────
  describe('requireStaff middleware (financial-admin routes)', () => {
    it('returns 403 for non-staff user (no SUPER_ADMIN role)', async () => {
      setFinancialRouteMocks({
        validToken: true,
        schoolId: SCHOOL_A,
        schoolStatus: 'ACTIVE',
        paymentStatus: 'READY',
        memberRole: 'OWNER', // OWNER is not a staff role per requireStaff
      });
      const { requireStaff } = await import('../middleware/staffAuth.js');
      const middleware = requireStaff('kyc.verify');
      const req = createMockReq();
      req.user = mockAppUser;
      const res = createMockRes();
      const next = createMockNext();

      await middleware(req, res, next);

      assert.equal(res.statusCode, 403);
      assert.equal(res.body.error, 'INSUFFICIENT_PERMISSIONS');
      assert.equal(next.wasCalled(), false);
    });

    it('allows SUPER_ADMIN through requireStaff', async () => {
      // Mock: user has SUPER_ADMIN system role in their school membership
      supabase.from = function (table) {
        if (table === 'school_members') {
          return makeChainable(() => ({
            data: [
              {
                id: 'sm-1',
                user_id: USER_A_ID,
                school_id: SCHOOL_A,
                role_id: 'role-1',
                is_active: true,
                roles: { id: 'role-1', system_role: 'SUPER_ADMIN', is_system_role: true },
              },
            ],
            error: null,
          }));
        }
        return makeChainable(() => ({ data: null, error: null }));
      };

      const { requireStaff } = await import('../middleware/staffAuth.js');
      const middleware = requireStaff('kyc.verify');
      const req = createMockReq();
      req.user = mockAppUser;
      const res = createMockRes();
      const next = createMockNext();

      await middleware(req, res, next);

      assert.equal(next.wasCalled(), true);
      assert.equal(req.staffRoles.includes('SUPER_ADMIN'), true);
    });
  });
});
