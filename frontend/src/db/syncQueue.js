import db from './localDb';

export const SyncQueue = {
  async add(item) {
    return db.sync_queue.add({
      id: item.id,
      school_id: item.school_id,
      entity_type: item.entity_type,
      entity_id: item.entity_id,
      operation: item.operation,
      payload: item.payload,
      retry_count: item.retry_count ?? 0,
      status: item.status ?? 'PENDING',
      created_at: item.created_at ?? new Date().toISOString(),
      processed_at: item.processed_at ?? null,
    });
  },

  async pending() {
    return db.sync_queue.where('status').equals('PENDING').toArray();
  },
};
