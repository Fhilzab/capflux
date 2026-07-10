import { defineStore } from 'pinia';
import db from '../offline/localDb';

export const useSyncStore = defineStore('sync', {
  state: () => ({
    pendingCount: 0,
    failedCount: 0,
    lastSyncedAt: null,
    isSyncing: false,
    error: null,
  }),
  actions: {
    async refreshStatus() {
      try {
        this.isSyncing = true;
        this.error = null;
        const pendingCount = await db.sync_queue.where('status').equals('PENDING').count();
        const failedCount = await db.sync_queue.where('status').equals('FAILED').count();
        this.pendingCount = pendingCount;
        this.failedCount = failedCount;
        this.lastSyncedAt = new Date().toISOString();
      } catch (err) {
        this.error = err instanceof Error ? err.message : String(err);
      } finally {
        this.isSyncing = false;
      }
    },
  },
});
