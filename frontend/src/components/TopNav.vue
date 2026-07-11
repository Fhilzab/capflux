<script setup>
import { computed, ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/authStore';
import { useSyncStore } from '../stores/syncStore';
import { StudentService } from '../services/StudentService';

const router = useRouter();
const authStore = useAuthStore();
const syncStore = useSyncStore();

const online = ref(typeof navigator !== 'undefined' ? navigator.onLine : true);
const studentCount = ref(0);

const userEmail = computed(() => authStore.user?.email || 'demo@capstone.local');
const displayName = computed(() => {
  const email = userEmail.value;
  return email.split('@')[0] || 'User';
});

const loadStats = async () => {
  try {
    const students = await StudentService.getStudentsBySchool('demo-school');
    studentCount.value = students.length;
    await syncStore.refreshStatus();
  } catch {
    // silently fail
  }
};

onMounted(loadStats);
</script>

<template>
  <header class="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-800 bg-slate-950/80 backdrop-blur-xl px-6">
    <div class="flex items-center gap-4">
      <!-- Mobile sidebar toggle could go here -->
      <p class="text-sm text-slate-400">
        <span class="hidden sm:inline">Welcome back, </span>
        <span class="font-semibold text-white">{{ displayName }}</span>
      </p>
    </div>

    <div class="flex items-center gap-4">
      <!-- Online/Offline indicator -->
      <div class="flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2">
        <span class="h-2 w-2 rounded-full" :class="online ? 'bg-emerald-400' : 'bg-rose-400'"></span>
        <span class="text-xs text-slate-400">{{ online ? 'Online' : 'Offline' }}</span>
      </div>

      <!-- Sync status -->
      <div class="hidden sm:flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2">
        <svg class="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
        </svg>
        <span class="text-xs text-slate-400">
          {{ syncStore.pendingCount }} pending
        </span>
      </div>

      <!-- Student count -->
      <div class="hidden sm:flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2">
        <svg class="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"/>
        </svg>
        <span class="text-xs text-slate-400">{{ studentCount }} students</span>
      </div>
    </div>
  </header>
</template>