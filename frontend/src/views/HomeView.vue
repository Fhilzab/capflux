<script setup>
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import NavigationBar from '../components/NavigationBar.vue';
import SyncStatus from '../components/SyncStatus.vue';
import { useSyncStore } from '../stores/syncStore';

const title = 'Capstone Dashboard';
const router = useRouter();
const syncStore = useSyncStore();
const online = ref(typeof navigator !== 'undefined' ? navigator.onLine : true);

const refreshSync = async () => {
  await syncStore.refreshStatus();
};

const updateOnlineStatus = () => {
  online.value = typeof navigator !== 'undefined' ? navigator.onLine : true;
};

onMounted(async () => {
  await refreshSync();
  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
      updateOnlineStatus();
      refreshSync();
    });
    window.addEventListener('offline', updateOnlineStatus);
  }
});
</script>

<template>
  <main class="min-h-screen bg-slate-950 text-white p-8">
    <div class="max-w-5xl mx-auto space-y-6">
      <NavigationBar />

      <div class="grid gap-6 lg:grid-cols-2">
        <div class="rounded-3xl bg-slate-900 p-8 shadow-xl">
          <h1 class="text-4xl font-semibold mb-4">{{ title }}</h1>
          <p class="text-slate-400">This is the authenticated home screen for Capstone.</p>
        </div>

        <div class="rounded-3xl bg-slate-900 p-8 shadow-xl">
          <div class="flex flex-col gap-4">
            <div>
              <p class="text-sm uppercase tracking-[0.24em] text-slate-500">Sync summary</p>
              <p class="mt-2 text-2xl font-semibold text-white">Queue health at a glance</p>
            </div>
            <div class="grid gap-4 sm:grid-cols-3">
              <div class="rounded-3xl bg-slate-950 p-4 text-center">
                <p class="text-sm uppercase tracking-[0.24em] text-slate-400">Pending</p>
                <p class="mt-3 text-3xl font-semibold text-cyan-400">{{ syncStore.pendingCount }}</p>
              </div>
              <div class="rounded-3xl bg-slate-950 p-4 text-center">
                <p class="text-sm uppercase tracking-[0.24em] text-slate-400">Failed</p>
                <p class="mt-3 text-3xl font-semibold text-amber-400">{{ syncStore.failedCount }}</p>
              </div>
              <div class="rounded-3xl bg-slate-950 p-4 text-center">
                <p class="text-sm uppercase tracking-[0.24em] text-slate-400">Status</p>
                <p class="mt-3 text-3xl font-semibold" :class="online ? 'text-cyan-400' : 'text-rose-400'">
                  {{ online ? 'Online' : 'Offline' }}
                </p>
              </div>
            </div>
            <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p class="text-sm text-slate-400">Last refreshed: {{ syncStore.lastSyncedAt || 'never' }}</p>
              <button
                @click="refreshSync"
                class="rounded-2xl bg-cyan-500 px-5 py-3 font-semibold text-slate-950 hover:bg-cyan-400"
              >
                Refresh Sync
              </button>
            </div>
          </div>
        </div>
      </div>

      <SyncStatus />

      <section class="rounded-3xl bg-slate-900 p-8 shadow-xl">
        <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 class="text-2xl font-semibold">Sync Center</h2>
            <p class="text-slate-400">Review sync status and resolve failed queue items from one place.</p>
          </div>
          <button
            @click="router.push({ name: 'Sync' })"
            class="rounded-2xl bg-cyan-500 px-5 py-3 font-semibold text-slate-950 hover:bg-cyan-400"
          >
            Open Sync Page
          </button>
        </div>
      </section>
    </div>
  </main>
</template>
