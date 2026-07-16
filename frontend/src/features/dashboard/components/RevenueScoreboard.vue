<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  expectedRevenue?: number;
  collectedRevenue?: number;
  outstandingRevenue?: number;
  collectionRate?: number;
  recoveryRate?: number;
  platformRevenue?: number;
  gatewayFees?: number;
  netSettlement?: number;
}

const props = defineProps<Props>();

const netCollectionRate = computed(() => {
  const rate = (props.collectionRate || 0) / 100;
  const recovery = (props.recoveryRate || 0) / 100;
  return Math.round(rate * recovery * 100);
});
</script>

<template>
  <section>
    <div class="mb-4">
      <h2 class="text-headline">Revenue Scoreboard</h2>
      <p class="text-sm text-slate-500">Financial snapshot of the school</p>
    </div>

    <div class="premium-card--glow p-6">
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p class="text-label mb-1">Expected Revenue</p>
          <p class="text-2xl font-mono font-bold text-cyan-400">₦{{ (props.expectedRevenue || 0).toLocaleString() }}</p>
        </div>
        <div>
          <p class="text-label mb-1">Collected</p>
          <p class="text-2xl font-mono font-bold text-emerald-400">₦{{ (props.collectedRevenue || 0).toLocaleString() }}</p>
        </div>
        <div>
          <p class="text-label mb-1">Outstanding</p>
          <p class="text-2xl font-mono font-bold text-amber-400">₦{{ (props.outstandingRevenue || 0).toLocaleString() }}</p>
        </div>
        <div>
          <p class="text-label mb-1">Collection %</p>
          <p class="text-2xl font-mono font-bold text-white">{{ netCollectionRate }}%</p>
        </div>
      </div>

      <div class="mt-6 border-t border-slate-800/50 pt-4">
        <div class="grid gap-4 sm:grid-cols-3">
          <div>
            <p class="text-label mb-1">Platform Revenue</p>
            <p class="text-lg font-mono font-semibold text-violet-400">₦{{ (props.platformRevenue || 0).toLocaleString() }}</p>
          </div>
          <div>
            <p class="text-label mb-1">Gateway Fees</p>
            <p class="text-lg font-mono font-semibold text-rose-400">₦{{ (props.gatewayFees || 0).toLocaleString() }}</p>
          </div>
          <div>
            <p class="text-label mb-1">Net Settlement</p>
            <p class="text-lg font-mono font-semibold text-emerald-400">₦{{ (props.netSettlement || 0).toLocaleString() }}</p>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>