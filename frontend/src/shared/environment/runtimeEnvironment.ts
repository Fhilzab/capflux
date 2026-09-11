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
 *
 * Separation of concerns:
 *   - Environment (production | sandbox): which infrastructure stack
 *   - Transport (remote | simulator): how API requests are dispatched
 */

export type AppMode = 'production' | 'sandbox';
export type ApiTransport = 'remote' | 'simulator';

export interface RuntimeEnvironment {
  /** Resolved execution mode. */
  readonly mode: AppMode;
  /** Resolved API transport mode. */
  readonly transport: ApiTransport;
  readonly isSandbox: boolean;
  readonly isProduction: boolean;
}

const VALID_MODES: readonly AppMode[] = ['production', 'sandbox'];
const VALID_TRANSPORTS: readonly ApiTransport[] = ['remote', 'simulator'];

function readRawMode(): string | undefined {
  // import.meta.env is statically replaced by Vite at build time, so this is
  // deterministic per bundle.
  const raw = import.meta.env.VITE_CAPFLUX_MODE;
  return typeof raw === 'string' ? raw.trim().toLowerCase() : undefined;
}

function readRawTransport(): string | undefined {
  const raw = import.meta.env.VITE_API_TRANSPORT;
  return typeof raw === 'string' ? raw.trim().toLowerCase() : undefined;
}

export function resolveAppMode(rawMode?: string): AppMode {
  const raw = (rawMode ?? readRawMode())?.trim().toLowerCase();
  if (!raw) return 'production';
  return VALID_MODES.includes(raw as AppMode) ? (raw as AppMode) : 'production';
}

export function resolveApiTransport(rawTransport?: string, mode?: AppMode): ApiTransport {
  const raw = (rawTransport ?? readRawTransport())?.trim().toLowerCase();
  if (!raw) return 'remote'; // fail-closed default: remote transport
  if (!VALID_TRANSPORTS.includes(raw as ApiTransport)) {
    // Unknown transport is a configuration error — fail closed rather than
    // silently selecting the simulator.
    throw new Error(
      `Invalid VITE_API_TRANSPORT "${raw}" — supported values: remote | simulator. ` +
        `Received at build time.`
    );
  }
  // Simulator transport is only valid in sandbox mode.
  if (raw === 'simulator' && (mode ?? resolveAppMode()) !== 'sandbox') {
    throw new Error(
      `VITE_API_TRANSPORT=simulator is only valid when VITE_CAPFLUX_MODE=sandbox. ` +
        `Current mode: ${mode ?? resolveAppMode()}.`
    );
  }
  return raw as ApiTransport;
}

function applyMode(
  target: RuntimeEnvironment,
  mode: AppMode,
  transport: ApiTransport
): RuntimeEnvironment {
  target.mode = mode;
  target.transport = transport;
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
  { mode: 'production', transport: 'remote', isSandbox: false, isProduction: true },
  resolveAppMode(),
  resolveApiTransport(),
);

/** The application-wide runtime environment. */
export const runtimeEnvironment: RuntimeEnvironment = current;

/** Test seam: re-resolve from an explicit raw value (or the real env when omitted). */
export function __resolveRuntimeEnvironmentForTests(
  rawMode?: string,
  rawTransport?: string
): RuntimeEnvironment {
  const mode = resolveAppMode(rawMode);
  const transport = resolveApiTransport(rawTransport, mode);
  return applyMode(current, mode, transport);
}
