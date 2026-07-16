<script setup lang="ts">
interface Props {
  label: string;
  value: string | number;
  trend?: 'up' | 'down' | 'flat';
  trendValue?: string;
  description?: string;
  currency?: boolean;
  icon?: string;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'ai';
}

const props = defineProps<Props>();

const variantClasses = {
  default: 'text-text-primary',
  success: 'text-success',
  warning: 'text-warning',
  error: 'text-danger',
  info: 'text-info',
  ai: 'text-ai',
};

const variantBg = {
  default: 'bg-card',
  success: 'bg-success/10',
  warning: 'bg-warning/10',
  error: 'bg-danger/10',
  info: 'bg-info/10',
  ai: 'bg-ai/10',
};
</script>

<template>
  <div class="bg-card border border-border shadow-card rounded-card p-6 transition-all duration-150 hover:shadow-card">
    <div class="flex items-start justify-between mb-4">
      <p class="text-xs uppercase tracking-wider font-semibold text-text-muted">{{ label }}</p>
      <div v-if="icon" class="flex h-9 w-9 items-center justify-center rounded-card border border-border" :class="variantBg[variant || 'default']">
        <svg class="h-4.5 w-4.5" :class="variantClasses[variant || 'default']" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" :d="icon" />
        </svg>
      </div>
    </div>
    <div class="space-y-1.5">
      <p class="text-3xl font-bold font-mono" :class="variantClasses[variant || 'default']">
        {{ currency ? '₦' : '' }}{{ typeof value === 'number' ? value.toLocaleString() : value }}
      </p>
      <div v-if="trend" class="flex items-center gap-2">
        <span class="inline-flex items-center text-xs font-medium" :class="{
          'text-success': trend === 'up',
          'text-danger': trend === 'down',
          'text-text-muted': trend === 'flat'
        }">
          {{ trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→' }}
          {{ trendValue }}
        </span>
      </div>
      <p v-if="description" class="text-xs text-text-muted">{{ description }}</p>
    </div>
  </div>
</template>