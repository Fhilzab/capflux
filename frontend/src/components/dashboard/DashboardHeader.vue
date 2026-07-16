<script setup lang="ts">
import { computed } from 'vue';
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

const operationalSummary = computed(() => {
  const items = [];
  if (dashboardStore.pendingDVAs > 0) {
    items.push(`${dashboardStore.pendingDVAs} DVA accounts awaiting activation`);
  }
  items.push('System Healthy');
  return items.join(' • ');
});
</script>

<template>
  <header class="mb-4">
    <div>
      <h1 class="text-2xl font-bold text-white mb-1">
        {{ userName }}, <span class="text-cyan-500">{{ authStore.user?.email?.split('@')[0] || 'Philips' }}</span> 👋
      </h1>
      <p class="text-xs text-slate-400">
        {{ operationalSummary }}
      </p>
    </div>
  </header>
</template>