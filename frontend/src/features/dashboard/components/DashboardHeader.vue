<script setup lang="ts">
import { computed } from 'vue';
import { useDashboardStore } from '../stores/dashboardStore';

const dashboardStore = useDashboardStore();

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
        Dashboard
      </h1>
      <p class="text-xs text-slate-400">
        Financial Command Center • {{ operationalSummary }}
      </p>
    </div>
  </header>
</template>