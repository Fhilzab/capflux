/**
 * Frontend/backend mode consistency guard.
 *
 * A production frontend must refuse normal operation if the backend it is
 * pointed at reports a different runtime mode (e.g. someone repointed
 * VITE_API_BASE_URL at a sandbox Render service, or a sandbox deployment
 * accidentally serves a production bundle).
 *
 * The check uses ONLY the non-secret runtime descriptor
 * (GET /api/providers/runtime-info → { mode }) — no secrets cross the wire,
 * and client-side checks are convenience UX: real isolation is enforced by
 * the backend/database boundary, never by this flag.
 */

import type { AppMode } from './runtimeEnvironment';

export interface BackendRuntimeInfo {
  mode?: unknown;
  paymentsMode?: unknown;
}

export type ModeConsistencyResult =
  | { ok: true; backendMode: AppMode }
  | { ok: false; code: 'CAPFLUX_ENVIRONMENT_MISMATCH'; expected: AppMode; actual: string };

/** Pure comparator — trivially unit-testable. */
export function evaluateBackendMode(
  expected: AppMode,
  info: BackendRuntimeInfo | null | undefined,
): ModeConsistencyResult {
  const actual = typeof info?.mode === 'string' ? info.mode : String(info?.mode ?? 'unknown');
  if (actual === expected) {
    return { ok: true, backendMode: expected };
  }
  return { ok: false, code: 'CAPFLUX_ENVIRONMENT_MISMATCH', expected, actual };
}

const RUNTIME_INFO_TIMEOUT_MS = 5000;

/**
 * Fetch the backend runtime descriptor. Network failures are tolerated here
 * (offline-first app; API outages are handled by existing error surfaces) —
 * only an AUTHORITATIVE mismatch blocks startup.
 */
export async function fetchBackendRuntimeInfo(apiBaseUrl: string): Promise<BackendRuntimeInfo | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), RUNTIME_INFO_TIMEOUT_MS);
    const response = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/providers/runtime-info`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!response.ok) return null;
    const payload = (await response.json()) as { data?: BackendRuntimeInfo };
    return payload?.data ?? null;
  } catch {
    return null;
  }
}

/** Minimal, secret-free blocking screen for a hard mismatch. */
export function renderEnvironmentMismatchBlocker(expected: AppMode, actual: string): void {
  const target = document.getElementById('app');
  if (!target) return;
  target.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif;background:#fafaf9;padding:24px;">
      <div style="max-width:480px;border:1px solid #e7e5e4;border-radius:12px;padding:32px;background:#fff;">
        <h1 style="font-size:18px;margin:0 0 8px;">CAPFLUX_ENVIRONMENT_MISMATCH</h1>
        <p style="font-size:14px;color:#44403c;line-height:1.6;margin:0;">
          This application build expects the <strong>${expected}</strong> environment, but the configured
          backend reported <strong>${actual}</strong>. Operation has been blocked to keep environments isolated.
          Please correct the deployment configuration (VITE_CAPFLUX_MODE / VITE_API_BASE_URL /
          CAPFLUX_MODE / CAPFLUX_DATABASE_ENV).
        </p>
      </div>
    </div>`;
}
