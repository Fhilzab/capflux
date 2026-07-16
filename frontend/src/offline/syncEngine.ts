import { supabase, hasSupabaseConfig } from '../shared/services/api/supabase';
import { SyncQueue } from './syncQueue';

const MAX_RETRIES = 3;

async function executeSyncItem(item: Record<string, any>) {
  switch (item.operation) {
    case 'DELETE':
      return supabase.from(item.entity_type).delete().eq('id', item.entity_id);
    case 'INSERT':
      return supabase.from(item.entity_type).insert(item.payload);
    case 'UPDATE':
      return supabase.from(item.entity_type).update(item.payload).eq('id', item.entity_id);
    case 'UPSERT':
    default:
      return supabase.from(item.entity_type).upsert(item.payload, { onConflict: 'id' });
  }
}

export async function processSyncQueue() {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return;
  }

  if (!hasSupabaseConfig) {
    console.warn('Skipping sync queue: Supabase is not configured.');
    return;
  }

  // Verify we have a valid session before syncing
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    console.warn('Skipping sync queue: No valid Supabase session.');
    return;
  }

  const pendingItems = await SyncQueue.getPendingItems();

  for (const item of pendingItems) {
    if (item.retry_count >= MAX_RETRIES) {
      await SyncQueue.markItemFailed(item.id, 'Maximum retry count reached');
      continue;
    }

    try {
      const response = await executeSyncItem(item);
      if ('error' in response && response.error) {
        await SyncQueue.markItemFailed(item.id, response.error.message || 'Sync failed');
        continue;
      }

      await SyncQueue.markItemCompleted(item.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await SyncQueue.markItemFailed(item.id, message);
    }
  }
}

export function startBackgroundSync(intervalMs = 30000) {
  const interval = setInterval(processSyncQueue, intervalMs);

  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
      processSyncQueue().catch((error) => console.error('Online sync failed:', error));
    });
  }

  return interval;
}
