import { processSyncQueue, startBackgroundSync } from '../offline/syncEngine';

export const SyncService = {
  processQueue() {
    return processSyncQueue();
  },

  startBackgroundSync(intervalMs = 30000) {
    return startBackgroundSync(intervalMs);
  },
};
