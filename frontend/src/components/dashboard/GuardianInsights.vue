<script setup lang="ts">
import { computed } from 'vue';
import MetricCard from '../ui/MetricCard.vue';

interface Props {
  totalGuardians?: number;
  multipleChildren?: number;
  recentPayments?: number;
  installmentPayments?: number;
  pendingNotifications?: number;
  loading?: boolean;
}

defineProps<Props>();
</script>

<template>
  <section>
    <div class="mb-4">
      <h2 class="text-headline">Guardian Insights</h2>
      <p class="text-sm text-slate-500">Parent payment behavior analysis</p>
    </div>
    
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <MetricCard
        label="Total Guardians"
        :value="totalGuardians || 0"
        variant="info"
        description="Registered parents"
      />
      <MetricCard
        label="Multiple Children"
        :value="multipleChildren || 0"
        variant="info"
        description="Families with 2+ kids"
      />
      <MetricCard
        label="Recent Payments"
        :value="recentPayments || 0"
        variant="success"
        description="Last 7 days"
      />
      <MetricCard
        label="Installment Payments"
        :value="installmentPayments || 0"
        variant="success"
        description="Installment plans"
      />
      <MetricCard
        label="Pending Notifications"
        :value="pendingNotifications || 0"
        variant="warning"
        description="Messages queued"
      />
    </div>
  </section>
</template>