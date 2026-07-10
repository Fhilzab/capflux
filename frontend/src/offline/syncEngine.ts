import { supabase } from '../services/api/supabase';
import db from './localDb';

export async function processSyncQueue() {
  const pendingItems = await db.sync_queue.where('status').equals('PENDING').toArray();

  for (const item of pendingItems) {
    try {
      const { error } = await supabase.from(item.entity_type).insert(item.payload);

      if (error) {
        await db.sync_queue.update(item.id, { status: 'FAILED' });
        continue;
      }

      await db.sync_queue.delete(item.id);
    } catch (err) {
      await db.sync_queue.update(item.id, { status: 'FAILED' });
    }
  }
}

export function startBackgroundSync(intervalMs = 30000) {
  return setInterval(processSyncQueue, intervalMs);
}
