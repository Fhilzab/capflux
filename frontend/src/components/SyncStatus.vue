<script setup>
import { onMounted, ref } from 'vue';
import { useSyncStore } from '../stores/syncStore';

const syncStore = useSyncStore();
const online = ref(typeof navigator !== 'undefined' ? navigator.onLine : true);

const refresh = async () => {
  await syncStore.refreshStatus();
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
      <button
        @click="refresh"
        class="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
        :disabled="syncStore.isSyncing"
      >
        {{ syncStore.isSyncing ? 'Refreshing...' : 'Refresh' }}
      </button>
    </div>
    <p v-if="syncStore.error" class="mt-3 text-sm text-rose-400">{{ syncStore.error }}</p>
  </div>
</template>
