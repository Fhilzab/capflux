/**
 * Frontend runtime configuration validation — runs at bootstrap BEFORE any
 * provider/store/auth initialization. Complements the fail-closed default in
 * runtimeEnvironment.ts: an explicitly INVALID mode is rejected rather than
 * silently coerced to production, and the declared database environment must
 * agree with the mode.
 *
 * This is configuration validation only — it NEVER treats client state as a
 * security boundary (the backend/database enforce isolation independently).
 */

import { resolveAppMode, type AppMode } from './runtimeEnvironment';

export class RuntimeConfigurationError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = code;
    this.code = code;
  }
}

type EnvSnapshot = Record<string, string | undefined>;

function hasValue(raw: string | undefined): boolean {
  return typeof raw === 'string' && raw.trim().length > 0;
}

const VALID_DATABASE_ENVS: readonly string[] = ['production', 'sandbox'];

/**
 * Validate build-time env configuration. Throws RuntimeConfigurationError on
 * any inconsistency. Pure over the provided snapshot; defaults to the real
 * import.meta.env so bootstrap can call it without arguments.
 */
export function validateRuntimeConfiguration(
  env: EnvSnapshot = import.meta.env as unknown as EnvSnapshot,
): { mode: AppMode; databaseEnv?: 'production' | 'sandbox' } {
  const rawMode = env.VITE_CAPFLUX_MODE;
  if (hasValue(rawMode)) {
    const normalized = String(rawMode).trim().toLowerCase();
    const resolvedFromRaw = normalized === 'production' || normalized === 'sandbox'
      ? normalized
      : null;
    if (!resolvedFromRaw) {
      throw new RuntimeConfigurationError(
        'INVALID_CAPFLUX_MODE',
        `INVALID_CAPFLUX_MODE: Invalid VITE_CAPFLUX_MODE "${rawMode}" — supported values: production | sandbox.`,
      );
    }
  }

  const mode = resolveAppMode(rawMode);

  let databaseEnv: 'production' | 'sandbox' | undefined;
  const rawDatabaseEnv = env.VITE_CAPFLUX_DATABASE_ENV;
  if (hasValue(rawDatabaseEnv)) {
    const normalized = String(rawDatabaseEnv).trim().toLowerCase();
    if (!VALID_DATABASE_ENVS.includes(normalized)) {
      throw new RuntimeConfigurationError(
        'INVALID_CAPFLUX_DATABASE_ENV',
        `INVALID_CAPFLUX_DATABASE_ENV: Invalid VITE_CAPFLUX_DATABASE_ENV "${rawDatabaseEnv}" — supported values: production | sandbox.`,
      );
    }
    databaseEnv = normalized as 'production' | 'sandbox';
    if (databaseEnv !== mode) {
      throw new RuntimeConfigurationError(
        'MODE_DATABASE_MISMATCH',
        `MODE_DATABASE_MISMATCH: VITE_CAPFLUX_MODE=${mode} cannot be combined with VITE_CAPFLUX_DATABASE_ENV=${databaseEnv}.`,
      );
    }
  }

  return { mode, databaseEnv };
}
