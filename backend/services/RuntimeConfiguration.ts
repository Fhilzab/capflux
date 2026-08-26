/**
 * Centralized CAPFLUX runtime configuration — the single authority for
 * interpreting CAPFLUX_MODE / CAPFLUX_DATABASE_ENV and for validating that
 * the composed configuration is internally consistent.
 *
 * Design rules (release gate):
 *  - Exactly two modes exist: 'production' | 'sandbox'.
 *  - Production is the fail-closed default for an UNSET variable, but an
 *    explicitly INVALID value is rejected at startup rather than silently
 *    coerced.
 *  - validateRuntimeConfiguration() runs BEFORE the server accepts traffic
 *    and FAILS CLOSED (process.exit(1) at the call site) on any inconsistency:
 *    sandbox must never hold production credentials/configuration, production
 *    must never declare sandbox resources.
 *  - No silent fallbacks: misconfiguration is always a hard error.
 */

export type CapfluxMode = 'production' | 'sandbox';
export type DatabaseEnv = 'production' | 'sandbox';

const VALID_MODES: readonly CapfluxMode[] = ['production', 'sandbox'];

/** Live PSP adapters — never initializable inside a sandbox process. */
export const LIVE_PAYMENT_PROVIDERS = ['monnify', 'paystack'] as const;

/** Environment variables that constitute PRODUCTION payment configuration. */
const PRODUCTION_PAYMENT_CREDENTIAL_VARS = [
  'PAYSTACK_SECRET_KEY',
  'MONNIFY_SECRET_KEY',
] as const;

/** Environment variables that constitute PRODUCTION payment webhook configuration. */
const PRODUCTION_WEBHOOK_CONFIG_VARS = [
  'PAYSTACK_WEBHOOK_SECRET',
  'MONNIFY_WEBHOOK_SECRET',
] as const;

/** Provider selectors whose 'approved' value means a real external vendor. */
const PRODUCTION_PROVIDER_SELECTOR_VARS = [
  'IDENTITY_VERIFICATION_PROVIDER',
  'SETTLEMENT_VERIFICATION_PROVIDER',
] as const;

/** Sandbox-only variables that must never be set on a production process. */
const SANDBOX_ONLY_VARS = [
  'SANDBOX_DATABASE_URL',
  'SANDBOX_API_BASE_URL',
] as const;

export class RuntimeConfigurationError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = code;
    this.code = code;
  }
}

/** Raised when sandbox mode detects production resources/credentials. */
export class SandboxConfigurationError extends RuntimeConfigurationError {
  constructor(detail: string) {
    super(
      'SANDBOX_CONFIGURATION_ERROR',
      `SANDBOX_CONFIGURATION_ERROR: ${detail}`,
    );
  }
}

/** Raised when production mode detects sandbox resources/credentials. */
export class ProductionConfigurationError extends RuntimeConfigurationError {
  constructor(detail: string) {
    super(
      'PRODUCTION_CONFIGURATION_ERROR',
      `PRODUCTION_CONFIGURATION_ERROR: ${detail}`,
    );
  }
}

function readMode(raw: string | undefined): CapfluxMode | { invalid: string } {
  if (raw === undefined || raw.trim() === '') return 'production'; // fail-closed default
  const normalized = raw.trim().toLowerCase();
  if ((VALID_MODES as readonly string[]).includes(normalized)) {
    return normalized as CapfluxMode;
  }
  return { invalid: raw };
}

function hasValue(raw: string | undefined): boolean {
  return typeof raw === 'string' && raw.trim().length > 0;
}

/** The resolved CAPFLUX_MODE (unset ⇒ production; invalid ⇒ rejected by the validator). */
export function getCapfluxMode(env: NodeJS.ProcessEnv = process.env): CapfluxMode {
  const resolved = readMode(env.CAPFLUX_MODE);
  return resolved === 'production' || resolved === 'sandbox'
    ? resolved
    : 'production';
}

/**
 * Validate the full runtime configuration. Throws
 * SandboxConfigurationError / ProductionConfigurationError / RuntimeConfigurationError.
 * Safe to call repeatedly (pure over the provided env).
 */
export function validateRuntimeConfiguration(
  env: NodeJS.ProcessEnv = process.env,
): { mode: CapfluxMode; databaseEnv?: DatabaseEnv } {
  // ---- Mode syntax -------------------------------------------------------
  const modeResolution = readMode(env.CAPFLUX_MODE);
  if (typeof modeResolution !== 'string') {
    throw new RuntimeConfigurationError(
      'INVALID_CAPFLUX_MODE',
      `Invalid CAPFLUX_MODE "${modeResolution.invalid}" — supported values: production | sandbox.`,
    );
  }
  const mode = modeResolution;

  // ---- Database environment declaration ----------------------------------
  let databaseEnv: DatabaseEnv | undefined;
  if (hasValue(env.CAPFLUX_DATABASE_ENV)) {
    const normalized = String(env.CAPFLUX_DATABASE_ENV).trim().toLowerCase();
    if (normalized !== 'production' && normalized !== 'sandbox') {
      throw new RuntimeConfigurationError(
        'INVALID_CAPFLUX_DATABASE_ENV',
        `Invalid CAPFLUX_DATABASE_ENV "${env.CAPFLUX_DATABASE_ENV}" — supported values: production | sandbox.`,
      );
    }
    databaseEnv = normalized;
  } else if (env.NODE_ENV === 'production') {
    // Deployed processes must declare which database they speak to.
    throw new RuntimeConfigurationError(
      'MISSING_CAPFLUX_DATABASE_ENV',
      'CAPFLUX_DATABASE_ENV is required when NODE_ENV=production (set it to "production" or "sandbox").',
    );
  }

  if (databaseEnv && databaseEnv !== mode) {
    const message =
      `CAPFLUX_MODE=${mode} cannot be combined with CAPFLUX_DATABASE_ENV=${databaseEnv}. ` +
      'The declared database environment must agree with the runtime mode.';
    if (mode === 'sandbox') throw new SandboxConfigurationError(message);
    throw new ProductionConfigurationError(message);
  }

  if (mode === 'sandbox') {
    validateSandboxConfiguration(env);
  } else {
    validateProductionConfiguration(env);
  }

  return { mode, databaseEnv };
}

/**
 * SANDBOX constraints — every rule here prevents real-world side effects.
 * Any violation fails startup; nothing falls back silently.
 */
function validateSandboxConfiguration(env: NodeJS.ProcessEnv): void {
  for (const varName of PRODUCTION_PAYMENT_CREDENTIAL_VARS) {
    if (hasValue(env[varName])) {
      throw new SandboxConfigurationError(
        `Production payment provider credentials detected while CAPFLUX_MODE=sandbox (${varName}). ` +
          'Remove the credential — sandbox payments terminate at the deterministic SandboxGateway.',
      );
    }
  }

  for (const varName of PRODUCTION_WEBHOOK_CONFIG_VARS) {
    if (hasValue(env[varName])) {
      throw new SandboxConfigurationError(
        `Production webhook configuration detected while CAPFLUX_MODE=sandbox (${varName}). ` +
          'Sandbox webhooks are simulated locally and never registered with a PSP.',
      );
    }
  }

  if (String(env.PAYMENTS_PROVIDER_MODE ?? '').trim().toLowerCase() === 'production') {
    throw new SandboxConfigurationError(
      'PAYMENTS_PROVIDER_MODE=production while CAPFLUX_MODE=sandbox. ' +
        'A sandbox process may not configure a live payment gateway.',
    );
  }

  for (const varName of PRODUCTION_PROVIDER_SELECTOR_VARS) {
    if (String(env[varName] ?? '').trim().toLowerCase() === 'approved') {
      throw new SandboxConfigurationError(
        `${varName}=approved (live verification vendor) while CAPFLUX_MODE=sandbox. ` +
          'KYC/settlement verification must use the deterministic mock adapter.',
      );
    }
  }

  // Public-safety posture: a deployed sandbox must never open CORS to all origins.
  if (
    env.NODE_ENV === 'production' &&
    String(env.CORS_ALLOW_ALL ?? '').trim().toLowerCase() === 'true'
  ) {
    throw new SandboxConfigurationError(
      'CORS_ALLOW_ALL=true is forbidden on a publicly deployed sandbox (NODE_ENV=production). ' +
        'Set CORS_ORIGINS to the sandbox frontend origin instead.',
    );
  }
}

/**
 * PRODUCTION constraints — sandbox resources must never be reachable here.
 */
function validateProductionConfiguration(env: NodeJS.ProcessEnv): void {
  for (const varName of SANDBOX_ONLY_VARS) {
    if (hasValue(env[varName])) {
      throw new ProductionConfigurationError(
        `Sandbox-only variable ${varName} is set while CAPFLUX_MODE=production.`,
      );
    }
  }

  if (env.NODE_ENV === 'production') {
    // Live-verification vendors are the ONLY acceptable selectors in a
    // deployed production process (existing services already refuse mock).
    for (const varName of PRODUCTION_PROVIDER_SELECTOR_VARS) {
      const value = String(env[varName] ?? '').trim().toLowerCase();
      if (value === 'mock') {
        throw new ProductionConfigurationError(
          `${varName}=mock is refused in a deployed production process (NODE_ENV=production).`,
        );
      }
    }
  }
}

/** Non-secret runtime descriptor for the /providers/runtime-info endpoint. */
export function describeRuntimeMode(): { mode: CapfluxMode } {
  return { mode: getCapfluxMode() };
}
