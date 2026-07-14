/**
 * UploadSyncEngine - Synchronizes LOCAL OWNED entities to Supabase
 * 
 * LOCAL OWNED entities (created locally, synced upward):
 * - students
 * - guardians
 * - tuition_configurations
 * - fee_rules
 * - school settings
 * - notification drafts
 */

import { supabase, hasSupabaseConfig } from '../services/api/supabase';
import { SyncQueue } from './syncQueue';
import { EntityOwnership } from './localDb';
import type { SyncQueueItem } from '../types/billing';

const MAX_RETRIES = 3;

/**
 * Execute a sync item operation for LOCAL OWNED entities
 */
async function executeUploadSyncItem(item: SyncQueueItem) {
  // Validate entity ownership - only LOCAL OWNED entities allowed
  if (!EntityOwnership.isLocalOwned(item.entity_type)) {
    throw new Error(`Entity ${item.entity_type} is not LOCAL OWNED - cannot upload`);
  }

  // Use type-safe approach for supabase calls
  const response = await supabase.from(item.entity_type);
  
  switch (item.operation) {
    case 'DELETE': {
      const result = await (response as any).delete().eq('id', item.entity_id);
      return result;
    }
    case 'INSERT': {
      const result = await (response as any).insert(item.payload);
      return result;
    }
    case 'UPDATE': {
      const result = await (response as any).update(item.payload).eq('id', item.entity_id);
      return result;
    }
    case 'UPSERT':
    default: {
      const result = await (response as any).upsert(item.payload, { onConflict: 'id' });
      return result;
    }
  }
}

/**
 * Process the upload sync queue - uploads local operational data to Supabase
 */
export async function processUploadSyncQueue(): Promise<{ processed: number; errors: number }> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { processed: 0, errors: 0 };
  }

  if (!hasSupabaseConfig) {
    console.warn('Skipping upload sync: Supabase is not configured.');
    return { processed: 0, errors: 0 };
  }

  // Verify we have a valid session
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    console.warn('Skipping upload sync: No valid Supabase session.');
    return { processed: 0, errors: 0 };
  }

  const pendingItems = await SyncQueue.getPendingItems();

  let processed = 0;
  let errors = 0;

  for (const item of pendingItems) {
    if (item.retry_count >= MAX_RETRIES) {
      await SyncQueue.markItemFailed(item.id, 'Maximum retry count reached');
      errors++;
      continue;
    }

    try {
      const response = await executeUploadSyncItem(item);
      if (response.error) {
        await SyncQueue.markItemFailed(item.id, response.error.message || 'Sync failed');
        errors++;
        continue;
      }

      await SyncQueue.markItemCompleted(item.id);
      processed++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await SyncQueue.markItemFailed(item.id, message);
      errors++;
    }
  }

  return { processed, errors };
}

/**
 * Enqueue a LOCAL OWNED entity for upload
 */
export async function enqueueUpload(school_id: string, entityType: string, entityId: string, payload: Record<string, unknown>, operation: 'INSERT' | 'UPDATE' | 'DELETE' | 'UPSERT' = 'UPSERT'): Promise<void> {
  if (!EntityOwnership.isLocalOwned(entityType)) {
    throw new Error(`Entity ${entityType} is not LOCAL OWNED - cannot enqueue for upload`);
  }

  await SyncQueue.add({
    school_id,
    entity_type: entityType,
    entity_id: entityId,
    payload,
    operation,
  });
}

/**
 * Start background upload synchronization
 */
export function startUploadSync(intervalMs = 30000): ReturnType<typeof setInterval> {
  const interval = setInterval(processUploadSyncQueue, intervalMs);

  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
      processUploadSyncQueue().catch((error) => console.error('Online upload sync failed:', error));
    });
  }

  return interval;
}

export default {
  processUploadSyncQueue,
  enqueueUpload,
  startUploadSync,
};
