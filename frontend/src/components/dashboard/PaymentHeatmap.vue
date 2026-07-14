<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  bestPaymentDay?: string;
  bestPaymentHour?: string;
  bestCollectionWeek?: string;
  bestCategory?: string;
  highestPayingSegment?: string;
  loading?: boolean;
}

defineProps<Props>();
</script>

<template>
  <section>
    <div class="mb-4 flex items-center gap-2">
      <h2 class="text-headline">Payment Heatmap</h2>
      <span class="rounded-full bg-cyan-500/10 px-2.5 py-1 text-xs font-medium text-cyan-400">Behavioral</span>
    </div>

    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div class="premium-card p-5">
        <p class="text-label mb-2">Best Payment Day</p>
        <p class="text-metric text-cyan-400">{{ bestPaymentDay || 'N/A' }}</p>
      </div>
      <div class="premium-card p-5">
        <p class="text-label mb-2">Best Payment Hour</p>
        <p class="text-metric text-emerald-400">{{ bestPaymentHour || 'N/A' }}</p>
      </div>
      <div class="premium-card p-5">
        <p class="text-label mb-2">Best Collection Week</p>
        <p class="text-metric text-violet-400">{{ bestCollectionWeek || 'N/A' }}</p>
      </div>
      <div class="premium-card p-5">
        <p class="text-label mb-2">Top Category</p>
        <p class="text-metric text-amber-400">{{ bestCategory || 'N/A' }}</p>
      </div>
      <div class="premium-card p-5">
        <p class="text-label mb-2">High-Value Segment</p>
        <p class="text-metric text-cyan-400">{{ highestPayingSegment || 'N/A' }}</p>
      </div>
    </div>
  </section>
</template>