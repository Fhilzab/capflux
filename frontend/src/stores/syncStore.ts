import { defineStore } from 'pinia';
import db from '../offline/localDb';
import { SyncService } from '../shared/services/SyncService';

export interface FailedItem {
  id: string;
  status: string;
  entityType: string;
  entityId: string;
  lastError?: string;
  createdAt: string;
}

export const useSyncStore = defineStore('sync', {
  state: () => ({
    pendingCount: 0 as number,
    failedCount: 0 as number,
    failedItems: [] as FailedItem[],
    lastSyncedAt: null as string | null,
    isSyncing: false as boolean,
    error: null as string | null,
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

    async retryFailedItem(id: string) {
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