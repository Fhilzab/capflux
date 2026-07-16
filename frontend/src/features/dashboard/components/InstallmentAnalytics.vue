<script setup lang="ts">
import MetricCard from '../../../components/ui/MetricCard.vue';

interface Props {
  studentsOnInstallments?: number;
  averageInstallment?: number;
  avgInstallmentsCount?: number;
  largestInstallment?: number;
  installmentsDueToday?: number;
  installmentsOverdue?: number;
  recoveryRate?: number;
  loading?: boolean;
}

defineProps<Props>();
</script>

<template>
  <section>
    <div class="mb-4">
      <h2 class="text-headline">Installment Analytics</h2>
      <p class="text-sm text-slate-500">Payment plan performance metrics</p>
    </div>

    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        label="Students on Installments"
        :value="studentsOnInstallments || 0"
        variant="info"
        description="Active plans"
      />
      <MetricCard
        label="Average Installment"
        :value="averageInstallment || 0"
        :currency="true"
        variant="success"
        description="Per transaction"
      />
      <MetricCard
        label="Avg Installments Count"
        :value="avgInstallmentsCount || 0"
        variant="info"
        description="Per student"
      />
      <MetricCard
        label="Largest Installment"
        :value="largestInstallment || 0"
        :currency="true"
        variant="warning"
        description="Record high"
      />
      <MetricCard
        label="Due Today"
        :value="installmentsDueToday || 0"
        variant="info"
        description="Expected today"
      />
      <MetricCard
        label="Overdue"
        :value="installmentsOverdue || 0"
        variant="error"
        description="Delayed payments"
      />
      <MetricCard
        label="Recovery Rate"
        :value="recoveryRate || 0"
        variant="success"
        description="Successful recoveries"
      />
    </div>
  </section>
</template>