import db from './localDb';

export const SyncQueue = {
  add(item: Record<string, any>) {
    return db.sync_queue.add({
      ...item,
      retry_count: item.retry_count ?? 0,
      status: item.status ?? 'PENDING',
      created_at: item.created_at ?? new Date().toISOString(),
      processed_at: item.processed_at ?? null,
    });
  },

  pending() {
    return db.sync_queue.where('status').equals('PENDING').toArray();
  },
};
