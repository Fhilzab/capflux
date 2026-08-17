import { describe, it, expect } from 'vitest';
import { mapProviderError, getErrorMessage } from '../AuthError';

describe('AuthError', () => {
  it('maps invalid credentials', () => {
    const err = new Error('Invalid login credentials');
    (err as any).code = 'INVALID_CREDENTIALS';
    const result = mapProviderError(err);
    expect(result.code).toBe('INVALID_CREDENTIALS');
    expect(result.message).toContain('Invalid email or password');
  });

  it('maps network errors', () => {
    const err = new Error('Network Error');
    (err as any).code = 'NETWORK_ERROR';
    const result = mapProviderError(err);
    expect(result.code).toBe('NETWORK_ERROR');
    expect(result.message).toContain('Unable to connect');
  });

  it('maps duplicate account errors', () => {
    const err = new Error('user_already_exists');
    (err as any).code = 'USER_ALREADY_EXISTS';
    const result = mapProviderError(err);
    expect(result.code).toBe('USER_ALREADY_EXISTS');
    expect(result.message).toContain('already exists');
  });

  it('maps server errors', () => {
    const err = new Error('Internal server error');
    (err as any).code = 'SERVER_ERROR';
    const result = mapProviderError(err);
    expect(result.code).toBe('SERVER_ERROR');
  });

  it('returns unknown for unmapped errors', () => {
    const err = new Error('Something weird');
    const result = mapProviderError(err);
    expect(result.code).toBe('UNKNOWN');
  });

  it('does NOT map network error for 400/401/409 responses', () => {
    // A 400 validation error should never become NETWORK_ERROR
    const err = new Error('Password does not meet requirements');
    (err as any).code = 'WEAK_PASSWORD';
    (err as any).status = 400;
    const result = mapProviderError(err);
    expect(result.code).not.toBe('NETWORK_ERROR');
    expect(result.code).toBe('WEAK_PASSWORD');
  });

  it('maps weak password errors', () => {
    const err = new Error('Password does not meet requirements');
    (err as any).code = 'WEAK_PASSWORD';
    (err as any).status = 400;
    const result = mapProviderError(err);
    expect(result.code).toBe('WEAK_PASSWORD');
    expect(result.message).toContain('does not meet CAPFLUX');
  });

  it('maps breached password errors from message content', () => {
    const err = new Error('This password has appeared in a known data breach');
    const result = mapProviderError(err);
    expect(result.code).toBe('BREACHED_PASSWORD');
    expect(result.message).toContain('data breaches');
  });

  it('maps weak password from message content', () => {
    const err = new Error('Password does not meet the minimum requirements');
    const result = mapProviderError(err);
    expect(result.code).toBe('WEAK_PASSWORD');
  });

  it('maps breached password from code', () => {
    const err = new Error('Password rejected');
    (err as any).code = 'BREACHED_PASSWORD';
    const result = mapProviderError(err);
    expect(result.code).toBe('BREACHED_PASSWORD');
  });

  it('maps rate limited errors', () => {
    const err = new Error('Too many requests');
    (err as any).code = 'RATE_LIMITED';
    const result = mapProviderError(err);
    expect(result.code).toBe('RATE_LIMITED');
  });

  it('maps session expired errors', () => {
    const err = new Error('Session expired');
    (err as any).code = 'SESSION_EXPIRED';
    const result = mapProviderError(err);
    expect(result.code).toBe('SESSION_EXPIRED');
    expect(result.message).toContain('session has expired');
  });

  it('getErrorMessage returns friendly text', () => {
    expect(getErrorMessage('INVALID_CREDENTIALS')).toContain('Invalid email or password');
    expect(getErrorMessage('WEAK_PASSWORD')).toContain('does not meet CAPFLUX');
    expect(getErrorMessage('BREACHED_PASSWORD')).toContain('data breaches');
  });
});
