import { LocalRepository } from './localDb';

export const SyncQueue = {
  add(item: Record<string, any>) {
    return LocalRepository.enqueueSyncItem({
      ...item,
      retry_count: 0,
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
    return LocalRepository.deleteSyncItem(id);
  },

  async markItemFailed(id: string, message: string) {
    const item = await this.getItemById(id);
    return LocalRepository.updateSyncItem(id, {
      status: 'FAILED',
      error_message: message,
      retry_count: (item?.retry_count ?? 0) + 1,
      processed_at: new Date().toISOString(),
    });
  },

  async retryFailedItem(id: string) {
    const item = await this.getItemById(id);
    if (!item) return null;
    return LocalRepository.updateSyncItem(id, {
      status: 'PENDING',
      error_message: null,
      processed_at: null,
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
