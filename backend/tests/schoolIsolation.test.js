/**
 * Security regression tests: school isolation (cross-tenant access prevention).
 *
 * These tests verify that a valid Supabase-authenticated user cannot access
 * data belonging to a school they do not belong to.
 *
 * Identity is established via a Supabase JWT (no x-user-id, no x-school-id,
 * no body-embedded user IDs). School membership is resolved exclusively
 * through the school_members table using req.user.id (a UUID).
 */
import 'dotenv/config';
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { supabase } from '../supabaseClient.js';
import { AuthorizationService } from '../services/AuthorizationService.js';

const authz = new AuthorizationService();

// ── Generic chainable mock builder ────────────────────────

/** Creates a mock `from(table)` result whose .select().eq().eq()...maybeSingle()
 *  chain resolves based on the accumulated eq() context. */
function chainable(resultFn) {
  const ctx = {};
  const builder = {
    eq: function (field, value) {
      ctx[field] = value;
      return builder;
    },
    maybeSingle: async function () {
      return resultFn(ctx);
    },
    single: async function () {
      return resultFn(ctx);
    },
  };
  return {
    select: function () {
      // Reset context on each new select() call
      Object.keys(ctx).forEach((k) => delete ctx[k]);
      return builder;
    },
  };
}

// ── Track calls ──────────────────────────────────────────

let fromCalls = [];

// ── Tests ──────────────────────────────────────────────────

describe('school isolation (AuthorizationService)', () => {
  const USER_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
  const OWN_SCHOOL = 'aaaa0000-0000-0000-0000-000000000001';
  const OTHER_SCHOOL = 'bbbb0000-0000-0000-0000-000000000002';

  const mockMembership = {
    id: 1,
    school_id: OWN_SCHOOL,
    role_id: 1,
    roles: { system_role: 'ADMIN' },
  };

  let originalFrom;

  beforeEach(() => {
    fromCalls = [];
    originalFrom = supabase.from;
    supabase.from = function (table) {
      if (table === 'school_members') {
        return chainable((ctx) => {
          fromCalls.push({ table, userId: ctx.user_id, schoolId: ctx.school_id });
          const schoolId = ctx.school_id;
          if (schoolId === OWN_SCHOOL) {
            return { data: mockMembership, error: null };
          }
          // Any other school → no membership
          return { data: null, error: null };
        });
      }
      // Fallback for any other table
      return {
        select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }),
      };
    };
  });

  afterEach(() => {
    supabase.from = originalFrom;
  });

  it('user with valid membership for own school returns membership', async () => {
    const result = await authz.getSchoolMembership(USER_ID, OWN_SCHOOL);

    assert.ok(result, 'should return a membership object');
    assert.equal(result.schoolId, OWN_SCHOOL, 'membership should be for own school');
    assert.equal(result.role, 'ADMIN');
  });

  it('user without membership for another school returns null', async () => {
    const result = await authz.getSchoolMembership(USER_ID, OTHER_SCHOOL);

    assert.equal(result, null, 'should return null — no membership in other school');
    assert.equal(fromCalls.length, 1, 'should have queried school_members exactly once');
  });

  it('all membership queries filter by user_id UUID', async () => {
    await authz.getSchoolMembership(USER_ID, OWN_SCHOOL);
    await authz.getSchoolMembership(USER_ID, OTHER_SCHOOL);

    for (const call of fromCalls) {
      assert.equal(call.userId, USER_ID, 'query must filter by the authenticated user UUID');
    }
  });
});

describe('school isolation (requireAuthSupabase + AuthorizationService)', () => {
  const USER_ID = 'c1c2c3d4-e5f6-7890-abcd-ef1234567890';
  const OWN_SCHOOL = 'cccc0000-0000-0000-0000-000000000001';
  const OTHER_SCHOOL = 'dddd0000-0000-0000-0000-000000000002';

  let originalGetUser;
  let originalFrom;

  beforeEach(async () => {
    originalGetUser = supabase.auth.getUser;
    originalFrom = supabase.from;

    // Mock: valid token "valid-token-for-user-1" returns a Supabase user
    supabase.auth.getUser = async (token) => {
      if (token === 'valid-token-for-user-1') {
        return { data: { user: { id: USER_ID, email: 'user1@example.com' } }, error: null };
      }
      return { data: { user: null }, error: { message: 'invalid token', code: 'invalid_token' } };
    };

    // Mock: all supabase.from() calls
    const mockMembership = {
      id: 2,
      school_id: OWN_SCHOOL,
      role_id: 1,
      roles: { system_role: 'OWNER' },
    };

    supabase.from = function (table) {
      if (table === 'users') {
        return chainable((ctx) => {
          // .select().eq('id', USER_ID).single()
          if (ctx.id === USER_ID) {
            return { data: { id: USER_ID, email: 'user1@example.com', auth_provider: 'supabase' }, error: null };
          }
          return { data: null, error: null };
        });
      }
      if (table === 'school_members') {
        return chainable((ctx) => {
          const schoolId = ctx.school_id;
          if (schoolId === OWN_SCHOOL) {
            return { data: mockMembership, error: null };
          }
          return { data: null, error: null };
        });
      }
      // Fallback
      return {
        select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }),
      };
    };
  });

  afterEach(() => {
    supabase.auth.getUser = originalGetUser;
    supabase.from = originalFrom;
  });

  // Helper: minimal Express-like request/response objects
  function createReq(options = {}) {
    return {
      headers: options.headers || {},
      body: options.body || {},
      params: options.params || {},
      query: options.query || {},
    };
  }

  function createRes() {
    const res = {};
    res.statusCode = null;
    res.body = null;
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (data) => { res.body = data; return res; };
    return res;
  }

  it('middleware authenticates valid token, then authorization denies other school', async () => {
    const { requireAuthSupabase } = await import('../middleware/requireAuthSupabase.js');

    const req = createReq({ headers: { authorization: 'Bearer valid-token-for-user-1' } });
    const res = createRes();
    let nextCalled = false;
    const next = () => { nextCalled = true; };

    // Run the middleware
    await requireAuthSupabase(req, res, next);

    // Middleware should succeed — valid JWT
    assert.equal(res.statusCode, null, 'should not have sent 401 — token is valid');
    assert.ok(req.user, 'req.user should be set');
    assert.equal(req.user.id, USER_ID, 'req.user.id must be UUID from JWT');
    assert.ok(nextCalled, 'next() should be called');

    // Now test authorization: user CANNOT access OTHER_SCHOOL
    const denied = await authz.getSchoolMembership(USER_ID, OTHER_SCHOOL);
    assert.equal(denied, null, 'user must not have membership in OTHER_SCHOOL');

    // But CAN access OWN_SCHOOL
    const allowed = await authz.getSchoolMembership(USER_ID, OWN_SCHOOL);
    assert.ok(allowed, 'user should have membership in OWN_SCHOOL');
    assert.equal(allowed.schoolId, OWN_SCHOOL);
  });

  it('x-user-id header is present but ignored (authentication from JWT only)', async () => {
    const { requireAuthSupabase } = await import('../middleware/requireAuthSupabase.js');

    const req = createReq({
      headers: {
        authorization: 'Bearer valid-token-for-user-1',
        'x-user-id': 'spoofed-user-id',
        'x-school-id': 'spoofed-school-id',
      },
    });
    const res = createRes();
    const next = () => {};

    await requireAuthSupabase(req, res, next);

    assert.equal(req.user.id, USER_ID, 'must use UUID from JWT, not x-user-id header');
    assert.notEqual(req.user.id, 'spoofed-user-id', 'x-user-id must not influence req.user.id');
  });

  it('raw user ID used as Bearer token is rejected', async () => {
    const { requireAuthSupabase } = await import('../middleware/requireAuthSupabase.js');

    const req = createReq({
      headers: { authorization: `Bearer ${USER_ID}` },
    });
    const res = createRes();
    let nextCalled = false;
    const next = () => { nextCalled = true; };

    await requireAuthSupabase(req, res, next);

    assert.equal(res.statusCode, 401, 'raw user ID as Bearer token must be rejected');
    assert.equal(nextCalled, false, 'next() must not be called for invalid token');
  });
});
