import { processSyncQueue, startBackgroundSync } from '../../offline/syncEngine';
import { SyncQueue } from '../../offline/syncQueue';
import { processUploadSyncQueue, startUploadSync, enqueueUpload } from '../../offline/UploadSyncEngine';
import { downloadFinancialData, downloadPaymentAccounts, startDownloadSync } from '../../offline/DownloadSyncEngine';
import { subscribeToAll, unsubscribeAll } from '../../offline/RealtimeSyncService';

export const SyncService = {
  // Legacy methods (backward compatibility)
  processQueue() {
    return processSyncQueue();
  },

  startBackgroundSync(intervalMs = 30000) {
    return startBackgroundSync(intervalMs);
  },

  // Upload sync methods (LOCAL OWNED entities)
  processUploadQueue() {
    return processUploadSyncQueue();
  },

  startUploadSync(intervalMs = 30000) {
    return startUploadSync(intervalMs);
  },

  enqueueUpload,

  // Download sync methods (CLOUD OWNED entities)
  downloadFinancialData(school_id: string) {
    return downloadFinancialData(school_id);
  },

  downloadPaymentAccounts(school_id: string) {
    return downloadPaymentAccounts(school_id);
  },

  startDownloadSync(intervalMs = 60000, school_id: string) {
    return startDownloadSync(intervalMs, school_id);
  },

  // Realtime sync methods
  subscribeToFinancialData(school_id: string, student_id?: string) {
    return subscribeToAll(school_id, student_id);
  },

  unsubscribeAll() {
    return unsubscribeAll();
  },

  // Sync queue management
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

export default SyncService;