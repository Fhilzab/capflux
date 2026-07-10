import { processSyncQueue, startBackgroundSync } from '../offline/syncEngine';
import { SyncQueue } from '../offline/syncQueue';

export const SyncService = {
  processQueue() {
    return processSyncQueue();
  },

  startBackgroundSync(intervalMs = 30000) {
    return startBackgroundSync(intervalMs);
  },

  async getFailedItems() {
    return SyncQueue.getFailedItems();
  },

  async retryFailedItem(id: string) {
    return SyncQueue.retryFailedItem(id);
  },

  async retryAllFailed() {
    return SyncQueue.retryAllFailed();
  },
};
