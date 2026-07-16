<script setup lang="ts">
import MetricCard from '../../../components/ui/MetricCard.vue';

interface Props {
  todaysExpected?: number;
  todaysCollections?: number;
  outstanding?: number;
  loading?: boolean;
}

defineProps<Props>();
</script>

<template>
  <section>
    <div class="mb-4">
      <h2 class="text-headline">Mission Control</h2>
      <p class="text-sm text-slate-500">Real-time cash flow overview</p>
    </div>
    
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <!-- Expected Collections -->
      <MetricCard
        label="Expected Collections"
        :value="todaysExpected || 0"
        :currency="true"
        variant="info"
        description="Projected for today"
      />
      
      <!-- Today's Collections -->
      <MetricCard
        label="Today's Collections"
        :value="todaysCollections || 0"
        :currency="true"
        variant="success"
        description="Actual collected"
      />
      
      <!-- Outstanding Balance -->
      <MetricCard
        label="Outstanding Balance"
        :value="outstanding || 0"
        :currency="true"
        variant="warning"
        description="Still owed"
      />
    </div>
  </section>
</template>