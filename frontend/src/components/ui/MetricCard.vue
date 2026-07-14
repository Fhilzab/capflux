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
  default: 'text-white',
  success: 'text-emerald-400',
  warning: 'text-amber-400',
  error: 'text-rose-400',
  info: 'text-cyan-400',
  ai: 'text-violet-400',
};

const variantBg = {
  default: 'bg-slate-800/50',
  success: 'bg-emerald-500/10',
  warning: 'bg-amber-500/10',
  error: 'bg-rose-500/10',
  info: 'bg-cyan-500/10',
  ai: 'bg-violet-500/10',
};
</script>

<template>
  <div class="premium-card p-6 transition-all duration-300 hover:shadow-2xl hover:-translate-y-1">
    <div class="flex items-start justify-between mb-4">
      <p class="text-label">{{ label }}</p>
      <div v-if="icon" class="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700/50" :class="variantBg[variant || 'default']">
        <svg class="h-4.5 w-4.5" :class="variantClasses[variant || 'default']" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" :d="icon" />
        </svg>
      </div>
    </div>
    <div class="space-y-1.5">
      <p class="text-metric" :class="variantClasses[variant || 'default']">
        {{ currency ? '₦' : '' }}{{ typeof value === 'number' ? value.toLocaleString() : value }}
      </p>
      <div v-if="trend" class="flex items-center gap-2">
        <span class="inline-flex items-center text-xs font-medium" :class="{
          'text-emerald-400': trend === 'up',
          'text-rose-400': trend === 'down',
          'text-slate-400': trend === 'flat'
        }">
          {{ trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→' }}
          {{ trendValue }}
        </span>
      </div>
      <p v-if="description" class="text-xs text-slate-500">{{ description }}</p>
    </div>
  </div>
</template>