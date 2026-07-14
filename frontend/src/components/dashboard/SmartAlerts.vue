<script setup lang="ts">
import { computed } from 'vue';

interface Alert {
  id: string;
  type: 'high' | 'medium' | 'low';
  title: string;
  message: string;
  timestamp?: string;
}

interface Props {
  alerts?: Alert[];
  loading?: boolean;
}

defineProps<Props>();
</script>

<template>
  <section>
    <div class="mb-4 flex items-center gap-2">
      <h2 class="text-headline">Smart Alerts</h2>
      <span class="rounded-full bg-rose-500/10 px-2.5 py-1 text-xs font-medium text-rose-400">Priority</span>
    </div>

    <div v-if="!alerts || alerts.length === 0" class="premium-card p-6">
      <p class="text-sm text-slate-400">No high-priority alerts at this time.</p>
    </div>

    <div v-else class="space-y-3 max-h-64 overflow-y-auto">
      <div 
        v-for="alert in alerts" 
        :key="alert.id"
        class="premium-card--glow flex items-start gap-3 p-4 border-l-2"
        :class="{
          'border-rose-500/50 bg-rose-500/5': alert.type === 'high',
          'border-amber-500/50 bg-amber-500/5': alert.type === 'medium',
          'border-cyan-500/50 bg-cyan-500/5': alert.type === 'low'
        }"
      >
        <div class="flex h-8 w-8 items-center justify-center rounded-xl" :class="{
          'bg-rose-500/10': alert.type === 'high',
          'bg-amber-500/10': alert.type === 'medium',
          'bg-cyan-500/10': alert.type === 'low'
        }">
          <svg class="h-4 w-4" :class="{
            'text-rose-400': alert.type === 'high',
            'text-amber-400': alert.type === 'medium',
            'text-cyan-400': alert.type === 'low'
          }" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m0 3.75h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div class="flex-1">
          <p class="text-sm font-semibold text-white">{{ alert.title }}</p>
          <p class="text-xs text-slate-400 mt-1">{{ alert.message }}</p>
        </div>
      </div>
    </div>
  </section>
</template>