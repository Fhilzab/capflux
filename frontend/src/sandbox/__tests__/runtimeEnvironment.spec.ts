/**
 * Runtime environment mode resolution — fail-closed guarantees.
 */
import { describe, expect, it, afterEach } from 'vitest';
import {
  resolveAppMode,
  __resolveRuntimeEnvironmentForTests,
  runtimeEnvironment,
} from '../../shared/environment/runtimeEnvironment';

afterEach(() => {
  __resolveRuntimeEnvironmentForTests('production');
});

describe('resolveAppMode', () => {
  it('defaults to production when unset', () => {
    expect(resolveAppMode(undefined)).toBe('production');
    expect(resolveAppMode('')).toBe('production');
  });

  it('accepts explicit sandbox and production values', () => {
    expect(resolveAppMode('sandbox')).toBe('sandbox');
    expect(resolveAppMode('production')).toBe('production');
  });

  it('normalizes casing and whitespace', () => {
    expect(resolveAppMode('  SANDBOX ')).toBe('sandbox');
  });

  it('FAILS CLOSED on unknown values — never silently sandboxes', () => {
    expect(resolveAppMode('demo')).toBe('production');
    expect(resolveAppMode('staging')).toBe('production');
    expect(resolveAppMode('Sandbox!')).toBe('production');
  });
});

describe('runtimeEnvironment singleton', () => {
  it('exposes isSandbox/isProduction consistently', () => {
    const sandbox = __resolveRuntimeEnvironmentForTests('sandbox');
    expect(sandbox.isSandbox).toBe(true);
    expect(sandbox.isProduction).toBe(false);

    const production = __resolveRuntimeEnvironmentForTests('production');
    expect(production.isSandbox).toBe(false);
    expect(production.isProduction).toBe(true);
    expect(runtimeEnvironment.mode).toBe('production');
  });
});
