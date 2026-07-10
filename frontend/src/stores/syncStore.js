import { defineStore } from 'pinia';
import db from '../db/localDb';

export const useSyncStore = defineStore('sync', {
  state: () => ({
    pendingCount: 0,
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
        this.pendingCount = pendingCount;
        this.lastSyncedAt = new Date().toISOString();
      } catch (err) {
        this.error = err instanceof Error ? err.message : String(err);
      } finally {
        this.isSyncing = false;
      }
    },
  },
});
