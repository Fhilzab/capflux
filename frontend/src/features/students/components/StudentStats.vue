<script setup lang="ts">
interface StatItem {
  key: string;
  label: string;
  value: number;
  description: string;
  icon: string;
}

interface Props {
  stats: StatItem[];
}

const props = defineProps<Props>();

function formatValue(value: number): string {
  return typeof value === 'number' ? value.toLocaleString() : String(value);
}
</script>

<template>
  <!-- Compact stat strip: single-row summary without the MetricCard
    chrome (padding, icon well, hover elevation) so five metrics fit
    without pushing the workspace down. Same data contract as before. -->
  <div
    class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
    data-testid="student-stats"
  >
    <div
      v-for="stat in props.stats ?? []"
      :key="stat.key"
      class="rounded-card border border-border bg-card px-4 py-3"
    >
      <p class="text-xs font-medium uppercase tracking-wider text-text-muted">
        {{ stat.label }}
      </p>
      <p class="mt-1 text-2xl font-bold tabular-nums text-text-primary">
        {{ formatValue(stat.value) }}
      </p>
      <p class="mt-0.5 truncate text-xs text-text-muted" :title="stat.description">
        {{ stat.description }}
      </p>
    </div>
  </div>
</template>
