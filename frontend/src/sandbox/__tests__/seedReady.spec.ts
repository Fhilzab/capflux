/**
 * seedReady.spec.ts — sandbox seed-readiness gate.
 *
 * `ensureSeedReady()` is the single choke point every sandbox load path
 * awaits before touching seeded local data. Cold boot clears tables before
 * rewriting them, so an unguarded read observes empty/partial data and
 * completes "successfully" (false empty states).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { __resolveRuntimeEnvironmentForTests } from '@/shared/environment/runtimeEnvironment';

const hoisted = vi.hoisted(() => ({
  installMock: vi.fn(async () => undefined),
}));

vi.mock('@/sandbox', () => ({
  installSandboxMode: hoisted.installMock,
}));

import { ensureSeedReady, __resetSeedReadyForTests } from '../seedReady';

describe('ensureSeedReady', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetSeedReadyForTests();
    __resolveRuntimeEnvironmentForTests('production');
  });

  afterEach(() => {
    __resolveRuntimeEnvironmentForTests('production');
  });

  it('is a true no-op outside sandbox mode: the installer is never invoked', async () => {
    await ensureSeedReady();
    await ensureSeedReady();
    expect(hoisted.installMock).not.toHaveBeenCalled();
  });

  it('delegates to the memoized installer once in sandbox mode', async () => {
    __resolveRuntimeEnvironmentForTests('sandbox');
    await ensureSeedReady();
    expect(hoisted.installMock).toHaveBeenCalledTimes(1);
  });

  it('shares one in-flight initialization across concurrent callers', async () => {
    __resolveRuntimeEnvironmentForTests('sandbox');
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    hoisted.installMock.mockImplementationOnce(() => gate);
    const pending = [ensureSeedReady(), ensureSeedReady(), ensureSeedReady()];
    await Promise.resolve();
    release();
    await Promise.all(pending);
    expect(hoisted.installMock).toHaveBeenCalledTimes(1);
  });

  it('retries initialization after a failure instead of sticking', async () => {
    __resolveRuntimeEnvironmentForTests('sandbox');
    hoisted.installMock.mockRejectedValueOnce(new Error('seed unavailable'));
    await expect(ensureSeedReady()).rejects.toThrow('seed unavailable');
    hoisted.installMock.mockResolvedValueOnce(undefined);
    await ensureSeedReady();
    expect(hoisted.installMock).toHaveBeenCalledTimes(2);
  });

  it('propagates installer rejection so callers surface a recoverable error', async () => {
    __resolveRuntimeEnvironmentForTests('sandbox');
    hoisted.installMock.mockRejectedValueOnce(new Error('seed unavailable'));
    await expect(ensureSeedReady()).rejects.toThrow('seed unavailable');
  });
});
