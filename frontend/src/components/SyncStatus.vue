<script setup>
import { onMounted } from 'vue';
import { useSyncStore } from '../stores/syncStore';

const syncStore = useSyncStore();

const refresh = async () => {
  await syncStore.refreshStatus();
};

onMounted(async () => {
  await refresh();
  setInterval(refresh, 30000);
});
</script>

<template>
  <div class="rounded-3xl border border-slate-800 bg-slate-950 p-6 text-slate-200 shadow-inner">
    <div class="flex items-center justify-between gap-4">
      <div>
        <p class="text-sm uppercase tracking-[0.2em] text-slate-400">Sync Status</p>
        <p class="mt-2 text-2xl font-semibold text-white">
          {{ syncStore.pendingCount }} pending item<span v-if="syncStore.pendingCount !== 1">s</span>
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
