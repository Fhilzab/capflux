import { LocalRepository } from './localDb';

export const SyncQueue = {
  add(item: {
    id?: string;
    school_id: string;
    entity_type: string;
    entity_id: string;
    operation?: string;
    payload: Record<string, unknown>;
    status?: string;
    retry_count?: number;
    processed_at?: string;
    error_message?: string;
  }) {
    return LocalRepository.enqueueSyncItem({
      ...item,
      retry_count: item.retry_count ?? 0,
      status: item.status ?? 'PENDING',
      processed_at: item.processed_at ?? null,
      error_message: item.error_message ?? null,
    });
  },

  async getPendingItems() {
    return LocalRepository.getPendingSyncItems();
  },

  async getFailedItems() {
    return LocalRepository.getFailedSyncItems();
  },

  async getItemById(id: string) {
    return LocalRepository.getSyncItemById(id);
  },

  async markItemCompleted(id: string) {
    const item = await this.getItemById(id);
    if (item) {
      return LocalRepository.updateSyncItem(id, {
        status: 'SYNCED',
        processed_at: new Date().toISOString(),
        error_message: undefined,
      });
    }
    return null;
  },

  async markItemFailed(id: string, message: string) {
    const item = await this.getItemById(id);
    if (!item) return null;
    return LocalRepository.updateSyncItem(id, {
      status: 'FAILED' as const,
      error_message: message,
      retry_count: (item.retry_count ?? 0) + 1,
      processed_at: new Date().toISOString(),
    });
  },

  async retryFailedItem(id: string) {
    const item = await this.getItemById(id);
    if (!item) return null;
    return LocalRepository.updateSyncItem(id, {
      status: 'PENDING' as const,
      error_message: undefined,
      processed_at: undefined,
      retry_count: 0,
    });
  },

  async retryAllFailed() {
    const failedItems = await this.getFailedItems();
    return Promise.all(failedItems.map((item) => this.retryFailedItem(item.id)));
  },

  async incrementRetry(id: string) {
    const item = await this.getItemById(id);
    if (!item) return null;
    return LocalRepository.updateSyncItem(id, { retry_count: (item.retry_count || 0) + 1 });
  },
};