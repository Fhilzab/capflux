<script setup lang="ts">
import { computed, ref } from 'vue';
import { useDashboardStore } from '../stores/dashboardStore';
import ChartCard from '../../../components/ui/ChartCard.vue';
import CmButton from '../../../components/ui/CmButton.vue';
import EmptyState from '../../../components/ui/EmptyState.vue';
import SkeletonLoader from '../../../components/ui/SkeletonLoader.vue';
import type { TrendRange, CompoundPoint } from '../stores/dashboardStore';

interface Props {
  data?: CompoundPoint[];
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

const dashboardStore = useDashboardStore();

const series = computed<CompoundPoint[]>(() => props.data || []);

// ---------------------------------------------------------------------------
// Chart geometry — viewBox is constant; CSS scales responsively (no overflow
// at any of the supported viewports). Left axis = ₦ (bars), right = % (line).
// ---------------------------------------------------------------------------
const chartWidth = 800;
const chartHeight = 240;
const padding = { top: 16, right: 48, bottom: 32, left: 56 };
const chartW = chartWidth - padding.left - padding.right;
const chartH = chartHeight - padding.top - padding.bottom;

// ---- Money (left axis) ----
const maxMoney = computed(() =>
  Math.max(1, ...series.value.flatMap((d) => [d.expected, d.collected, d.outstanding])),
);

function niceCeil(v: number): number {
  if (v <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(v));
  const m = v / pow;
  const nice = m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10;
  return nice * pow;
}

const moneyMax = computed(() => niceCeil(maxMoney.value));

const moneyTicks = computed(() => {
  const ticks: number[] = [];
  for (let i = 0; i <= 4; i += 1) ticks.push(Math.round((moneyMax.value * i) / 4));
  return ticks;
});

const yMoney = (v: number): number =>
  padding.top + chartH - (Math.min(v, moneyMax.value) / moneyMax.value) * chartH;

// ---- Reconciliation % (right axis) ----
const percentMax = 100;
const percentTicks = [0, 25, 50, 75, 100];
const yPercent = (rate: number): number =>
  padding.top + chartH - (Math.min(rate, percentMax) / percentMax) * chartH;

// ---- Grouped-bar cluster geometry ----
const clusterWidth = computed(() => (series.value.length > 0 ? chartW / series.value.length : 0));
const barW = computed(() => Math.max(3, Math.min(22, clusterWidth.value * 0.16)));
const gap = computed(() => Math.max(1.5, barW.value * 0.4));
const xCenter = (i: number): number => padding.left + (i + 0.5) * clusterWidth.value;

// offsets: expected | collected | outstanding
const barX = (i: number, offset: number): number =>
  xCenter(i) + offset * (barW.value + gap.value) - barW.value / 2;

const linePoints = computed(() =>
  series.value.map((d, i) => `${xCenter(i)},${yPercent(d.reconciliationRate)}`).join(' '),
);

// ---- X labels — skip to prevent overlap on narrow screens ----
const labelInterval = computed(() => {
  const n = series.value.length;
  if (n <= 8) return 1;
  if (n <= 16) return 2;
  return 3;
});
const shouldShowLabel = (i: number): boolean => i % labelInterval.value === 0;

// ---- Formatting ----
const formatCurrency = (n: number) => `₦${Math.round(n).toLocaleString()}`;
const formatTick = (n: number) => {
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `₦${Math.round(n / 1_000)}k`;
  return `₦${n}`;
};
const formatRate = (n: number) => `${n.toFixed(1)}%`;

// ---- Source-of-truth period totals (canonical store values) ----
const flowAssessed = computed(() => dashboardStore.totalCharges);
const flowCollected = computed(() => dashboardStore.totalPayments);
const flowOutstanding = computed(() => dashboardStore.netBalance);
const flowRate = computed(() => dashboardStore.collectionRate);

const lastPeriodLabel = computed(() =>
  series.value.length > 0 ? series.value[series.value.length - 1].date : '',
);

const isEmpty = computed(() => series.value.length === 0 || maxMoney.value <= 0);

// ---- Hover / tooltip / keyboard ----
const hoverIndex = ref<number | null>(null);
const tooltip = computed(() =>
  hoverIndex.value === null ? null : series.value[hoverIndex.value],
);
const tooltipLeftPct = computed(() => {
  if (hoverIndex.value === null) return 50;
  const cx = xCenter(hoverIndex.value);
  return Math.max(12, Math.min(88, (cx / chartWidth) * 100));
});
const tooltipTopPct = computed(() => {
  if (hoverIndex.value === null) return 0;
  const d = series.value[hoverIndex.value];
  const topY = Math.min(yMoney(d.expected), yMoney(d.collected), yMoney(d.outstanding));
  return Math.max(4, (topY / chartHeight) * 100);
});

const barOpacityClass = (i: number): string =>
  hoverIndex.value === null || hoverIndex.value === i ? 'compound-bar--active' : 'compound-bar--dim';

const clusterEls = ref<SVGElement[]>([]);
const setClusterEl = (el: SVGElement | null, i: number): void => {
  if (el) clusterEls.value[i] = el;
};
const onClusterKeydown = (i: number, event: KeyboardEvent): void => {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
  event.preventDefault();
  const next =
    event.key === 'ArrowRight'
      ? Math.min(series.value.length - 1, i + 1)
      : Math.max(0, i - 1);
  hoverIndex.value = next;
  clusterEls.value[next]?.focus();
};

const clusterAriaLabel = (d: CompoundPoint): string =>
  `${d.date}: expected ${formatCurrency(d.expected)}, collected ${formatCurrency(d.collected)}, ` +
  `outstanding ${formatCurrency(d.outstanding)}, reconciliation ${formatRate(d.reconciliationRate)}`;

const chartAriaLabel = computed(() =>
  `Fee collection overview${lastPeriodLabel.value ? ` as of ${lastPeriodLabel.value}` : ''}. ` +
  `Expected ${formatCurrency(flowAssessed.value)}, collected ${formatCurrency(flowCollected.value)}, ` +
  `outstanding ${formatCurrency(flowOutstanding.value)}, reconciliation ${formatRate(flowRate.value)}.`,
);
</script>

<template>
  <ChartCard
    title="Fee Collection Overview"
    description="Expected vs collected vs outstanding with reconciliation trend — as-of period totals"
  >
    <div class="flex flex-col h-full">
      <!-- Controls: legend (series) + range selector -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <ul
          role="list"
          aria-label="Chart series legend"
          class="flex flex-wrap items-center gap-x-4 gap-y-1.5"
        >
          <li class="inline-flex items-center gap-1.5" data-testid="compound-legend-expected">
            <span class="h-2.5 w-2.5 rounded-[2px]" :style="{ backgroundColor: 'var(--color-info)' }" aria-hidden="true"></span>
            <span class="text-xs font-medium text-text-secondary">Expected</span>
          </li>
          <li class="inline-flex items-center gap-1.5" data-testid="compound-legend-collected">
            <span class="h-2.5 w-2.5 rounded-[2px]" :style="{ backgroundColor: 'var(--color-success)' }" aria-hidden="true"></span>
            <span class="text-xs font-medium text-text-secondary">Collected</span>
          </li>
          <li class="inline-flex items-center gap-1.5" data-testid="compound-legend-outstanding">
            <span class="h-2.5 w-2.5 rounded-[2px]" :style="{ backgroundColor: 'var(--color-warning)' }" aria-hidden="true"></span>
            <span class="text-xs font-medium text-text-secondary">Outstanding</span>
          </li>
          <li class="inline-flex items-center gap-1.5" data-testid="compound-legend-reconciliation">
            <span class="block w-3.5 border-t-2 border-dashed" :style="{ borderColor: 'var(--color-brand)' }" aria-hidden="true"></span>
            <span class="text-xs font-medium text-text-secondary">Reconciliation</span>
          </li>
        </ul>

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

      <!-- Empty state -->
      <div v-else-if="isEmpty" class="py-6">
        <EmptyState
          title="No fee activity yet"
          description="Assessed fees and payments received will appear here once they are recorded."
          icon="M12 6v6l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </div>

      <!-- Compound financial chart -->
      <div
        v-else
        class="relative w-full h-[200px] sm:h-[240px]"
        role="group"
        :aria-label="chartAriaLabel"
        data-testid="compound-chart"
      >
        <svg
          class="w-full h-full"
          :viewBox="`0 0 ${chartWidth} ${chartHeight}`"
          preserveAspectRatio="none"
        >
          <defs>
            <pattern id="outstandingStripe" patternUnits="userSpaceOnUse" width="7" height="7" patternTransform="rotate(45)">
              <rect width="7" height="7" fill="var(--color-warning)" />
              <line x1="0" y1="0" x2="0" y2="7" stroke="var(--color-background)" stroke-width="2" />
            </pattern>
          </defs>

          <!-- Money grid + % guide lines -->
          <g class="text-divider" stroke-width="1">
            <line
              v-for="tick in moneyTicks"
              :key="`m${tick}`"
              :x1="padding.left"
              :y1="yMoney(tick)"
              :x2="chartWidth - padding.right"
              :y2="yMoney(tick)"
            />
          </g>
          <g class="text-divider" stroke-width="1" stroke-dasharray="3,4" stroke-opacity="0.6">
            <line
              v-for="tick in [25, 50]"
              :key="`p${tick}`"
              :x1="padding.left"
              :y1="yPercent(tick)"
              :x2="chartWidth - padding.right"
              :y2="yPercent(tick)"
            />
          </g>

          <!-- Left axis (₦) -->
          <g class="text-text-muted" font-size="10" text-anchor="end">
            <text
              v-for="tick in moneyTicks"
              :key="`ml${tick}`"
              :x="padding.left - 8"
              :y="yMoney(tick) + 3"
            >
              {{ formatTick(tick) }}
            </text>
          </g>

          <!-- Right axis (%) -->
          <g class="text-text-muted" font-size="10" text-anchor="start">
            <text
              v-for="tick in percentTicks"
              :key="`pl${tick}`"
              :x="chartWidth - padding.right + 10"
              :y="yPercent(tick) + 3"
            >
              {{ tick }}%
            </text>
          </g>

          <!-- Reconciliation trend line -->
          <g>
            <polyline
              :points="linePoints"
              fill="none"
              stroke="var(--color-brand)"
              stroke-width="2.5"
              class="compound-line"
              data-testid="compound-line"
            />
            <circle
              v-for="(d, i) in series"
              :key="`dot${i}`"
              :cx="xCenter(i)"
              :cy="yPercent(d.reconciliationRate)"
              r="3.5"
              fill="var(--color-surface)"
              stroke="var(--color-brand)"
              stroke-width="2.5"
              class="compound-dot"
              :class="hoverIndex !== null && hoverIndex !== i ? 'compound-bar--dim' : 'compound-bar--active'"
            />
          </g>

          <!-- Grouped bars: expected | collected | outstanding -->
          <g>
            <g
              v-for="(d, i) in series"
              :key="`bars${i}-${d.date}`"
              :data-testid="`compound-cluster-${i}`"
            >
              <rect
                v-if="d.expected > 0"
                :data-testid="`compound-bar-expected-${i}`"
                :x="barX(i, -1)"
                :y="yMoney(d.expected)"
                :width="barW"
                :height="Math.max(0, padding.top + chartH - yMoney(d.expected))"
                rx="2"
                fill="var(--color-info)"
                :class="['compound-bar', barOpacityClass(i)]"
                :style="{ '--i': Math.min(i, 8) }"
              />
              <rect
                v-if="d.collected > 0"
                :data-testid="`compound-bar-collected-${i}`"
                :x="barX(i, 0)"
                :y="yMoney(d.collected)"
                :width="barW"
                :height="Math.max(0, padding.top + chartH - yMoney(d.collected))"
                rx="2"
                fill="var(--color-success)"
                :class="['compound-bar', barOpacityClass(i)]"
                :style="{ '--i': Math.min(i, 8) }"
              />
              <rect
                v-if="d.outstanding > 0"
                :data-testid="`compound-bar-outstanding-${i}`"
                :x="barX(i, 1)"
                :y="yMoney(d.outstanding)"
                :width="barW"
                :height="Math.max(0, padding.top + chartH - yMoney(d.outstanding))"
                rx="2"
                fill="url(#outstandingStripe)"
                :class="['compound-bar', barOpacityClass(i)]"
                :style="{ '--i': Math.min(i, 8) }"
              />
            </g>
          </g>

          <!-- X-axis labels -->
          <g class="text-text-muted" font-size="10" text-anchor="middle">
            <text
              v-for="(d, i) in series"
              :key="`x${i}-${d.date}`"
              :x="xCenter(i)"
              :y="padding.top + chartH + 18"
            >
              <template v-if="shouldShowLabel(i)">{{ d.date }}</template>
            </text>
          </g>

          <!-- Interactive hit areas (mouse + keyboard) -->
          <g>
            <rect
              v-for="(d, i) in series"
              :key="`hit${i}`"
              :data-testid="`compound-cluster-hit-${i}`"
              :x="padding.left + i * clusterWidth"
              :y="padding.top"
              :width="clusterWidth"
              :height="chartH"
              fill="transparent"
              tabindex="0"
              role="button"
              :aria-label="clusterAriaLabel(d)"
              :ref="(el: SVGElement | null) => setClusterEl(el, i)"
              @mouseenter="hoverIndex = i"
              @mouseleave="hoverIndex = hoverIndex === i ? null : hoverIndex"
              @focus="hoverIndex = i"
              @blur="hoverIndex = hoverIndex === i ? null : hoverIndex"
              @keydown="onClusterKeydown(i, $event)"
            />
          </g>
        </svg>

        <!-- Consolidated tooltip -->
        <div
          v-if="tooltip"
          class="compound-tooltip"
          :style="{ left: tooltipLeftPct + '%', top: tooltipTopPct + '%' }"
          role="status"
          aria-live="polite"
          data-testid="compound-tooltip"
        >
          <p class="text-xs font-semibold text-text-primary mb-1.5">{{ tooltip.date }}</p>
          <ul class="space-y-1">
            <li class="flex items-center justify-between gap-4">
              <span class="inline-flex items-center gap-1.5 text-text-muted">
                <span class="h-2 w-2 rounded-[2px]" :style="{ backgroundColor: 'var(--color-info)' }" aria-hidden="true"></span>
                Expected
              </span>
              <span class="font-mono font-medium text-text-primary">{{ formatCurrency(tooltip.expected) }}</span>
            </li>
            <li class="flex items-center justify-between gap-4">
              <span class="inline-flex items-center gap-1.5 text-text-muted">
                <span class="h-2 w-2 rounded-[2px]" :style="{ backgroundColor: 'var(--color-success)' }" aria-hidden="true"></span>
                Collected
              </span>
              <span class="font-mono font-medium text-text-primary">{{ formatCurrency(tooltip.collected) }}</span>
            </li>
            <li class="flex items-center justify-between gap-4">
              <span class="inline-flex items-center gap-1.5 text-text-muted">
                <span class="h-2 w-2 rounded-[2px]" :style="{ backgroundColor: 'var(--color-warning)' }" aria-hidden="true"></span>
                Outstanding
              </span>
              <span class="font-mono font-medium text-text-primary">{{ formatCurrency(tooltip.outstanding) }}</span>
            </li>
            <li class="flex items-center justify-between gap-4 border-t border-divider pt-1 mt-1">
              <span class="inline-flex items-center gap-1.5 text-text-muted">
                <span class="block w-3 border-t-2 border-dashed" :style="{ borderColor: 'var(--color-brand)' }" aria-hidden="true"></span>
                Reconciliation
              </span>
              <span class="font-mono font-medium text-text-primary">{{ formatRate(tooltip.reconciliationRate) }}</span>
            </li>
          </ul>
        </div>

        <!-- Screen-reader data summary -->
        <p class="sr-only">{{ chartAriaLabel }}</p>
      </div>

      <!-- Period summary — canonical financial values (single source of truth) -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-divider mt-4">
        <div>
          <p class="text-xs font-medium text-text-muted uppercase tracking-wide">Expected</p>
          <p class="text-sm font-bold font-mono text-text-primary mt-0.5" data-testid="compound-summary-expected">
            {{ formatCurrency(flowAssessed) }}
          </p>
        </div>
        <div>
          <p class="text-xs font-medium text-text-muted uppercase tracking-wide">Collected</p>
          <p class="text-sm font-bold font-mono text-success mt-0.5" data-testid="compound-summary-collected">
            {{ formatCurrency(flowCollected) }}
          </p>
        </div>
        <div>
          <p class="text-xs font-medium text-text-muted uppercase tracking-wide">Outstanding</p>
          <p class="text-sm font-bold font-mono text-warning mt-0.5" data-testid="compound-summary-outstanding">
            {{ formatCurrency(flowOutstanding) }}
          </p>
        </div>
        <div>
          <p class="text-xs font-medium text-text-muted uppercase tracking-wide">Reconciliation</p>
          <p class="text-sm font-bold font-mono text-brand mt-0.5" data-testid="compound-summary-reconciliation">
            {{ formatRate(flowRate) }}
          </p>
        </div>
      </div>
      <p class="text-xs text-text-muted mt-2">
        As-of period totals{{ lastPeriodLabel ? ` through ${lastPeriodLabel}` : '' }}: assessed ₦{{ flowAssessed.toLocaleString() }}
        = collected ₦{{ flowCollected.toLocaleString() }} + outstanding ₦{{ flowOutstanding.toLocaleString() }}
      </p>
    </div>
  </ChartCard>
</template>

<style scoped>
/* Restrained motion: bars/dots reveal with a short, eased opacity fade; hover
   dims non-focused series. All motion is disabled under prefers-reduced-motion. */
.compound-bar,
.compound-dot,
.compound-line {
  transition: opacity 200ms cubic-bezier(0.22, 1, 0.36, 1);
}

@keyframes compoundFade {
  from { opacity: 0; }
  to { opacity: 1; }
}

.compound-bar {
  animation: compoundFade 300ms cubic-bezier(0.22, 1, 0.36, 1) backwards;
  animation-delay: calc(var(--i, 0) * 18ms);
  opacity: 0.9;
}

.compound-bar--active { opacity: 1; }
.compound-bar--dim { opacity: 0.35; }

.compound-tooltip {
  position: absolute;
  z-index: 20;
  width: 178px;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--color-border);
  background: color-mix(in srgb, var(--color-card) 96%, transparent);
  backdrop-filter: blur(6px);
  box-shadow: 0 8px 24px rgb(0 0 0 / 0.18);
  transform: translate(-50%, -100%);
  margin-top: -8px;
  pointer-events: none;
}

@media (prefers-reduced-motion: reduce) {
  .compound-bar,
  .compound-dot,
  .compound-line {
    transition: none;
  }
  .compound-bar {
    animation: none;
  }
}
</style>