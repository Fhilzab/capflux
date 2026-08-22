<script setup lang="ts">
import { ref, computed } from 'vue';
import ChartCard from '../../../components/ui/ChartCard.vue';
import CmButton from '../../../components/ui/CmButton.vue';
import EmptyState from '../../../components/ui/EmptyState.vue';
import SkeletonLoader from '../../../components/ui/SkeletonLoader.vue';
import type { TrendRange, TrendData } from '../stores/dashboardStore';

interface Props {
  data?: TrendData[];
  loading?: boolean;
  selectedRange?: TrendRange;
  availableRanges?: TrendRange[];
}

const props = withDefaults(defineProps<Props>(), {
  data: () => [],
  loading: false,
  selectedRange: '7D',
  availableRanges: () => ['7D', '30D', '3M', '6M', '1Y'] as TrendRange[],
});

const emit = defineEmits<{
  (e: 'update:selectedRange', value: TrendRange): void;
}>();

const rangeLabels: Record<TrendRange, string> = {
  '7D': '7D',
  '30D': '30D',
  '3M': '3M',
  '6M': '6M',
  '1Y': '1Y',
};

const chartData = computed(() => props.data || []);
const maxValue = computed(() => Math.max(...chartData.value.map((d) => d.total), 1));

// Responsive chart geometry
const chartHeight = 180;
const chartWidth = 800;
const padding = { top: 16, right: 16, bottom: 34, left: 52 };

const chartW = computed(() => chartWidth - padding.left - padding.right);
const chartH = computed(() => chartHeight - padding.top - padding.bottom);

const point = (i: number): { x: number; y: number } => {
  const x = padding.left + (i / Math.max(chartData.value.length - 1, 1)) * chartW.value;
  const y = padding.top + chartH.value - (chartData.value[i].total / maxValue.value) * chartH.value;
  return { x, y };
};

// Hover tooltip
const hoverIndex = ref<number | null>(null);

const formatCurrency = (n: number) => `₦${n.toLocaleString()}`;

const formatTick = (n: number) => {
  if (n >= 1000) return `₦${(n / 1000).toFixed(0)}k`;
  return `₦${n}`;
};

const yAxisTicks = computed(() => {
  const max = maxValue.value;
  const ticks: number[] = [];
  const step = max / 4;
  for (let i = 0; i <= 4; i++) {
    ticks.push(Math.round((step * i)));
  }
  return ticks;
});

// Period summary
const periodTotal = computed(() =>
  chartData.value.reduce((sum, d) => sum + d.total, 0)
);
const periodCount = computed(() =>
  chartData.value.reduce((sum, d) => sum + d.count, 0)
);

// Label skipping to prevent overlap on narrow screens
const labelInterval = computed(() => {
  const n = chartData.value.length;
  if (n <= 8) return 1;
  if (n <= 16) return 2;
  return 3;
});
const shouldShowLabel = (i: number): boolean => i % labelInterval.value === 0;
</script>

<template>
  <ChartCard title="Fee Collection Overview" description="Payments received over time">
    <div class="flex flex-col h-full">
      <!-- Date range selector -->
      <div class="flex items-center gap-1 mb-4">
        <CmButton
          v-for="range in availableRanges"
          :key="range"
          @click="emit('update:selectedRange', range)"
          variant="link"
          class="px-3 py-1.5 text-xs font-medium rounded-lg focus-ring"
          :class="selectedRange === range ? 'bg-brand/15 text-brand' : 'text-text-muted hover:bg-surface'"
        >
          {{ rangeLabels[range] }}
        </CmButton>
      </div>

      <!-- Loading skeleton -->
      <div v-if="loading" class="space-y-3">
        <SkeletonLoader type="chart" />
      </div>

      <!-- Empty state -->
      <div v-else-if="chartData.length === 0" class="py-8">
        <EmptyState
          title="No payment history yet"
          description="Payments received will appear here once they are recorded."
          icon="M12 6v6l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </div>

      <!-- Chart -->
      <div v-else class="relative w-full h-[160px] sm:h-[200px]">
        <svg
          class="w-full h-full"
          :viewBox="`0 0 ${chartWidth} ${chartHeight}`"
          preserveAspectRatio="none"
        >
          <!-- Grid lines -->
          <g class="text-divider" stroke-width="1">
            <line
              v-for="tick in yAxisTicks"
              :key="tick"
              :x1="padding.left"
              :y1="padding.top + chartH - (tick / maxValue) * chartH"
              :x2="chartWidth - padding.right"
              :y2="padding.top + chartH - (tick / maxValue) * chartH"
            />
          </g>

          <!-- Y-axis labels -->
          <g class="text-text-muted" font-size="10" text-anchor="end">
            <text
              v-for="tick in yAxisTicks"
              :key="tick"
              :x="padding.left - 8"
              :y="padding.top + chartH - (tick / maxValue) * chartH + 3"
            >
              {{ formatTick(tick) }}
            </text>
          </g>

          <!-- Area under line -->
          <path
            :d="`
              M${padding.left} ${padding.top + chartH}
              ${chartData.map((d, i) => {
                const { x, y } = point(i);
                return `L${x} ${y}`;
              }).join(' ')}
              L${padding.left + chartW} ${padding.top + chartH} Z
            `"
            fill="url(#chartGradient)"
            fill-opacity="0.15"
          />
          <defs>
            <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="var(--color-brand)" stop-opacity="0.25" />
              <stop offset="100%" stop-color="var(--color-brand)" stop-opacity="0" />
            </linearGradient>
          </defs>

          <!-- Line -->
          <polyline
            :points="chartData.map((d, i) => `${point(i).x},${point(i).y}`).join(' ')"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            class="text-brand"
          />

          <!-- Data points + hover -->
          <g>
            <line
              v-if="hoverIndex !== null"
              stroke="currentColor"
              stroke-width="1"
              stroke-dasharray="3,3"
              class="text-text-muted/40"
              :x1="point(hoverIndex!).x"
              :y1="padding.top"
              :x2="point(hoverIndex!).x"
              :y2="padding.top + chartH"
            />
            <circle
              v-for="(d, i) in chartData"
              :key="i"
              :cx="point(i).x"
              :cy="point(i).y"
              :r="hoverIndex === i ? 5 : 3"
              :fill="hoverIndex === i ? 'var(--color-brand)' : 'var(--color-surface)'"
              stroke="currentColor"
              stroke-width="2"
              class="text-brand"
              @mouseenter="hoverIndex = i"
              @mouseleave="hoverIndex = null"
            />
          </g>

          <!-- Tooltip -->
          <g v-if="hoverIndex !== null" font-size="10" pointer-events="none">
            <rect
              :x="point(hoverIndex!).x - 30"
              :y="point(hoverIndex!).y - 42"
              width="60"
              height="32"
              rx="6"
              fill="var(--color-card)"
              stroke="var(--color-border)"
              stroke-width="1"
            />
            <text
              :x="point(hoverIndex!).x"
              :y="point(hoverIndex!).y - 30"
              text-anchor="middle"
              class="text-text-primary"
              font-weight="600"
            >
              {{ formatCurrency(chartData[hoverIndex!].total) }}
            </text>
            <text
              :x="point(hoverIndex!).x"
              :y="point(hoverIndex!).y - 16"
              text-anchor="middle"
              class="text-text-muted"
            >
              {{ chartData[hoverIndex!].count }} payment{{ chartData[hoverIndex!].count !== 1 ? 's' : '' }}
            </text>
            <text
              :x="point(hoverIndex!).x"
              :y="point(hoverIndex!).y - 2"
              text-anchor="middle"
              class="text-text-muted"
            >
              {{ chartData[hoverIndex!].date }}
            </text>
          </g>

          <!-- X-axis labels -->
          <g class="text-text-muted" font-size="10" text-anchor="middle">
            <text
              v-for="(d, i) in chartData"
              :key="d.date"
              v-if="shouldShowLabel(i)"
              :x="point(i).x"
              :y="padding.top + chartH + 16"
            >
              {{ d.date }}
            </text>
          </g>
        </svg>
      </div>

      <!-- Period summary -->
      <div class="flex items-center justify-between pt-4 border-t border-divider mt-auto">
        <span class="text-xs text-text-muted">
          Period total • {{ periodCount }} payments
        </span>
        <span class="text-lg font-semibold font-mono text-text-primary">
          {{ formatCurrency(periodTotal) }}
        </span>
      </div>
    </div>
  </ChartCard>
</template>
