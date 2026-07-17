<script setup>
import { onMounted, ref } from 'vue';
import { useSyncStore } from '../stores/syncStore';

const syncStore = useSyncStore();
const online = ref(typeof navigator !== 'undefined' ? navigator.onLine : true);

const refresh = async () => {
  await syncStore.refreshStatus();
};

const retryItem = async (id) => {
  await syncStore.retryFailedItem(id);
};

const retryAll = async () => {
  await syncStore.retryAllFailed();
};

const updateOnlineStatus = () => {
  online.value = typeof navigator !== 'undefined' ? navigator.onLine : true;
};

onMounted(async () => {
  await refresh();
  updateOnlineStatus();

  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
      updateOnlineStatus();
      refresh();
    });
    window.addEventListener('offline', updateOnlineStatus);
  }

  setInterval(refresh, 30000);
});
</script>

<template>
  <div class="rounded-card border border-divider bg-card p-6 text-text-primary transition-colors duration-200 premium-card">
    <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <p class="text-sm uppercase tracking-[0.2em] text-text-muted">Sync Status</p>
        <p class="mt-2 text-2xl font-semibold text-text-primary">
          {{ syncStore.pendingCount }} pending item<span v-if="syncStore.pendingCount !== 1">s</span>
        </p>
        <p class="text-sm text-text-muted mt-1">
          {{ syncStore.failedCount }} failed item<span v-if="syncStore.failedCount !== 1">s</span>
        </p>
        <p class="text-sm text-text-muted mt-1">
          Connection: 
          <span :class="online ? 'text-success' : 'text-danger'" class="font-medium">
            {{ online ? 'Online' : 'Offline' }}
          </span>
        </p>
        <p class="text-sm text-text-muted mt-1">
          Last refreshed: {{ syncStore.lastSyncedAt || 'never' }}
        </p>
      </div>
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          @click="refresh"
          class="rounded-button bg-brand px-4 py-2 text-sm font-medium text-background transition hover:shadow-md focus-ring"
          :disabled="syncStore.isSyncing"
        >
          {{ syncStore.isSyncing ? 'Refreshing...' : 'Refresh' }}
        </button>
        <button
          v-if="syncStore.failedItems.length"
          @click="retryAll"
          class="rounded-button bg-warning/10 px-4 py-2 text-sm font-medium text-warning border border-warning/20 transition hover:bg-warning/20 focus-ring"
          :disabled="syncStore.isSyncing"
        >
          Retry all failed
        </button>
      </div>
    </div>
    <p v-if="syncStore.error" class="mt-3 text-sm text-danger">{{ syncStore.error }}</p>

    <div v-if="syncStore.failedItems.length" class="mt-6 space-y-4">
      <p class="text-sm uppercase tracking-[0.2em] text-text-muted">Failed sync items</p>
      <div class="grid gap-3">
        <div v-for="item in syncStore.failedItems" :key="item.id" class="rounded-card border border-divider bg-surface p-4 transition-colors duration-200 premium-card--glow">
          <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p class="font-semibold text-text-primary">{{ item.entity_type }} / {{ item.entity_id }}</p>
              <p class="text-sm text-text-muted">{{ item.operation }} • Retry count: {{ item.retry_count }}</p>
            </div>
            <button
              @click="retryItem(item.id)"
              class="rounded-button bg-success/10 px-4 py-2 text-sm font-medium text-success border border-success/20 transition hover:bg-success/20 focus-ring"
              :disabled="syncStore.isSyncing"
            >
              Retry
            </button>
          </div>
          <p class="mt-3 text-sm text-danger">{{ item.error_message }}</p>
          <p class="mt-2 text-xs text-text-muted">Created: {{ new Date(item.created_at).toLocaleString() }}</p>
        </div>
      </div>
    </div>
  </div>
</template>