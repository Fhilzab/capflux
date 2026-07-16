<script setup lang="ts">
import InsightCard from '../../../components/ui/InsightCard.vue';

interface Props {
  projectedEndTerm?: number;
  expectedOutstanding?: number;
  likelyCollectionRate?: number;
  topCategory?: string;
  activeDay?: string;
  avgInstallment?: number;
  loading?: boolean;
}

defineProps<Props>();
</script>

<template>
  <section>
    <div class="mb-4 flex items-center gap-2">
      <h2 class="text-headline">Collection Forecast</h2>
      <span class="rounded-full bg-violet-500/10 px-2.5 py-1 text-xs font-medium text-violet-400">AI-powered</span>
    </div>
    
    <div class="section-grid">
      <InsightCard
        label="Projected End-of-Term"
        :value="projectedEndTerm || 0"
        :currency="true"
        variant="info"
        description="Expected collection"
        trend="up"
        trend-value="12%"
      />
      <InsightCard
        label="Expected Outstanding"
        :value="expectedOutstanding || 0"
        :currency="true"
        variant="warning"
        description="Likely to remain unpaid"
      />
      <InsightCard
        label="Likely Collection Rate"
        :value="((likelyCollectionRate || 0) / 100).toFixed(0)"
        variant="success"
        description="Based on current trend"
      />
      <InsightCard
        label="Top Paying Category"
        :value="topCategory || 'N/A'"
        variant="info"
        description="Best performing"
      />
      <InsightCard
        label="Most Active Day"
        :value="activeDay || 'N/A'"
        variant="info"
        description="Peak collection day"
      />
      <InsightCard
        label="Avg Installment Size"
        :value="avgInstallment || 0"
        :currency="true"
        variant="success"
        description="Average payment"
      />
    </div>
  </section>
</template>