<script setup lang="ts">
import { ref, computed } from 'vue';
import { ChartLine, ChartColumn, GitBranch, ArrowDown } from '@lucide/vue';
import { useDashboardStore } from '../stores/dashboardStore';
import ChartCard from '../../../components/ui/ChartCard.vue';
import CmButton from '../../../components/ui/CmButton.vue';
import EmptyState from '../../../components/ui/EmptyState.vue';
import SkeletonLoader from '../../../components/ui/SkeletonLoader.vue';
import type { TrendRange, TrendData } from '../stores/dashboardStore';

export type ChartMode = 'linear' | 'bar' | 'flow';

interface Props {
  data?: TrendData[];
  loading?: boolean;
  selectedRange?: TrendRange;
  availableRanges?: TrendRange[];
  modelValue?: ChartMode;
}

const props = withDefaults(defineProps<Props>(), {
  data: () => [],
  loading: false,
  selectedRange: '7D',
  availableRanges: () => ['7D', '30D', '3M', '6M', '1Y'] as TrendRange[],
  modelValue: 'linear',
});

const emit = defineEmits<{
  (e: 'update:selectedRange', value: TrendRange): void;
  (e: 'update:modelValue', value: ChartMode): void;
}>();

const rangeLabels: Record<TrendRange, string> = {
  '7D': '7D',
  '30D': '30D',
  '3M': '3M',
  '6M': '6M',
  '1Y': '1Y',
};

const chartModes: { value: ChartMode; label: string; icon: any; ariaLabel: string }[] = [
  { value: 'linear', label: 'Linear', icon: ChartLine, ariaLabel: 'Show fee collection as a linear chart' },
  { value: 'bar', label: 'Bar', icon: ChartColumn, ariaLabel: 'Show fee collection as a bar chart' },
  { value: 'flow', label: 'Flow', icon: GitBranch, ariaLabel: 'Show fee collection as a flow chart' },
];

const internalMode = ref<ChartMode>(props.modelValue);
const chartMode = computed({
  get: () => internalMode.value,
  set: (v: ChartMode) => {
    internalMode.value = v;
    emit('update:modelValue', v);
  },
});

const dashboardStore = useDashboardStore();

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

// Flow data — uses canonical financial store values (single source of truth)
const flowAssessed = computed(() => dashboardStore.totalCharges);
const flowCollected = computed(() => dashboardStore.totalPayments);
const flowOutstanding = computed(() => dashboardStore.netBalance);
const flowRate = computed(() => dashboardStore.collectionRate);
</script>

<template>
  <ChartCard title="Fee Collection Overview" description="Payments received over time">
    <div class="flex flex-col h-full">
      <!-- Controls: chart mode + range selector -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <!-- Chart mode toggle — Lucide icons, accessible -->
        <div
          class="inline-flex rounded-lg border border-divider bg-surface p-1 gap-1"
          role="group"
          aria-label="Chart visualization mode"
          data-testid="chart-mode-toggle"
        >
          <button
            v-for="mode in chartModes"
            :key="mode.value"
            :data-testid="`chart-mode-${mode.value}`"
            :aria-label="mode.ariaLabel"
            :aria-pressed="chartMode === mode.value"
            :class="[
              'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/50',
              chartMode === mode.value
                ? 'bg-brand text-white shadow-sm'
                : 'text-text-muted hover:bg-card hover:text-text-primary'
            ]"
            @click="chartMode = mode.value"
          >
            <component :is="mode.icon" class="h-3.5 w-3.5" :stroke-width="2" />
            {{ mode.label }}
          </button>
        </div>

        <!-- Date range selector -->
        <div class="flex items-center gap-1">
          <CmButton
            v-for="range in availableRanges"
            :key="range"
            :data-testid="`trend-range-${range}`"
            @click="emit('update:selectedRange', range)"
            variant="link"
            class="px-3 py-1.5 text-xs font-medium rounded-lg focus-ring"
            :class="selectedRange === range ? 'bg-brand/15 text-brand' : 'text-text-muted hover:bg-surface'"
          >
            {{ rangeLabels[range] }}
          </CmButton>
        </div>
      </div>

      <!-- Loading skeleton -->
      <div v-if="loading" class="space-y-3">
        <SkeletonLoader type="chart" />
      </div>

      <!-- Empty state — shared -->
      <div v-else-if="chartData.length === 0 && chartMode !== 'flow'" class="py-8">
        <EmptyState
          title="No payment history yet"
          description="Payments received will appear here once they are recorded."
          icon="M12 6v6l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </div>

      <!-- LINEAR -->
      <div v-else-if="chartMode === 'linear'" class="relative w-full h-[160px] sm:h-[200px]" data-testid="chart-linear">
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
            fill="url(#chartGradientLinear)"
            fill-opacity="0.15"
          />
          <defs>
            <linearGradient id="chartGradientLinear" x1="0" y1="0" x2="0" y2="1">
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
          </g>

          <!-- X-axis labels -->
          <g class="text-text-muted" font-size="10" text-anchor="middle">
            <text
              v-for="(d, i) in chartData"
              :key="d.date"
              :x="point(i).x"
              :y="padding.top + chartH + 16"
            >
              <template v-if="shouldShowLabel(i)">{{ d.date }}</template>
            </text>
          </g>
        </svg>
      </div>

      <!-- BAR -->
      <div v-else-if="chartMode === 'bar'" class="relative w-full h-[160px] sm:h-[200px]" data-testid="chart-bar">
        <svg
          class="w-full h-full"
          :viewBox="`0 0 ${chartWidth} ${chartHeight}`"
          preserveAspectRatio="none"
        >
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
          <!-- Bars — same data as linear -->
          <g>
            <rect
              v-for="(d, i) in chartData"
              :key="i"
              :x="point(i).x - Math.min(18, chartW / chartData.length / 2.5)"
              :y="padding.top + chartH - (d.total / maxValue) * chartH"
              :width="Math.min(32, chartW / chartData.length * 0.6)"
              :height="(d.total / maxValue) * chartH"
              rx="3"
              :fill="hoverIndex === i ? 'var(--color-brand)' : 'var(--color-brand)'"
              :fill-opacity="hoverIndex === i ? 0.95 : 0.75"
              class="transition-all cursor-pointer"
              @mouseenter="hoverIndex = i"
              @mouseleave="hoverIndex = null"
            />
          </g>
          <!-- Tooltip for bar -->
          <g v-if="hoverIndex !== null" font-size="10" pointer-events="none">
            <rect
              :x="point(hoverIndex!).x - 30"
              :y="padding.top + chartH - (chartData[hoverIndex!].total / maxValue) * chartH - 42"
              width="60"
              height="32"
              rx="6"
              fill="var(--color-card)"
              stroke="var(--color-border)"
              stroke-width="1"
            />
            <text
              :x="point(hoverIndex!).x"
              :y="padding.top + chartH - (chartData[hoverIndex!].total / maxValue) * chartH - 30"
              text-anchor="middle"
              class="text-text-primary"
              font-weight="600"
            >
              {{ formatCurrency(chartData[hoverIndex!].total) }}
            </text>
            <text
              :x="point(hoverIndex!).x"
              :y="padding.top + chartH - (chartData[hoverIndex!].total / maxValue) * chartH - 16"
              text-anchor="middle"
              class="text-text-muted"
            >
              {{ chartData[hoverIndex!].count }} payment{{ chartData[hoverIndex!].count !== 1 ? 's' : '' }}
            </text>
          </g>
          <g class="text-text-muted" font-size="10" text-anchor="middle">
            <text
              v-for="(d, i) in chartData"
              :key="d.date"
              :x="point(i).x"
              :y="padding.top + chartH + 16"
            >
              <template v-if="shouldShowLabel(i)">{{ d.date }}</template>
            </text>
          </g>
        </svg>
      </div>

      <!-- FLOW — financial pipeline, uses actual store values -->
      <div v-else-if="chartMode === 'flow'" class="py-2" data-testid="chart-flow">
        <div class="grid grid-cols-1 gap-2">
          <!-- Assessed -->
          <div class="flex flex-col items-stretch">
            <div class="flex items-center justify-between rounded-lg border border-divider bg-card px-4 py-3">
              <div>
                <p class="text-xs font-medium text-text-muted uppercase tracking-wide">Fees Assessed</p>
                <p class="text-lg font-bold font-mono text-text-primary" data-testid="flow-assessed">{{ formatCurrency(flowAssessed) }}</p>
              </div>
              <div class="text-right">
                <p class="text-xs text-text-muted">100%</p>
                <div class="mt-1 h-1.5 w-24 rounded-full bg-divider overflow-hidden">
                  <div class="h-full bg-brand rounded-full" style="width: 100%"></div>
                </div>
              </div>
            </div>
            <div class="flex justify-center py-1">
              <ArrowDown class="h-4 w-4 text-text-muted" :stroke-width="2" aria-hidden="true" />
            </div>
            <!-- Collected -->
            <div class="flex items-center justify-between rounded-lg border border-success/20 bg-success/5 px-4 py-3">
              <div>
                <p class="text-xs font-medium text-text-muted uppercase tracking-wide">Collected</p>
                <p class="text-lg font-bold font-mono text-success" data-testid="flow-collected">{{ formatCurrency(flowCollected) }}</p>
                <p class="text-xs text-text-muted">Payments Received</p>
              </div>
              <div class="text-right">
                <p class="text-xs font-semibold text-success" data-testid="flow-rate">{{ flowRate.toFixed(1) }}%</p>
                <div class="mt-1 h-1.5 w-24 rounded-full bg-divider overflow-hidden">
                  <div class="h-full bg-success rounded-full" :style="{ width: `${Math.min(flowRate, 100)}%` }"></div>
                </div>
              </div>
            </div>
            <div class="flex justify-center py-1">
              <ArrowDown class="h-4 w-4 text-text-muted" :stroke-width="2" aria-hidden="true" />
            </div>
            <!-- Outstanding -->
            <div class="flex items-center justify-between rounded-lg border border-warning/20 bg-warning/5 px-4 py-3">
              <div>
                <p class="text-xs font-medium text-text-muted uppercase tracking-wide">Outstanding</p>
                <p class="text-lg font-bold font-mono text-warning" data-testid="flow-outstanding">{{ formatCurrency(flowOutstanding) }}</p>
              </div>
              <div class="text-right">
                <p class="text-xs font-semibold text-warning">{{ (100 - flowRate).toFixed(1) }}%</p>
                <div class="mt-1 h-1.5 w-24 rounded-full bg-divider overflow-hidden">
                  <div class="h-full bg-warning rounded-full" :style="{ width: `${Math.max(0, 100 - flowRate)}%` }"></div>
                </div>
              </div>
            </div>
          </div>
          <p class="text-xs text-text-muted text-center mt-2">
            Assessed ₦{{ flowAssessed.toLocaleString() }} = Collected ₦{{ flowCollected.toLocaleString() }} + Outstanding ₦{{ flowOutstanding.toLocaleString() }}
          </p>
        </div>
      </div>

      <!-- Period summary — unchanged, shared across modes (except flow adds pipeline context) -->
      <div class="flex items-center justify-between pt-4 border-t border-divider mt-4">
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
