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
      <span class="rounded-full bg-brand/10 px-2.5 py-1 text-xs font-medium text-brand">Behavioral</span>
    </div>

    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div class="premium-card p-5">
        <p class="text-label mb-2">Best Payment Day</p>
        <p class="text-metric text-brand">{{ bestPaymentDay || 'N/A' }}</p>
      </div>
      <div class="premium-card p-5">
        <p class="text-label mb-2">Best Payment Hour</p>
        <p class="text-metric text-success">{{ bestPaymentHour || 'N/A' }}</p>
      </div>
      <div class="premium-card p-5">
        <p class="text-label mb-2">Best Collection Week</p>
        <p class="text-metric text-info">{{ bestCollectionWeek || 'N/A' }}</p>
      </div>
      <div class="premium-card p-5">
        <p class="text-label mb-2">Top Category</p>
        <p class="text-metric text-warning">{{ bestCategory || 'N/A' }}</p>
      </div>
      <div class="premium-card p-5">
        <p class="text-label mb-2">High-Value Segment</p>
        <p class="text-metric text-brand">{{ highestPayingSegment || 'N/A' }}</p>
      </div>
    </div>
  </section>
</template>