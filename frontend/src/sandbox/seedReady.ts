/**
 * Sandbox seed readiness gate.
 *
 * Cold-boot ordering hazard: `app.mount()` fires router navigation before
 * `bootstrapSandbox()` finishes seeding, and the seeder clears tables
 * before rewriting them (`seedSandboxDatabase`: clear-first, `seed_version`
 * meta last). Any local read in that window observes empty or partial data
 * and completes "successfully", producing false empty states.
 *
 * Call this at the top of every sandbox-mode load path that touches
 * seeded local data, BEFORE the first read or mutation:
 *
 *   await ensureSeedReady();
 *
 * - Outside sandbox mode it is a true no-op: it returns before the dynamic
 *   import below ever executes, so production bundles never fetch sandbox
 *   code and production behavior is byte-for-byte unchanged.
 * - In sandbox mode it resolves the existing memoized installer exactly
 *   once per process lifetime (retried after failure): concurrent callers
 *   share one in-flight seeding (no duplicate execution, no deadlock —
 *   sequential awaits, no locks).
 * - A failed seeding attempt REJECTS to the caller. Do not swallow it:
 *   let it reach the path's existing error handling so the UI shows a
 *   recoverable error instead of a false empty state or a hang.
 */
import { runtimeEnvironment } from '@/shared/environment/runtimeEnvironment';

let readyPromise: Promise<void> | null = null;

export async function ensureSeedReady(): Promise<void> {
  if (!runtimeEnvironment.isSandbox) return;
  if (!readyPromise) {
    readyPromise = (async () => {
      const { installSandboxMode } = await import('@/sandbox');
      await installSandboxMode();
    })().catch((err: unknown) => {
      readyPromise = null;
      throw err;
    });
  }
  return readyPromise;
}

/** Test seam: clear memoized readiness (mirrors `__setSandboxDbForTest`). */
export function __resetSeedReadyForTests(): void {
  readyPromise = null;
}
