<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useAuthStore } from '../../stores/authStore';
import { useDashboardStore } from '../../stores/dashboardStore';

const authStore = useAuthStore();
const dashboardStore = useDashboardStore();

const userName = computed(() => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
});

const briefItems = computed(() => [
  { id: 1, text: `₦${(dashboardStore.todaysCollections || 0).toLocaleString()} collected today`, icon: 'banknotes' },
  { id: 2, text: `${dashboardStore.outstandingStudentCount || 0} students still owe fees`, icon: 'exclamation' },
  { id: 3, text: `${dashboardStore.pendingDVAs || 0} DVA accounts awaiting activation`, icon: 'wallet' },
  { id: 4, text: 'All systems healthy', icon: 'check-circle' },
  { id: 5, text: 'Last synchronization 2 minutes ago', icon: 'arrow-path' },
]);

const currentBrief = ref(0);
let briefTimer: number;

onMounted(() => {
  briefTimer = window.setInterval(() => {
    currentBrief.value = (currentBrief.value + 1) % briefItems.value.length;
  }, 6000);
});

onUnmounted(() => {
  if (briefTimer) clearInterval(briefTimer);
});
</script>

<template>
  <header class="mb-8">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-display mb-2">
          {{ userName }}, <span class="text-cyan-500">{{ authStore.user?.email?.split('@')[0] || 'Philips' }}</span> 👋
        </h1>
        <div class="h-6 overflow-hidden">
          <Transition name="brief" mode="out-in">
            <p :key="currentBrief" class="text-slate-500 dark:text-slate-400 animate-fade-in">
              {{ briefItems[currentBrief].text }}
            </p>
          </Transition>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <span class="text-label text-slate-500 dark:text-slate-400">Press CMD+K for search</span>
      </div>
    </div>
  </header>
</template>

<style scoped>
.brief-enter-active,
.brief-leave-active {
  transition: all 0.5s ease;
}

.brief-enter-from {
  opacity: 0;
  transform: translateY(10px);
}

.brief-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>