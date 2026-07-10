import { supabase } from '../services/api/supabase';
import { SyncQueue } from './syncQueue';

const MAX_RETRIES = 3;

export async function processSyncQueue() {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return;
  }

  const pendingItems = await SyncQueue.getPendingItems();

  for (const item of pendingItems) {
    if (item.retry_count >= MAX_RETRIES) {
      await SyncQueue.markItemFailed(item.id, 'Maximum retry count reached');
      continue;
    }

    try {
      const { error } = await supabase
        .from(item.entity_type)
        .upsert(item.payload, { onConflict: 'id' });

      if (error) {
        await SyncQueue.markItemFailed(item.id, error.message || 'Sync failed');
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
