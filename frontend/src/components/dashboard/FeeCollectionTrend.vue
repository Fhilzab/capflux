<script setup lang="ts">
import { ref, computed } from 'vue';
import ChartCard from '../ui/ChartCard.vue';

interface Props {
  data?: Array<{ date: string; total: number; count: number }>;
  loading?: boolean;
}

const props = defineProps<Props>();

const timeRange = ref<'daily' | 'weekly' | 'monthly' | 'term' | 'session'>('daily');

const chartData = computed(() => props.data || []);
const maxValue = computed(() => Math.max(...chartData.value.map(d => d.total), 100000));

const chartHeight = 180;
const chartWidth = 400;
const padding = { top: 10, right: 10, bottom: 30, left: 40 };
</script>

<template>
  <ChartCard title="Fee Collection Trend" description="Payments over time">
    <div class="flex flex-col h-full">
      <!-- Time range tabs -->
      <div class="flex items-center gap-1 mb-4">
        <button
          v-for="range in ['daily', 'weekly', 'monthly', 'term', 'session'] as const"
          :key="range"
          @click="timeRange = range"
          class="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors"
          :class="timeRange === range ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-400 hover:bg-slate-800/50'"
        >
          {{ range.charAt(0).toUpperCase() + range.slice(1) }}
        </button>
      </div>
      
      <!-- SVG Chart -->
      <div class="relative flex-1">
        <svg :viewBox="`0 0 ${chartWidth} ${chartHeight}`" class="w-full h-full">
          <!-- Grid lines -->
          <g stroke="currentColor" stroke-opacity="0.05">
            <line v-for="i in 4" :key="i" :x1="0" :y1="i * 45" :x2="chartWidth" :y2="i * 45" class="text-slate-600" />
          </g>
          
          <!-- Area gradient -->
          <defs>
            <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="currentColor" stop-opacity="0.25" class="text-cyan-400" />
              <stop offset="100%" stop-color="currentColor" stop-opacity="0" class="text-cyan-400" />
            </linearGradient>
          </defs>
          
          <!-- Chart area -->
          <path
            v-if="chartData.length > 1"
            :d="`M${padding.left} ${chartHeight - padding.bottom} ${chartData.map((d, i) => {
              const x = padding.left + (i / (chartData.length - 1)) * (chartWidth - padding.left - padding.right);
              const y = chartHeight - padding.bottom - (d.total / maxValue) * (chartHeight - padding.top - padding.bottom);
              return `L${x} ${y}`;
            }).join(' ')} L${chartWidth - padding.right} ${chartHeight - padding.bottom} Z`"
            fill="url(#trendGradient)"
          />
          
          <!-- Chart line -->
          <polyline
            v-if="chartData.length > 1"
            :points="chartData.map((d, i) => 
              `${padding.left + (i / (chartData.length - 1)) * (chartWidth - padding.left - padding.right)},${chartHeight - padding.bottom - (d.total / maxValue) * (chartHeight - padding.top - padding.bottom)}`
            ).join(' ')"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            class="text-cyan-400"
          />
          
          <!-- Data points -->
          <g v-for="(point, i) in chartData" :key="i">
            <circle
              :cx="padding.left + (i / (chartData.length - 1)) * (chartWidth - padding.left - padding.right)"
              :cy="chartHeight - padding.bottom - (point.total / maxValue) * (chartHeight - padding.top - padding.bottom)"
              r="4"
              class="text-cyan-400 fill-slate-900 stroke-cyan-400"
              stroke-width="2"
            />
          </g>
        </svg>
        
        <!-- Empty state for chart -->
        <div v-if="chartData.length === 0" class="absolute inset-0 flex items-center justify-center">
          <span class="text-xs text-slate-500">No data available</span>
        </div>
      </div>
    </div>
  </ChartCard>
</template>