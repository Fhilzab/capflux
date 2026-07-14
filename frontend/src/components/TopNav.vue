<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/authStore';
import { useSyncStore } from '../stores/syncStore';
import { useDashboardStore } from '../stores/dashboardStore';

const router = useRouter();
const authStore = useAuthStore();
const syncStore = useSyncStore();
const dashboardStore = useDashboardStore();

const online = ref(typeof navigator !== 'undefined' ? navigator.onLine : true);

const userEmail = computed(() => authStore.user?.email || 'admin@capstone.local');
const displayName = computed(() => {
  const email = userEmail.value;
  return email.split('@')[0] || 'Admin';
});

// Global search handler
const openSearch = () => {
  // Cmd+K / Ctrl+K handler placeholder
  console.log('Global search triggered');
};

const syncStatus = computed(() => {
  if (!online.value) return { label: 'Offline', status: 'error' as const };
  if (syncStore.pendingCount > 0) return { label: `${syncStore.pendingCount} pending`, status: 'pending' as const };
  return { label: 'Synced', status: 'success' as const };
});
</script>

<template>
  <header class="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-800/50 bg-slate-950/80 backdrop-blur-xl px-6">
    <!-- Left: School branding -->
    <div class="flex items-center gap-4">
      <svg class="h-8 w-8 text-cyan-400" viewBox="0 0 32 32" fill="none">
        <rect width="32" height="32" rx="8" fill="currentColor" fill-opacity="0.1" />
        <path d="M16 4L24 8V16L16 20L8 16V8L16 4Z" stroke="currentColor" stroke-width="1.5" />
        <path d="M16 12V20" stroke="currentColor" stroke-width="1.5" />
      </svg>
      <div>
        <h1 class="text-lg font-bold text-white">Capstone</h1>
        <p class="text-xs text-slate-500 -mt-0.5">School Finance</p>
      </div>
    </div>

    <!-- Center: Global Search -->
    <div class="flex-1 max-w-md mx-8">
      <button 
        @click="openSearch"
        class="flex w-full items-center gap-3 rounded-xl bg-slate-900/80 border border-slate-800 px-4 py-2 text-sm text-slate-400 hover:bg-slate-800/80 hover:text-slate-300 transition-colors focus-ring"
      >
        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.5-5.5m2.276-6.75a7.5 7.5 0 11-15 0 7.5 7.5 0 0115 0z" />
        </svg>
        <span class="flex-1 text-left">Search students, payments, guardians...</span>
        <kbd class="hidden sm:inline-flex items-center rounded-md bg-slate-800 px-1.5 py-0.5 text-xs">⌘K</kbd>
      </button>
    </div>

    <!-- Right: Status indicators and profile -->
    <div class="flex items-center gap-3">
      <!-- Notification Bell -->
      <button class="relative flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900/80 text-slate-400 hover:bg-slate-800/80 hover:text-slate-200 transition-colors">
        <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M14.857 17.082a7 7 0 00-5.714 0A2.25 2.25 0 013 15.75V9.125a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 9.125v6.625c0 .441-.204.857-.543 1.143l-2.24.962" />
        </svg>
        <span v-if="dashboardStore.pendingNotifications > 0" class="absolute -top-1 -right-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-rose-500 px-1 text-xs font-medium text-white">
          {{ dashboardStore.pendingNotifications > 99 ? '99+' : dashboardStore.pendingNotifications }}
        </span>
      </button>

      <!-- Messages -->
      <button class="relative flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900/80 text-slate-400 hover:bg-slate-800/80 hover:text-slate-200 transition-colors">
        <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.844L3 21l2.121-4.757C3.516 14.802 3 13.447 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      </button>

      <!-- Sync Status -->
      <div class="flex items-center gap-2 rounded-xl bg-slate-900/80 px-3 py-2">
        <span class="h-2 w-2 rounded-full" :class="{
          'bg-emerald-400': syncStatus.status === 'success',
          'bg-amber-400 animate-pulse': syncStatus.status === 'pending',
          'bg-rose-400': syncStatus.status === 'error'
        }"></span>
        <span class="text-xs text-slate-400 hidden sm:inline">{{ syncStatus.label }}</span>
      </div>

      <!-- Internet Status -->
      <div class="flex items-center gap-2 rounded-xl bg-slate-900/80 px-3 py-2">
        <span class="h-2 w-2 rounded-full" :class="online ? 'bg-emerald-400' : 'bg-rose-400'"></span>
        <span class="text-xs text-slate-400 hidden sm:inline">{{ online ? 'Online' : 'Offline' }}</span>
      </div>

      <!-- Offline Indicator -->
      <div v-if="!online || syncStore.pendingCount > 0" class="flex items-center gap-2 rounded-xl bg-slate-900/80 px-3 py-2">
        <span class="text-xs text-slate-400">
          {{ syncStore.pendingCount }} offline
        </span>
      </div>

      <!-- Profile Menu -->
      <div class="relative">
        <button class="flex items-center gap-2 rounded-xl bg-slate-900/80 pl-3 pr-2 py-2 hover:bg-slate-800/80 transition-colors">
          <span class="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/20 text-xs font-medium text-cyan-400">
            {{ displayName.charAt(0).toUpperCase() }}
          </span>
          <span class="hidden sm:block text-sm font-medium text-white truncate max-w-32">{{ displayName }}</span>
          <svg class="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </button>
      </div>
    </div>
  </header>
</template>