<script setup lang="ts">
interface Props {
  label: string;
  value: string | number;
  description?: string;
  currency?: boolean;
  trend?: 'up' | 'down' | 'flat';
  trendValue?: string;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'ai';
}

defineProps<Props>();
</script>

<template>
  <div class="premium-card--glow p-5">
    <div class="flex items-center justify-between mb-3">
      <p class="text-label">{{ label }}</p>
      <div v-if="trend" class="flex items-center gap-1">
        <span class="text-xs font-medium" :class="{
          'text-emerald-400': trend === 'up',
          'text-rose-400': trend === 'down',
          'text-slate-400': trend === 'flat'
        }">
          {{ trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→' }}
        </span>
        <span v-if="trendValue" class="text-xs text-slate-500">{{ trendValue }}</span>
      </div>
    </div>
    <p class="text-metric text-white mb-1.5">
      {{ currency ? '₦' : '' }}{{ typeof value === 'number' ? value.toLocaleString() : value }}
    </p>
    <p v-if="description" class="text-xs text-slate-500">{{ description }}</p>
  </div>
</template>