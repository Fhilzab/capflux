<script setup lang="ts">
interface Props {
  label: string;
  value: string | number;
  description?: string;
  currency?: boolean;
  trend?: 'up' | 'down' | 'flat';
  trendValue?: string;
}

defineProps<Props>();
</script>

<template>
  <div class="premium-card--glow p-5">
    <div class="flex items-center justify-between mb-3">
      <p class="text-label">{{ label }}</p>
      <div v-if="trend" class="flex items-center gap-1">
        <span class="text-xs font-medium" :class="{
          'text-success': trend === 'up',
          'text-danger': trend === 'down',
          'text-text-muted': trend === 'flat'
        }">
          {{ trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→' }}
        </span>
        <span v-if="trendValue" class="text-xs text-text-muted">{{ trendValue }}</span>
      </div>
    </div>
    <p class="text-metric text-text-primary mb-1.5">
      {{ currency ? '₦' : '' }}{{ typeof value === 'number' ? value.toLocaleString() : value }}
    </p>
    <p v-if="description" class="text-xs text-text-muted">{{ description }}</p>
  </div>
</template>