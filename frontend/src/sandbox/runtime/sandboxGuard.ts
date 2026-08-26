/**
 * Sandbox isolation guards — fail closed.
 *
 * Every sandbox-only construct (providers, gateway, API simulator, seeder)
 * calls `assertSandboxMode()` at construction/use time. If a sandbox adapter
 * is ever resolved in a production bundle, construction throws instead of
 * silently operating. Conversely, production code paths never reference
 * sandbox modules except through mode-checked factories.
 */

export class SandboxIsolationError extends Error {
  readonly code = 'SANDBOX_ISOLATION_VIOLATION';

  constructor(message: string) {
    super(message);
    this.name = 'SandboxIsolationError';
  }
}

export function assertSandboxMode(isSandbox: boolean, what: string): void {
  if (!isSandbox) {
    throw new SandboxIsolationError(
      `${what} is a sandbox-only construct and cannot run in production mode.`,
    );
  }
}

/** Live payment provider names that sandbox code must never impersonate or call. */
export const LIVE_PROVIDER_NAMES = ['monnify', 'paystack'] as const;

export function assertNotLiveProviderName(providerName: string): void {
  if ((LIVE_PROVIDER_NAMES as readonly string[]).includes(providerName.toLowerCase())) {
    throw new SandboxIsolationError(
      `Sandbox adapters must never bind to live provider "${providerName}".`,
    );
  }
}
