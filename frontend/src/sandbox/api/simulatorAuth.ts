/**
 * SimulatorAuthProvider — local demo authentication for the in-browser
 * SandboxApiServer (VITE_API_TRANSPORT=simulator) and sandbox unit tests.
 *
 * Contract (canonical sandbox demo-auth split):
 *  - Persona identities come ONLY from DEMO_PERSONAS in seed/demoData.ts
 *    (single source of truth; unknown ids are rejected, never mapped).
 *  - Session state lives under the `capflux_sandbox_session` localStorage
 *    key. This key is SEPARATE from the remote-transport demo session
 *    (`capflux_demo_session`, server-issued JWT via SandboxAuthProvider):
 *    the simulator never sees, mints, or validates network tokens.
 *  - Enforcement is fail-closed: no persona ⇒ no request proceeds.
 *
 * The deployed sandbox (VITE_API_TRANSPORT=remote) authenticates through
 * the real backend instead (SandboxAuthProvider → requireAuthDemo).
 */
import { DEMO_PERSONAS, type DemoPersonaSpec } from '../seed/demoData';
import { runtimeEnvironment } from '../../shared/environment/runtimeEnvironment';
import { assertSandboxMode } from '../runtime/sandboxGuard';

const SIMULATOR_SESSION_KEY = 'capflux_sandbox_session';

function readStoredPersonaId(): string | null {
  try {
    const raw = localStorage.getItem(SIMULATOR_SESSION_KEY);
    return raw ? (JSON.parse(raw) as { personaId?: string }).personaId ?? null : null;
  } catch {
    return null;
  }
}

function writeStoredPersonaId(personaId: string | null): void {
  try {
    if (personaId) {
      localStorage.setItem(SIMULATOR_SESSION_KEY, JSON.stringify({ personaId }));
    } else {
      localStorage.removeItem(SIMULATOR_SESSION_KEY);
    }
  } catch {
    // Storage unavailable — callers treat a missing session as signed out.
  }
}

/** Currently selected simulator persona, or null when signed out/unknown. */
export function getSimulatorPersona(): DemoPersonaSpec | null {
  assertSandboxMode(runtimeEnvironment.isSandbox, 'SimulatorAuthProvider');
  const personaId = readStoredPersonaId();
  if (!personaId) return null;
  return DEMO_PERSONAS.find((p) => p.id === personaId) ?? null;
}

/** Fail-closed accessor for non-HTTP callers (the API server maps this to 401). */
export function requireSimulatorAuth(): NonNullable<ReturnType<typeof getSimulatorPersona>> {
  const persona = getSimulatorPersona();
  if (!persona) throw new Error('Authentication required');
  return persona;
}

/** Test/role-switch seam: only canonical persona ids are accepted. */
export function setSimulatorPersona(personaId: string): void {
  assertSandboxMode(runtimeEnvironment.isSandbox, 'SimulatorAuthProvider');
  const persona = DEMO_PERSONAS.find((p) => p.id === personaId);
  if (!persona) throw new Error(`Unknown demo persona: ${personaId}`);
  writeStoredPersonaId(personaId);
}

export function clearSimulatorPersona(): void {
  writeStoredPersonaId(null);
}
