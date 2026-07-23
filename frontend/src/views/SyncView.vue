<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useSyncStore } from '../stores/syncStore';
import { SyncService } from '../shared/services/SyncService';
import CmButton from '../components/ui/CmButton.vue';

const syncStore = useSyncStore();
const loading = ref(false);
const actionMessage = ref('');

const refreshStatus = async () => {
  await syncStore.refreshStatus();
};

const processQueue = async () => {
  loading.value = true;
  actionMessage.value = '';

  try {
    await SyncService.processQueue();
    actionMessage.value = 'Sync queue processed successfully.';
  } catch (err) {
    actionMessage.value = err instanceof Error ? err.message : String(err);
  } finally {
    loading.value = false;
    await refreshStatus();
  }
};

const retryFailedItem = async (id) => {
  loading.value = true;
  actionMessage.value = '';

  try {
    await syncStore.retryFailedItem(id);
    actionMessage.value = 'Retry submitted for failed item.';
  } catch (err) {
    actionMessage.value = err instanceof Error ? err.message : String(err);
  } finally {
    loading.value = false;
  }
};

const retryAllFailed = async () => {
  loading.value = true;
  actionMessage.value = '';

  try {
    await syncStore.retryAllFailed();
    actionMessage.value = 'All failed items were reset to pending.';
  } catch (err) {
    actionMessage.value = err instanceof Error ? err.message : String(err);
  } finally {
    loading.value = false;
  }
};

onMounted(async () => {
  await refreshStatus();
});
</script>

<template>
  <main class="min-h-screen bg-background text-text-primary p-8 transition-colors duration-200">
    <div class="max-w-6xl mx-auto space-y-6">
      <section class="rounded-card bg-card p-8 shadow-card transition-colors duration-200">
        <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 class="text-4xl font-semibold text-text-primary">Sync Center</h1>
            <p class="text-text-muted">Monitor local sync status and resolve failed queue items.</p>
          </div>
          <div class="flex flex-wrap gap-3">
            <CmButton
              @click="processQueue"
              :disabled="loading || syncStore.isSyncing"
              variant="primary"
            >
              {{ loading ? 'Processing...' : 'Process queue' }}
            </CmButton>
            <CmButton
              v-if="syncStore.failedCount > 0"
              @click="retryAllFailed"
              :disabled="loading || syncStore.isSyncing"
              variant="warning"
            >
              Retry all failed
            </CmButton>
          </div>
        </div>
      </section>

      <section class="rounded-card bg-card p-8 shadow-card transition-colors duration-200">
        <div class="grid gap-6 sm:grid-cols-3">
          <div class="rounded-card bg-surface p-6 shadow-card">
            <p class="text-sm uppercase tracking-[0.24em] text-text-muted">Pending</p>
            <p class="mt-4 text-4xl font-semibold text-primary">{{ syncStore.pendingCount }}</p>
          </div>
          <div class="rounded-card bg-surface p-6 shadow-card">
            <p class="text-sm uppercase tracking-[0.24em] text-text-muted">Failed</p>
            <p class="mt-4 text-4xl font-semibold text-warning">{{ syncStore.failedCount }}</p>
          </div>
          <div class="rounded-card bg-surface p-6 shadow-card">
            <p class="text-sm uppercase tracking-[0.24em] text-text-muted">Last refreshed</p>
            <p class="mt-4 text-2xl font-semibold text-text-primary">{{ syncStore.lastSyncedAt || 'never' }}</p>
          </div>
        </div>
        <p v-if="actionMessage" class="mt-4 text-sm text-success">{{ actionMessage }}</p>
        <p v-if="syncStore.error" class="mt-2 text-sm text-danger">{{ syncStore.error }}</p>
      </section>

      <section class="rounded-card bg-card p-8 shadow-card transition-colors duration-200">
        <h2 class="text-2xl font-semibold mb-4 text-text-primary">Failed sync items</h2>
        <p class="text-text-muted mb-6">Review and retry items that could not be synced.</p>

        <div v-if="syncStore.failedItems.length === 0" class="rounded-card bg-surface p-8 text-text-muted">
          No failed sync items. Everything is up to date.
        </div>

        <div v-else class="space-y-4">
          <div
            v-for="item in syncStore.failedItems"
            :key="item.id"
            class="rounded-card border border-divider bg-card p-6"
          >
            <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <p class="text-sm uppercase tracking-[0.24em] text-text-muted">{{ item.entity_type }} / {{ item.entity_id }}</p>
                <p class="mt-2 text-lg font-semibold text-text-primary">{{ item.operation }}</p>
                <p class="mt-1 text-sm text-text-muted">Retry count: {{ item.retry_count }}</p>
              </div>
              <CmButton
                @click="retryFailedItem(item.id)"
                :disabled="loading || syncStore.isSyncing"
                variant="success"
              >
                Retry
              </CmButton>
            </div>
            <p class="mt-4 text-sm text-danger">Error: {{ item.error_message }}</p>
            <p class="mt-2 text-xs text-text-muted">Created at: {{ new Date(item.created_at).toLocaleString() }}</p>
          </div>
        </div>
      </section>
    </div>
  </main>
</template>