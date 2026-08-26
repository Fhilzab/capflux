/**
 * Sandbox sync engine.
 *
 * Drains the SAME outbox (`sync_queue`) the production UploadSyncEngine uses,
 * but replays items against the in-browser backend simulator instead of
 * Supabase. This preserves CAPFLUX's genuine offline-first behaviour:
 *
 *   mutation → Dexie + outbox → [offline toggle pauses] → Sync Now / auto
 *   replay → server-side validation → SYNCED | FAILED(+retry)
 *
 * Server-side realism implemented here:
 *  - append-only enforcement: UPDATE/DELETE against ledger_entries fails;
 *  - unique admission numbers for students;
 *  - one-primary-guardian convergence for student_guardians;
 *  - transient failures (SYNC_FAILURE scenario) that succeed on retry;
 *  - last-write-wins conflict resolution on stale versions.
 */

import type { SandboxCapfluxDB } from '../sandboxDb';
import { getSandboxDb } from '../sandboxDb';
import { runtimeEnvironment } from '../../shared/environment/runtimeEnvironment';
import { assertSandboxMode } from '../runtime/sandboxGuard';
import { sandboxRuntime, type SyncCounters } from '../runtime/sandboxRuntime';

interface OutboxItem {
  id: string;
  school_id: string;
  entity_type: string;
  entity_id: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE' | 'UPSERT';
  payload: Record<string, unknown>;
  status: string;
  retry_count: number;
  created_at: string;
  processed_at?: string;
  error_message?: string;
}

export interface SyncRunResult {
  processed: number;
  synced: number;
  failed: number;
}

const APPEND_ONLY_ENTITIES = new Set(['ledger_entries']);
const KNOWN_ENTITIES = new Set([
  'students', 'guardians', 'student_guardians', 'student_enrollments',
  'academic_sessions', 'academic_terms', 'school_divisions', 'academic_levels',
  'notifications', 'tuition_configurations', 'fee_rules',
  // Financial rows replay through the outbox too — but only INSERTs are
  // legal there (append-only), enforced below.
  'ledger_entries',
]);

async function validateAndApply(db: SandboxCapfluxDB, item: OutboxItem): Promise<{ ok: true } | { ok: false; message: string }> {
  const entityType = item.entity_type;

  if (!KNOWN_ENTITIES.has(entityType)) {
    return { ok: false, message: `Unknown entity type "${entityType}" rejected by sandbox server` };
  }

  if (APPEND_ONLY_ENTITIES.has(entityType) && item.operation !== 'INSERT') {
    return { ok: false, message: `${entityType} is append-only — ${item.operation} rejected` };
  }

  if (entityType === 'students' && (item.operation === 'UPSERT' || item.operation === 'INSERT')) {
    const admission = item.payload.admission_number as string | undefined;
    if (!item.payload.first_name || !item.payload.last_name) {
      return { ok: false, message: 'Server rejected student without first/last name' };
    }
    if (admission) {
      const clash = await db.students
        .where('admission_number')
        .equals(admission)
        .and((s) => s.id !== item.entity_id)
        .first();
      if (clash) {
        return { ok: false, message: `Duplicate admission number ${admission} already assigned` };
      }
    }
  }

  if (entityType === 'student_guardians' && item.payload.is_primary === true && item.operation !== 'DELETE') {
    // Partial-unique-index emulation: only one primary link per student.
    const siblings = await db.student_guardians.where('student_id').equals(item.entity_id ? String(item.payload.student_id ?? '') : '').toArray();
    for (const sibling of siblings) {
      if (sibling.id !== item.entity_id && sibling.is_primary) {
        await db.student_guardians.update(sibling.id, { is_primary: false });
      }
    }
  }

  // Apply (idempotent by primary key — rows are usually already present
  // because mutations write through locally first).
  const table = db.table(entityType);
  if (item.operation === 'DELETE') {
    await table.delete(item.entity_id);
  } else {
    await table.put({ ...item.payload, id: item.entity_id });
  }
  return { ok: true };
}

/**
 * Drain pending outbox items once. Safe to call repeatedly.
 */
export async function processSandboxSyncQueue(dbHandle?: SandboxCapfluxDB): Promise<SyncRunResult> {
  assertSandboxMode(runtimeEnvironment.isSandbox, 'SandboxSyncEngine');
  const db = dbHandle ?? getSandboxDb();

  if (!sandboxRuntime.isOnline()) {
    sandboxRuntime.setCounters(await readCounters(db));
    return { processed: 0, synced: 0, failed: 0 };
  }

  const pending = (await db.sync_queue.where('status').equals('PENDING').toArray()) as unknown as OutboxItem[];
  if (pending.length === 0) {
    sandboxRuntime.setCounters(await readCounters(db));
    return { processed: 0, synced: 0, failed: 0 };
  }

  sandboxRuntime.emit('sync-started', pending.length);

  let synced = 0;
  let failed = 0;

  for (const item of pending) {
    await db.sync_queue.update(item.id, { status: 'SYNCING' });

    // Transient-failure scenario: fail each item's FIRST attempt only.
    const transientFailure =
      sandboxRuntime.isScenarioActive('SYNC_FAILURE') && item.retry_count === 0;

    let outcome: { ok: true } | { ok: false; message: string };
    if (transientFailure) {
      outcome = { ok: false, message: 'Simulated transient sync failure (retry succeeds)' };
    } else {
      try {
        outcome = await validateAndApply(db, item);
      } catch (e) {
        outcome = { ok: false, message: e instanceof Error ? e.message : 'Sandbox server error' };
      }
    }

    if (outcome.ok) {
      synced += 1;
      await db.sync_queue.update(item.id, {
        status: 'SYNCED',
        processed_at: new Date().toISOString(),
        error_message: undefined,
      });
    } else {
      failed += 1;
      await db.sync_queue.update(item.id, {
        status: 'FAILED',
        retry_count: (item.retry_count ?? 0) + 1,
        processed_at: new Date().toISOString(),
        error_message: outcome.message,
      });
    }
  }

  sandboxRuntime.markSynced(new Date().toISOString());
  sandboxRuntime.setCounters(await readCounters(db));
  sandboxRuntime.emit('sync-completed', { processed: pending.length, synced, failed });
  void dbHandle;
  return { processed: pending.length, synced, failed };
}

async function readCounters(db: SandboxCapfluxDB): Promise<SyncCounters> {
  const pending = await db.sync_queue.where('status').equals('PENDING').count();
  const failed = await db.sync_queue.where('status').equals('FAILED').count();
  const synced = await db.sync_queue.where('status').equals('SYNCED').count();
  return { pending, failed, synced };
}

/** Retry every failed item (mirrors SyncQueue.retryAllFailed semantics). */
export async function retryAllSandboxFailures(): Promise<number> {
  assertSandboxMode(runtimeEnvironment.isSandbox, 'SandboxSyncEngine');
  const db = getSandboxDb();
  const failed = (await db.sync_queue.where('status').equals('FAILED').toArray()) as unknown as OutboxItem[];
  for (const item of failed) {
    await db.sync_queue.update(item.id, { status: 'PENDING' });
  }
  return failed.length;
}

let timer: ReturnType<typeof setInterval> | null = null;

/** Start background auto-drain (30s cadence, mirroring production). */
export function startSandboxBackgroundSync(intervalMs = 30000): void {
  assertSandboxMode(runtimeEnvironment.isSandbox, 'SandboxSyncEngine');
  stopSandboxBackgroundSync();
  timer = setInterval(() => {
    void processSandboxSyncQueue().catch(() => undefined);
  }, intervalMs);
}

export function stopSandboxBackgroundSync(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
