/**
 * Sandbox sync engine — offline-first behaviour: outbox queueing, replay,
 * idempotency, transient failures with retry, append-only enforcement.
 */
import { describe, expect, it } from 'vitest';
import {
  createFakeSandboxDb,
  useSandboxFixture,
  type FakeSandboxDb,
} from './helpers/sandboxTestHarness';

async function queueItems(db: FakeSandboxDb): Promise<Array<Record<string, unknown>>> {
  return (db.sync_queue as unknown as { toArray(): Promise<Array<Record<string, unknown>>> }).toArray();
}

function studentPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'stu-new-1',
    school_id: 'demo-school',
    first_name: 'Ada',
    last_name: 'Obi',
    admission_number: 'CAP-90001',
    status: 'ACTIVE',
    ...overrides,
  };
}

describe('sandbox sync engine', () => {
  useSandboxFixture();

  async function enqueue(db: FakeSandboxDb, item: Partial<Record<string, unknown>>): Promise<void> {
    await db.sync_queue.put({
      id: `sync-${String(item.entity_id)}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      school_id: 'demo-school',
      entity_type: 'students',
      entity_id: 'stu-x',
      operation: 'UPSERT',
      payload: {},
      status: 'PENDING',
      retry_count: 0,
      created_at: new Date().toISOString(),
      ...item,
    } as never);
  }

  it('drains pending items and marks them SYNCED (server acceptance)', async () => {
    const db = createFakeSandboxDb();
    await enqueue(db, { entity_id: 'stu-new-1', payload: studentPayload() });

    const { processSandboxSyncQueue } = await import('../sync/sandboxSyncEngine');
    const result = await processSandboxSyncQueue(db as never);
    expect(result.processed).toBe(1);
    expect(result.synced).toBe(1);

    const items = await queueItems(db);
    expect(items[0]!.status).toBe('SYNCED');
    expect(items[0]!.processed_at).toBeTruthy();
  });

  it('is idempotent on replay — re-queued duplicates apply cleanly by primary key', async () => {
    const db = createFakeSandboxDb();
    await enqueue(db, { entity_id: 'stu-new-1', payload: studentPayload(), operation: 'UPSERT' });
    // Same entity re-enqueued (e.g. after a crash mid-retry).
    await enqueue(db, { entity_id: 'stu-new-1', payload: studentPayload({ last_name: 'Obi-Updated' }) });

    const { processSandboxSyncQueue } = await import('../sync/sandboxSyncEngine');
    const result = await processSandboxSyncQueue(db as never);
    expect(result.synced).toBe(2);

    const stored = await db.students.get('stu-new-1');
    expect(String(stored!.last_name)).toBe('Obi-Updated');
  });

  it('rejects ledger mutations — the ledger is append-only', async () => {
    const db = createFakeSandboxDb();
    await enqueue(db, {
      entity_type: 'ledger_entries', entity_id: 'led-1', operation: 'UPDATE', payload: { amount_minor: 1 },
    });
    const { processSandboxSyncQueue } = await import('../sync/sandboxSyncEngine');
    const result = await processSandboxSyncQueue(db as never);
    expect(result.failed).toBe(1);
    const items = await queueItems(db);
    expect(items[0]!.status).toBe('FAILED');
    expect(String(items[0]!.error_message)).toMatch(/append-only/i);
  });

  it('rejects duplicate admission numbers server-side', async () => {
    const db = createFakeSandboxDb();
    await db.students.put({
      id: 'stu-existing', school_id: 'demo-school', first_name: 'Existing', last_name: 'Student',
      admission_number: 'CAP-90001', status: 'ACTIVE',
    } as never);
    await enqueue(db, {
      entity_id: 'stu-other',
      payload: studentPayload({ id: 'stu-other', admission_number: 'CAP-90001' }),
    });

    const { processSandboxSyncQueue } = await import('../sync/sandboxSyncEngine');
    const result = await processSandboxSyncQueue(db as never);
    expect(result.failed).toBe(1);
    const items = await queueItems(db);
    expect(String(items[0]!.error_message)).toMatch(/Duplicate admission number/);
  });

  it('SYNC_FAILURE scenario fails the FIRST attempt; retry then succeeds', async () => {
    const db = createFakeSandboxDb();
    await enqueue(db, { entity_id: 'stu-new-2', payload: studentPayload({ id: 'stu-new-2' }) });

    const runtimeMod = await import('../runtime/sandboxRuntime');
    const { processSandboxSyncQueue } = await import('../sync/sandboxSyncEngine');
    runtimeMod.sandboxRuntime.setScenario('SYNC_FAILURE', true);

    const firstRun = await processSandboxSyncQueue(db as never);
    expect(firstRun.failed).toBe(1);

    runtimeMod.sandboxRuntime.setScenario('SYNC_FAILURE', false);
    // Retry flips FAILED → PENDING (exactly what SyncQueue.retryFailedItem does), then drain.
    const itemsBeforeRetry = await queueItems(db);
    const failedItem = itemsBeforeRetry[0]!;
    await (db.sync_queue as unknown as { update(id: string, changes: Record<string, unknown>): Promise<number> })
      .update(String(failedItem.id), { status: 'PENDING' });

    const secondRun = await processSandboxSyncQueue(db as never);
    expect(secondRun.synced).toBe(1);
    const itemsAfter = await queueItems(db);
    expect(itemsAfter[0]!.status).toBe('SYNCED');
  });

  it('does not touch the queue while OFFLINE (mutations keep queueing)', async () => {
    const db = createFakeSandboxDb();
    const runtimeMod = await import('../runtime/sandboxRuntime');
    runtimeMod.sandboxRuntime.setOnline(false);
    try {
      await enqueue(db, { entity_id: 'stu-offline', payload: studentPayload({ id: 'stu-offline' }) });
      const { processSandboxSyncQueue } = await import('../sync/sandboxSyncEngine');
      const result = await processSandboxSyncQueue(db as never);
      expect(result.processed).toBe(0);
      const items = await queueItems(db);
      expect(items[0]!.status).toBe('PENDING');
    } finally {
      runtimeMod.sandboxRuntime.setOnline(true);
    }
  });
});
