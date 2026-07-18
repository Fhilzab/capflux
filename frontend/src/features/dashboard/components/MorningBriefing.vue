<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  todaysCollections?: number;
  outstandingStudents?: number;
  pendingDVAs?: number;
  pendingVerification?: number;
  offlineQueue?: number;
  pendingNotifications?: number;
  collectionTrend?: number;
  loading?: boolean;
}

const props = defineProps<Props>();

const timeOfDay = computed(() => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Morning';
  if (hour < 17) return 'Afternoon';
  return 'Evening';
});

const briefingItems = computed(() => [
  { color: 'text-brand', value: props.todaysCollections || 0, label: 'collected today' },
  { color: 'text-amber-400', value: props.outstandingStudents || 0, label: 'students still owe fees' },
  { color: 'text-violet-400', value: props.pendingDVAs || 0, label: 'new students awaiting DVA' },
  { color: 'text-amber-400', value: props.pendingVerification || 0, label: 'payments awaiting verification' },
  { color: props.offlineQueue === 0 ? 'text-success' : 'text-amber-400', value: props.offlineQueue === 0 ? 'empty' : `${props.offlineQueue} pending`, label: 'offline queue' },
  { color: props.pendingNotifications === 0 ? 'text-success' : 'text-amber-400', value: props.pendingNotifications === 0 ? 'healthy' : 'needs attention', label: 'notifications' },
]);
</script>

<template>
  <div class="premium-card--glow relative overflow-hidden p-6">
    <!-- AI badge -->
    <div class="absolute top-4 right-4 flex items-center gap-1 rounded-full bg-violet-500/10 px-2.5 py-1">
      <svg class="h-3 w-3 text-violet-400" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="M9.663 17h4.673M12 3v1m0 16v1m-6-6h2m2-12h.01M5.64 5.64l.66.66m12.02-.66l-.66.66M7.64 7.64l.66.66m12.02-.66l-.66.66M12 21a9 9 0 110-18 9 9 0 0118 0z" />
      </svg>
      <span class="text-xs font-medium text-violet-400">AI-powered</span>
    </div>

    <div class="flex items-start gap-4 mb-5">
      <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-400">
        <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9.663 17h4.673M12 3v1m0 16v1m-6-6h2m2-12h.01M5.64 5.64l.66.66m12.02-.66l-.66.66M7.64 7.64l.66.66m12.02-.66l-.66.66M12 21a9 9 0 110-18 9 9 0 0118 0z" />
        </svg>
      </div>
      <div>
        <h2 class="text-xl font-semibold text-white">Good {{ timeOfDay }}</h2>
        <p class="text-sm text-slate-400">Today's Financial Brief</p>
      </div>
    </div>
    
    <ul class="space-y-2.5 text-sm">
      <li v-for="(item, i) in briefingItems" :key="i" class="flex items-center gap-2 text-slate-300">
        <span :class="item.color">•</span>
        <span class="font-mono">{{ typeof item.value === 'number' ? '₦' + item.value.toLocaleString() : item.value }}</span>
        <span class="text-slate-500">{{ item.label }}</span>
      </li>
      <li v-if="collectionTrend" class="flex items-center gap-2 text-slate-300">
        <span class="text-success">•</span>
        <span class="text-slate-500">Collection rate is</span>
        <span class="text-success font-medium">{{ collectionTrend > 0 ? '+' : '' }}{{ collectionTrend }}% higher than yesterday</span>
      </li>
    </ul>
  </div>
</template>