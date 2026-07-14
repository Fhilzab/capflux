<script setup lang="ts">
interface Props {
  trend: 'up' | 'down' | 'flat';
  value?: string;
  sparkline?: number[];
}

defineProps<Props>();
</script>

<template>
  <div class="flex items-center gap-2">
    <span class="inline-flex items-center text-xs font-medium" :class="{
      'text-emerald-400': trend === 'up',
      'text-rose-400': trend === 'down',
      'text-slate-400': trend === 'flat'
    }">
      {{ trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→' }}
      <span v-if="value">{{ value }}</span>
    </span>
    
    <!-- Mini sparkline -->
    <svg v-if="sparkline && sparkline.length > 0" class="h-4 w-8" viewBox="0 0 32 16" fill="none">
      <path
        :d="`M0 ${16 - (sparkline[0] / Math.max(...sparkline, 1)) * 12} ${sparkline.map((v, i) => `L${i * (32 / (sparkline.length - 1))} ${16 - (v / Math.max(...sparkline, 1)) * 12}`).join(' ')}`"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        :class="{
          'text-emerald-400': trend === 'up',
          'text-rose-400': trend === 'down',
          'text-slate-400': trend === 'flat'
        }"
      />
    </svg>
  </div>
</template>