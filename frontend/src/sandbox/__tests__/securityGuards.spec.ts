/**
 * Sandbox isolation security tests.
 *
 * Guarantees under test:
 *  1. sandbox-only constructs REFUSE to operate in production mode;
 *  2. sandbox adapters can never bind live provider names;
 *  3. production mode resolves PRODUCTION providers from every factory;
 *  4. Supabase access is blocked while in sandbox mode.
 */
import { describe, expect, it, afterEach } from 'vitest';
import {
  __resolveRuntimeEnvironmentForTests,
} from '../../shared/environment/runtimeEnvironment';
import { assertNotLiveProviderName, SandboxIsolationError } from '../runtime/sandboxGuard';

afterEach(() => {
  __resolveRuntimeEnvironmentForTests('production');
});

describe('sandbox constructs fail closed outside sandbox mode', () => {
  it('SandboxGateway refuses construction in production', async () => {
    __resolveRuntimeEnvironmentForTests('production');
    const { SandboxGateway } = await import('../gateway/SandboxGateway');
    expect(() => new SandboxGateway()).toThrow(SandboxIsolationError);
  });

  it('SandboxAuthProvider refuses construction in production', async () => {
    __resolveRuntimeEnvironmentForTests('production');
    const { SandboxAuthProvider } = await import('../session/sandboxAuth');
    expect(() => new SandboxAuthProvider()).toThrow(SandboxIsolationError);
  });

  it('the sandbox database refuses to open in production', async () => {
    __resolveRuntimeEnvironmentForTests('production');
    const { getSandboxDb } = await import('../sandboxDb');
    expect(() => getSandboxDb()).toThrow(/sandbox-only/i);
  });

  it('installSandboxMode refuses to run in production', async () => {
    __resolveRuntimeEnvironmentForTests('production');
    const { installSandboxMode } = await import('../index');
    await expect(installSandboxMode()).rejects.toThrow(SandboxIsolationError);
  });
});

describe('live provider name binding is forbidden for sandbox code', () => {
  it('rejects monnify/paystack assignments', () => {
    expect(() => assertNotLiveProviderName('monnify')).toThrow(SandboxIsolationError);
    expect(() => assertNotLiveProviderName('Paystack')).toThrow(/live provider/i);
  });

  it('accepts the sandbox provider name', () => {
    expect(() => assertNotLiveProviderName('sandbox')).not.toThrow();
  });

  it('SandboxGateway constructor enforces the same rule', async () => {
    __resolveRuntimeEnvironmentForTests('sandbox');
    const { SandboxGateway } = await import('../gateway/SandboxGateway');
    expect(() => new SandboxGateway('monnify')).toThrow(/live provider/i);
  });
});

describe('provider factories resolve per mode', () => {
  it('production factories return the Supabase-backed providers', async () => {
    __resolveRuntimeEnvironmentForTests('production');
    const factories = await import('../providers/providerFactories');
    expect(factories.createStudentProvider()).toBeInstanceOf(Object);
    // In production the concrete type must be the Supabase adapter.
    const { SupabaseStudentProvider } = await import('../../shared/students/SupabaseStudentProvider');
    const { SupabaseAcademicProvider } = await import('../../shared/academic/SupabaseAcademicProvider');
    expect(factories.createStudentProvider()).toBeInstanceOf(SupabaseStudentProvider);
    expect(factories.createAcademicProvider()).toBeInstanceOf(SupabaseAcademicProvider);
  });

  it('sandbox factories return Dexie-backed sandbox providers', async () => {
    __resolveRuntimeEnvironmentForTests('sandbox');
    const factories = await import('../providers/providerFactories');
    const { SandboxStudentProvider } = await import('../providers/sandboxProviders');
    expect(factories.createStudentProvider()).toBeInstanceOf(SandboxStudentProvider);
  });
});

describe('supabase tripwire', () => {
  it('getSupabase() throws while sandbox mode is active', async () => {
    __resolveRuntimeEnvironmentForTests('sandbox');
    const lib = await import('../../lib/supabase');
    expect(() => lib.getSupabase()).toThrow(/Sandbox isolation/);
  });

  it('module import alone never crashes a sandbox bundle (eager client bypasses tripwire)', async () => {
    __resolveRuntimeEnvironmentForTests('sandbox');
    await expect(import('../../lib/supabase')).resolves.toBeTruthy();
  });
});
