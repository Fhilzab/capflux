<script setup>
import { onMounted, ref } from 'vue';
import { useSyncStore } from '../stores/syncStore';
import { SyncService } from '../services/SyncService';

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
  <main class="min-h-screen bg-slate-950 text-white p-8">
    <div class="max-w-6xl mx-auto space-y-6">
      <section class="rounded-3xl bg-slate-900 p-8 shadow-xl">
        <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 class="text-4xl font-semibold">Sync Center</h1>
            <p class="text-slate-400">Monitor local sync status and resolve failed queue items.</p>
          </div>
          <div class="flex flex-wrap gap-3">
            <button
              @click="processQueue"
              :disabled="loading || syncStore.isSyncing"
              class="rounded-2xl bg-cyan-500 px-5 py-3 font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-50"
            >
              {{ loading ? 'Processing...' : 'Process queue' }}
            </button>
            <button
              v-if="syncStore.failedCount > 0"
              @click="retryAllFailed"
              :disabled="loading || syncStore.isSyncing"
              class="rounded-2xl bg-amber-500 px-5 py-3 font-semibold text-slate-950 hover:bg-amber-400 disabled:opacity-50"
            >
              Retry all failed
            </button>
          </div>
        </div>
      </section>

      <section class="rounded-3xl bg-slate-900 p-8 shadow-xl">
        <div class="grid gap-6 sm:grid-cols-3">
          <div class="rounded-3xl bg-slate-950 p-6">
            <p class="text-sm uppercase tracking-[0.24em] text-slate-500">Pending</p>
            <p class="mt-4 text-4xl font-semibold text-cyan-400">{{ syncStore.pendingCount }}</p>
          </div>
          <div class="rounded-3xl bg-slate-950 p-6">
            <p class="text-sm uppercase tracking-[0.24em] text-slate-500">Failed</p>
            <p class="mt-4 text-4xl font-semibold text-amber-400">{{ syncStore.failedCount }}</p>
          </div>
          <div class="rounded-3xl bg-slate-950 p-6">
            <p class="text-sm uppercase tracking-[0.24em] text-slate-500">Last refreshed</p>
            <p class="mt-4 text-2xl font-semibold text-slate-100">{{ syncStore.lastSyncedAt || 'never' }}</p>
          </div>
        </div>
        <p v-if="actionMessage" class="mt-4 text-sm text-emerald-400">{{ actionMessage }}</p>
        <p v-if="syncStore.error" class="mt-2 text-sm text-rose-400">{{ syncStore.error }}</p>
      </section>

      <section class="rounded-3xl bg-slate-900 p-8 shadow-xl">
        <h2 class="text-2xl font-semibold mb-4">Failed sync items</h2>
        <p class="text-slate-400 mb-6">Review and retry items that could not be synced.</p>

        <div v-if="syncStore.failedItems.length === 0" class="rounded-3xl bg-slate-950 p-8 text-slate-400">
          No failed sync items. Everything is up to date.
        </div>

        <div v-else class="space-y-4">
          <div
            v-for="item in syncStore.failedItems"
            :key="item.id"
            class="rounded-3xl border border-slate-800 bg-slate-950 p-6"
          >
            <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <p class="text-sm uppercase tracking-[0.24em] text-slate-500">{{ item.entity_type }} / {{ item.entity_id }}</p>
                <p class="mt-2 text-lg font-semibold text-white">{{ item.operation }}</p>
                <p class="mt-1 text-sm text-slate-400">Retry count: {{ item.retry_count }}</p>
              </div>
              <button
                @click="retryFailedItem(item.id)"
                :disabled="loading || syncStore.isSyncing"
                class="rounded-2xl bg-emerald-500 px-5 py-3 font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
              >
                Retry
              </button>
            </div>
            <p class="mt-4 text-sm text-rose-400">Error: {{ item.error_message }}</p>
            <p class="mt-2 text-xs text-slate-500">Created at: {{ new Date(item.created_at).toLocaleString() }}</p>
          </div>
        </div>
      </section>
    </div>
  </main>
</template>
