import { defineStore } from 'pinia';
import db from '../offline/localDb';
import { SyncService } from '../services/SyncService';

export const useSyncStore = defineStore('sync', {
  state: () => ({
    pendingCount: 0,
    failedCount: 0,
    failedItems: [],
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
        const failedItems = await db.sync_queue.where('status').equals('FAILED').toArray();
        this.pendingCount = pendingCount;
        this.failedCount = failedCount;
        this.failedItems = failedItems;
        this.lastSyncedAt = new Date().toISOString();
      } catch (err) {
        this.error = err instanceof Error ? err.message : String(err);
      } finally {
        this.isSyncing = false;
      }
    },

    async retryFailedItem(id) {
      try {
        this.isSyncing = true;
        this.error = null;
        await SyncService.retryFailedItem(id);
        await this.refreshStatus();
      } catch (err) {
        this.error = err instanceof Error ? err.message : String(err);
      } finally {
        this.isSyncing = false;
      }
    },

    async retryAllFailed() {
      try {
        this.isSyncing = true;
        this.error = null;
        await SyncService.retryAllFailed();
        await this.refreshStatus();
      } catch (err) {
        this.error = err instanceof Error ? err.message : String(err);
      } finally {
        this.isSyncing = false;
      }
    },
  },
});
