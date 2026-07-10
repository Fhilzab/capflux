import { processSyncQueue, startBackgroundSync } from '../../db/syncEngine';

export const SyncService = {
  processQueue() {
    return processSyncQueue();
  },

  startBackgroundSync(intervalMs) {
    return startBackgroundSync(intervalMs);
  },
};
