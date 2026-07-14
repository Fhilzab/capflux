<script setup lang="ts">
import { computed } from 'vue';
import { computedAsync } from '@vueuse/core';

interface Insight {
  id: string;
  type: 'positive' | 'negative' | 'warning' | 'info';
  message: string;
  confidence?: number;
  timestamp?: string;
}

interface Props {
  insights?: Insight[];
  loading?: boolean;
}

const props = defineProps<Props>();

const insightStyles = {
  positive: { bg: 'bg-emerald-500/5', border: 'border-emerald-500/20', icon: 'text-emerald-400' },
  negative: { bg: 'bg-rose-500/5', border: 'border-rose-500/20', icon: 'text-rose-400' },
  warning: { bg: 'bg-amber-500/5', border: 'border-amber-500/20', icon: 'text-amber-400' },
  info: { bg: 'bg-cyan-500/5', border: 'border-cyan-500/20', icon: 'text-cyan-400' },
};
</script>

<template>
  <section>
    <div class="mb-4 flex items-center gap-2">
      <h2 class="text-headline">AI Insights</h2>
      <span class="rounded-full bg-violet-500/10 px-2.5 py-1 text-xs font-medium text-violet-400">Live</span>
    </div>

    <div v-if="loading" class="space-y-3">
      <div v-for="i in 3" :key="i" class="skeleton h-20 rounded-2xl"></div>
    </div>

    <div v-else-if="!insights || insights.length === 0" class="premium-card--glow p-6">
      <div class="flex items-center gap-3 mb-3">
        <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10 text-violet-400">
          <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9.663 17h4.673M12 3v1m0 16v1m-6-6h2m2-12h.01M5.64 5.64l.66.66m12.02-.66l-.66.66M7.64 7.64l.66.66m12.02-.66l-.66.66M12 21a9 9 0 110-18 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <h3 class="text-sm font-semibold text-white">Analyzing data...</h3>
          <p class="text-xs text-slate-500">AI insights will appear once enough data is available</p>
        </div>
      </div>
    </div>

    <div v-else class="space-y-3 max-h-64 overflow-y-auto pr-2">
      <div 
        v-for="insight in insights" 
        :key="insight.id"
        class="premium-card--glow p-4 border-l-2"
        :class="[insightStyles[insight.type].border, insightStyles[insight.type].bg]"
      >
        <div class="flex items-start gap-3">
          <div class="flex h-8 w-8 items-center justify-center rounded-xl" :class="insightStyles[insight.type].bg">
            <svg class="h-4 w-4" :class="insightStyles[insight.type].icon" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
              <path v-if="insight.type === 'positive'" stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9" />
              <path v-else-if="insight.type === 'negative'" stroke-linecap="round" stroke-linejoin="round" d="M9 12a3 3 0 116 0c0 1.657-1.343 3-3 3s-3-1.343-3-3z" />
              <path v-else-if="insight.type === 'warning'" stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m0 3.75h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              <path v-else stroke-linecap="round" stroke-linejoin="round" d="M9.663 17h4.673M12 3v1m0 16v1m-6-6h2m2-12h.01M5.64 5.64l.66.66m12.02-.66l-.66.66M7.64 7.64l.66.66m12.02-.66l-.66.66M12 21a9 9 0 110-18 9 9 0 0118 0z" />
            </svg>
          </div>
          <div class="flex-1">
            <p class="text-sm text-white">{{ insight.message }}</p>
            <div v-if="insight.confidence" class="mt-2 flex items-center gap-2">
              <div class="h-1 w-16 rounded-full bg-slate-800 overflow-hidden">
                <div class="h-full bg-violet-400 rounded-full" :style="{ width: `${insight.confidence}%` }"></div>
              </div>
              <span class="text-xs text-slate-500">{{ insight.confidence }}% confidence</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>