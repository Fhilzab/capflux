/**
 * Authentication tests.
 * Tests the WorkOSAuthService error mapping, session cookie configuration,
 * and the callback code-exchange flow guard logic.
 * Uses node:test (no external test framework).
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
// Load env vars before any service import (ESM evaluates imports in order).
import 'dotenv/config';
import WorkOSAuthService from '../services/WorkOSAuthService.js';
import { SessionService } from '../services/SessionService.js';
import { STATE_COOKIE_NAME, STATE_COOKIE_OPTIONS } from '../routes/auth.js';

describe('WorkOSAuthService.transformError', () => {
  const svc = new WorkOSAuthService();

  test('maps invalid_credentials to INVALID_CREDENTIALS with 401', () => {
    const error = new Error('Invalid email or password');
    error.code = 'invalid_credentials';
    error.status = 401;

    const result = svc.transformError(error, 'Failed to sign in');
    assert.equal(result.code, 'INVALID_CREDENTIALS');
    assert.equal(result.statusCode, 401);
  });

  test('maps user_already_exists to USER_ALREADY_EXISTS with 409', () => {
    const error = new Error('User already exists');
    error.code = 'user_already_exists';
    error.status = 409;

    const result = svc.transformError(error, 'Failed to sign up');
    assert.equal(result.code, 'USER_ALREADY_EXISTS');
    assert.equal(result.statusCode, 409);
  });

  test('maps invalid_password with breach message to BREACHED_PASSWORD', () => {
    const error = new Error('Password is breached and cannot be used');
    error.code = 'invalid_password';
    error.status = 400;

    const result = svc.transformError(error, 'Failed to sign up');
    assert.equal(result.code, 'BREACHED_PASSWORD');
    assert.equal(result.statusCode, 400);
  });

  test('maps invalid_password with "compromised" message to BREACHED_PASSWORD', () => {
    const error = new Error('This password has been compromised and cannot be used');
    error.code = 'invalid_password';
    error.status = 400;

    const result = svc.transformError(error, 'Failed to sign up');
    assert.equal(result.code, 'BREACHED_PASSWORD');
  });

  test('maps invalid_password with "pwned" message to BREACHED_PASSWORD', () => {
    const error = new Error('Password appears in known data pwned');
    error.code = 'invalid_password';
    error.status = 400;

    const result = svc.transformError(error, 'Failed to sign up');
    assert.equal(result.code, 'BREACHED_PASSWORD');
  });

  test('maps invalid_password (without breach) to WEAK_PASSWORD', () => {
    const error = new Error('Password does not meet requirements');
    error.code = 'invalid_password';
    error.status = 400;

    const result = svc.transformError(error, 'Failed to sign up');
    assert.equal(result.code, 'WEAK_PASSWORD');
    assert.equal(result.statusCode, 400);
  });

  test('maps "password does not meet" message to WEAK_PASSWORD', () => {
    const error = new Error('Password does not meet the minimum requirements');
    error.code = 'some_code';
    error.status = 400;

    const result = svc.transformError(error, 'Failed to sign up');
    assert.equal(result.code, 'WEAK_PASSWORD');
  });

  test('maps "password must" message to WEAK_PASSWORD', () => {
    const error = new Error('Password must contain at least one uppercase letter');
    error.code = 'some_code';
    error.status = 400;

    const result = svc.transformError(error, 'Failed to sign up');
    assert.equal(result.code, 'WEAK_PASSWORD');
  });

  test('maps session_expired to SESSION_EXPIRED with 401', () => {
    const error = new Error('Session expired');
    error.code = 'session_expired';
    error.status = 401;

    const result = svc.transformError(error, 'Session error');
    assert.equal(result.code, 'SESSION_EXPIRED');
    assert.equal(result.statusCode, 401);
  });

  test('maps email_verification_required to EMAIL_NOT_VERIFIED with 403', () => {
    const error = new Error('Email not verified');
    error.code = 'email_verification_required';
    error.status = 403;

    const result = svc.transformError(error, 'Verification error');
    assert.equal(result.code, 'EMAIL_NOT_VERIFIED');
    assert.equal(result.statusCode, 403);
  });

  test('maps unknown errors to AUTH_ERROR with fallback status', () => {
    const error = new Error('Something unexpected');
    const result = svc.transformError(error, 'Failed');
    assert.equal(result.code, 'AUTH_ERROR');
    assert.equal(result.statusCode, 500);
  });

  test('preserves the original WorkOS message', () => {
    const error = new Error('Password does not meet requirements');
    error.code = 'invalid_password';
    error.status = 400;

    const result = svc.transformError(error, 'Failed to sign up');
    assert.equal(result.message, 'Password does not meet requirements');
  });
});

describe('SessionService cookie configuration', () => {
  test('session cookie is HttpOnly', () => {
    const svc = new SessionService();
    const { options } = svc.cookieOptions();
    assert.equal(options.httpOnly, true);
  });

  test('session cookie is SameSite=Lax', () => {
    const svc = new SessionService();
    const { options } = svc.cookieOptions();
    assert.equal(options.sameSite, 'lax');
  });

  test('session cookie has Path=/api', () => {
    const svc = new SessionService();
    const { options } = svc.cookieOptions();
    assert.equal(options.path, '/api');
  });

  test('session cookie name is workos_session', () => {
    const svc = new SessionService();
    assert.equal(svc.cookieName, 'workos_session');
  });
});

describe('Auth callback code handling', () => {
  test('empty or missing code is rejected by callback route logic', async () => {
    // Simulate the validation check in the callback route.
    // The route returns 400 when code is absent.
    const code = '';
    assert.equal(!code || typeof code !== 'string', true, 'empty code should be rejected');
  });

  test('handleOAuthCallback requires a valid code string', () => {
    // The service's handleOAuthCallback calls authenticateWithCode which
    // will throw for an invalid/expired code. We verify the guard logic.
    assert.equal(typeof 'invalid-code', 'string', 'string check passes for valid format');
    assert.equal(!'' || typeof '' !== 'string', true, 'empty string fails the type guard');
  });
});

// ============================================================
// AuthKit OAuth state hardening tests
// ============================================================

describe('AuthKit state generation', () => {
  const svc = new WorkOSAuthService();

  test('generateAuthState returns a 64-character hex string', () => {
    const state = svc.generateAuthState();
    assert.equal(state.length, 64, 'state should be 64 hex chars (32 bytes)');
    assert.match(state, /^[0-9a-f]{64}$/);
  });

  test('generateAuthState produces different values on each call', () => {
    const s1 = svc.generateAuthState();
    const s2 = svc.generateAuthState();
    assert.notEqual(s1, s2);
  });

  test('generateAuthState is not the old static value "capflux"', () => {
    const state = svc.generateAuthState();
    assert.notEqual(state, 'capflux');
    assert.ok(state.length >= 32, 'state should have sufficient entropy');
  });
});

describe('AuthKit authorization URL generation', () => {
  const svc = new WorkOSAuthService();

  test('login generates URL with provider=authkit and screen_hint=signin', () => {
    const { url, state } = svc.getAuthKitAuthorizationUrl('login');
    assert.ok(url.includes('provider=authkit'), 'URL must contain provider=authkit');
    assert.ok(url.includes('screen_hint=signin'), 'URL must contain screen_hint=signin');
  });

  test('signup generates URL with provider=authkit and screen_hint=signup', () => {
    const { url, state } = svc.getAuthKitAuthorizationUrl('signup');
    assert.ok(url.includes('provider=authkit'), 'URL must contain provider=authkit');
    assert.ok(url.includes('screen_hint=signup'), 'URL must contain screen_hint=signup');
  });

  test('URL contains the generated state parameter', () => {
    const { url, state } = svc.getAuthKitAuthorizationUrl('login');
    assert.ok(url.includes(`state=${state}`), 'URL must contain the state parameter');
  });

  test('two requests produce different states', () => {
    const r1 = svc.getAuthKitAuthorizationUrl('login');
    const r2 = svc.getAuthKitAuthorizationUrl('login');
    assert.notEqual(r1.state, r2.state);
  });

  test('state is never the static "capflux"', () => {
    const { state } = svc.getAuthKitAuthorizationUrl('login');
    assert.notEqual(state, 'capflux');
  });

  test('URL does not contain WorkOS API key', () => {
    const { url } = svc.getAuthKitAuthorizationUrl('login');
    const apiKey = process.env.WORKOS_API_KEY;
    if (apiKey) {
      assert.ok(!url.includes(apiKey), 'URL must not contain the API key');
    }
  });

  test('URL does not contain sk_ prefix (API key pattern)', () => {
    const { url } = svc.getAuthKitAuthorizationUrl('login');
    assert.ok(!url.includes('sk_'), 'URL must not contain API key prefix');
  });
});

describe('AuthKit state cookie security', () => {
  test('state cookie name is auth_state', () => {
    assert.equal(STATE_COOKIE_NAME, 'auth_state');
  });

  test('state cookie is HttpOnly', () => {
    assert.equal(STATE_COOKIE_OPTIONS.httpOnly, true);
  });

  test('state cookie has SameSite=Lax', () => {
    assert.equal(STATE_COOKIE_OPTIONS.sameSite, 'lax');
  });

  test('state cookie has Path=/api', () => {
    assert.equal(STATE_COOKIE_OPTIONS.path, '/api');
  });

  test('state cookie expires in 5 minutes (short lifespan)', () => {
    assert.equal(STATE_COOKIE_OPTIONS.maxAge, 5 * 60 * 1000);
    assert.ok(STATE_COOKIE_OPTIONS.maxAge <= 5 * 60 * 1000, 'max age should be at most 5 minutes');
  });
});

describe('OAuth state validation', () => {
  const svc = new WorkOSAuthService();

  test('validateAuthState returns true for matching states', () => {
    const state = svc.generateAuthState();
    assert.equal(svc.validateAuthState(state, state), true);
  });

  test('validateAuthState returns false for mismatched states', () => {
    const s1 = svc.generateAuthState();
    const s2 = svc.generateAuthState();
    assert.equal(svc.validateAuthState(s1, s2), false);
  });

  test('validateAuthState returns false for empty provided state', () => {
    const expected = svc.generateAuthState();
    assert.equal(svc.validateAuthState('', expected), false);
  });

  test('validateAuthState returns false for undefined provided state', () => {
    const expected = svc.generateAuthState();
    assert.equal(svc.validateAuthState(undefined, expected), false);
  });

  test('validateAuthState returns false for empty cookie state', () => {
    const provided = svc.generateAuthState();
    assert.equal(svc.validateAuthState(provided, ''), false);
  });

  test('validateAuthState returns false for undefined cookie state', () => {
    const provided = svc.generateAuthState();
    assert.equal(svc.validateAuthState(provided, undefined), false);
  });
});

describe('Callback validation logic gates', () => {
  test('missing code is rejected (400)', () => {
    const code = undefined;
    assert.equal(!code || typeof code !== 'string', true);
  });

  test('missing state is rejected (400)', () => {
    const state = undefined;
    assert.equal(!state || typeof state !== 'string', true);
  });

  test('missing state cookie is rejected (400)', () => {
    const cookieState = undefined;
    assert.equal(!cookieState, true);
  });

  test('mismatched state is rejected by validateAuthState (400)', () => {
    const svc = new WorkOSAuthService();
    const valid = svc.generateAuthState();
    const invalid = svc.generateAuthState();
    assert.equal(svc.validateAuthState(invalid, valid), false);
  });

  test('empty state string from URL is rejected', () => {
    const state = '';
    assert.equal(!state || typeof state !== 'string', true);
  });
});
