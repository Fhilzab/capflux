<script setup lang="ts">
import { computed } from 'vue';
import MetricCard from '../../../components/ui/MetricCard.vue';

interface Props {
  expectedRevenue?: number;
  collectedRevenue?: number;
  outstandingRevenue?: number;
  loading?: boolean;
}

const props = defineProps<Props>();

const atRiskRevenue = computed(() => {
  const outstanding = props.outstandingRevenue || 0;
  const recoveryPotential = Math.min(0.35, outstanding * 0.35 / (props.expectedRevenue || 1));
  return outstanding * (1 - recoveryPotential);
});

const confidenceScore = computed(() => {
  const rate = props.collectedRevenue && props.expectedRevenue 
    ? (props.collectedRevenue / props.expectedRevenue) * 100 
    : 0;
  return Math.min(100, rate * 0.9 + 10);
});

const recoveryPotential = computed(() => {
  const outstanding = props.outstandingRevenue || 0;
  return Math.round((outstanding * 0.35 / (props.expectedRevenue || 1)) * 100);
});
</script>

<template>
  <section>
    <div class="mb-4 flex items-center gap-2">
      <h2 class="text-headline">At-Risk Revenue</h2>
      <span class="rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-400">Risk Assessment</span>
    </div>

    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        label="Expected Revenue"
        :value="expectedRevenue || 0"
        :currency="true"
        variant="info"
        description="Projections"
      />
      <MetricCard
        label="Collected Revenue"
        :value="collectedRevenue || 0"
        :currency="true"
        variant="success"
        description="Actual receipts"
      />
      <MetricCard
        label="Outstanding Revenue"
        :value="outstandingRevenue || 0"
        :currency="true"
        variant="warning"
        description="Pending collections"
      />
      <MetricCard
        label="At-Risk Revenue"
        :value="Math.round(atRiskRevenue)"
        :currency="true"
        variant="error"
        description="Likely unpaid"
      />
    </div>

    <!-- Confidence Gauge -->
    <div class="mt-6 premium-card p-5">
      <div class="flex items-center justify-between mb-3">
        <span class="text-sm font-medium text-slate-400">Collection Confidence Score</span>
        <span class="text-lg font-mono font-bold text-white">{{ Math.round(confidenceScore) }}%</span>
      </div>
      <div class="h-2 rounded-full bg-slate-800 overflow-hidden">
        <div class="h-full rounded-full bg-gradient-to-r from-rose-500 via-amber-500 to-emerald-500" :style="{ width: `${confidenceScore}%` }"></div>
      </div>
      
      <div class="mt-4 flex items-center justify-between">
        <span class="text-sm font-medium text-slate-400">Recovery Potential</span>
        <span class="text-sm font-mono text-emerald-400">{{ recoveryPotential }}%</span>
      </div>
    </div>
  </section>
</template>