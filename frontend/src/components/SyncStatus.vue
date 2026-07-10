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
  <div class="rounded-3xl border border-slate-800 bg-slate-950 p-6 text-slate-200 shadow-inner">
    <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <p class="text-sm uppercase tracking-[0.2em] text-slate-400">Sync Status</p>
        <p class="mt-2 text-2xl font-semibold text-white">
          {{ syncStore.pendingCount }} pending item<span v-if="syncStore.pendingCount !== 1">s</span>
        </p>
        <p class="text-sm text-slate-500 mt-1">
          {{ syncStore.failedCount }} failed item<span v-if="syncStore.failedCount !== 1">s</span>
        </p>
        <p class="text-sm text-slate-500 mt-1">
          Connection: <span :class="online ? 'text-cyan-400' : 'text-rose-400'">{{ online ? 'Online' : 'Offline' }}</span>
        </p>
        <p class="text-sm text-slate-500 mt-1">
          Last refreshed: {{ syncStore.lastSyncedAt || 'never' }}
        </p>
      </div>
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          @click="refresh"
          class="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
          :disabled="syncStore.isSyncing"
        >
          {{ syncStore.isSyncing ? 'Refreshing...' : 'Refresh' }}
        </button>
        <button
          v-if="syncStore.failedItems.length"
          @click="retryAll"
          class="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-400"
          :disabled="syncStore.isSyncing"
        >
          Retry all failed
        </button>
      </div>
    </div>
    <p v-if="syncStore.error" class="mt-3 text-sm text-rose-400">{{ syncStore.error }}</p>

    <div v-if="syncStore.failedItems.length" class="mt-6 space-y-4">
      <p class="text-sm uppercase tracking-[0.2em] text-slate-400">Failed sync items</p>
      <div class="grid gap-3">
        <div v-for="item in syncStore.failedItems" :key="item.id" class="rounded-3xl border border-slate-800 bg-slate-900 p-4">
          <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p class="font-semibold text-white">{{ item.entity_type }} / {{ item.entity_id }}</p>
              <p class="text-sm text-slate-400">{{ item.operation }} • Retry count: {{ item.retry_count }}</p>
            </div>
            <button
              @click="retryItem(item.id)"
              class="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
              :disabled="syncStore.isSyncing"
            >
              Retry
            </button>
          </div>
          <p class="mt-3 text-sm text-rose-400">{{ item.error_message }}</p>
          <p class="mt-2 text-xs text-slate-500">Created: {{ new Date(item.created_at).toLocaleString() }}</p>
        </div>
      </div>
    </div>
  </div>
</template>
