/**
 * Centralized CAPFLUX runtime environment / execution mode.
 *
 * This is THE single place where the application decides whether it is
 * running against production infrastructure or as an isolated sandbox.
 * Components and domain services must never test `sandbox` flags directly;
 * they receive mode-specific implementations through provider factories
 * that all read from this module.
 *
 * Fail-closed: any unknown/missing value resolves to PRODUCTION so that a
 * misconfigured deployment can never silently behave like a sandbox (and a
 * typo can never turn production into one).
 */

export type AppMode = 'production' | 'sandbox';

export interface RuntimeEnvironment {
  /** Resolved execution mode. */
  readonly mode: AppMode;
  readonly isSandbox: boolean;
  readonly isProduction: boolean;
}

const VALID_MODES: readonly AppMode[] = ['production', 'sandbox'];

function readRawMode(): string | undefined {
  // import.meta.env is statically replaced by Vite at build time, so this is
  // deterministic per bundle.
  const raw = import.meta.env.VITE_CAPFLUX_MODE;
  return typeof raw === 'string' ? raw.trim().toLowerCase() : undefined;
}

export function resolveAppMode(rawMode?: string): AppMode {
  const raw = (rawMode ?? readRawMode())?.trim().toLowerCase();
  if (!raw) return 'production';
  return VALID_MODES.includes(raw as AppMode) ? (raw as AppMode) : 'production';
}

function applyMode(target: RuntimeEnvironment, mode: AppMode): RuntimeEnvironment {
  target.mode = mode;
  (target as { isSandbox: boolean }).isSandbox = mode === 'sandbox';
  (target as { isProduction: boolean }).isProduction = mode === 'production';
  return target;
}

/**
 * Stable singleton: resolved once from build-time env at import, then fixed
 * for the process lifetime. Tests may re-resolve explicitly via
 * `__resolveRuntimeEnvironmentForTests` (the only sanctioned mutation).
 */
const current: RuntimeEnvironment = applyMode(
  { mode: 'production', isSandbox: false, isProduction: true },
  resolveAppMode(),
);

/** The application-wide runtime environment. */
export const runtimeEnvironment: RuntimeEnvironment = current;

/** Test seam: re-resolve from an explicit raw value (or the real env when omitted). */
export function __resolveRuntimeEnvironmentForTests(rawMode?: string): RuntimeEnvironment {
  return applyMode(current, resolveAppMode(rawMode));
}
