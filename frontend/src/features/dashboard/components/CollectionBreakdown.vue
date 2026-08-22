<script setup lang="ts">
import { computed } from 'vue';
import { useDashboardStore } from '../stores/dashboardStore';
import ChartCard from '../../../components/ui/ChartCard.vue';
import SkeletonLoader from '../../../components/ui/SkeletonLoader.vue';
import EmptyState from '../../../components/ui/EmptyState.vue';
import CmStatusChip from '../../../components/ui/CmStatusChip.vue';

interface Props {
  loading?: boolean;
}

const props = withDefaults(defineProps<Props>(), { loading: false });

const dashboardStore = useDashboardStore();

const breakdown = computed(() => {
  const collected = dashboardStore.totalPayments;
  const outstanding = dashboardStore.netBalance;
  const totalCharges = dashboardStore.totalCharges;
  const collectedPercent = dashboardStore.collectedPercent;
  const outstandingPercent = dashboardStore.outstandingPercent;

  return [
    {
      label: 'Collected',
      amount: collected,
      percent: collectedPercent,
      barColor: 'bg-success',
      textColor: 'text-success',
    },
    {
      label: 'Outstanding',
      amount: outstanding,
      percent: outstandingPercent,
      barColor: 'bg-warning',
      textColor: 'text-warning',
    },
  ];
});

const hasData = computed(() => dashboardStore.totalCharges > 0);
</script>

<template>
  <ChartCard title="Collection Breakdown" description="Fees collected vs outstanding">
    <div v-if="loading" class="space-y-4">
      <SkeletonLoader type="text" :count="8" />
    </div>

    <EmptyState
      v-else-if="!hasData"
      title="No financial data yet"
      description="Collection breakdown will appear once fees are charged."
      icon="M12 6v6l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
    />

    <div v-else class="space-y-4">
      <div
        v-for="item in breakdown"
        :key="item.label"
        class="space-y-2"
      >
        <div class="flex items-center justify-between">
          <span class="text-xs font-medium text-text-muted">{{ item.label }}</span>
          <span class="text-sm font-medium font-mono" :class="item.textColor">
            ₦{{ item.amount.toLocaleString() }}
          </span>
        </div>
        <div class="relative h-2 w-full rounded-full bg-divider overflow-hidden">
          <div
            class="h-full rounded-full transition-all duration-500"
            :class="item.barColor"
            :style="{ width: `${Math.min(item.percent, 100)}%` }"
          />
        </div>
        <div class="flex items-center justify-between text-xs">
          <span class="text-text-muted">{{ item.percent.toFixed(1) }}%</span>
          <CmStatusChip
            :status="item.label === 'Collected' ? 'success' : 'warning'"
            :label="item.label === 'Collected' ? 'Collected' : 'Unpaid'"
            size="sm"
          />
        </div>
      </div>

      <div v-if="dashboardStore.pendingVerification > 0" class="border-t border-divider pt-3 mt-3">
        <div class="flex items-center justify-between">
          <span class="text-xs font-medium text-text-muted">Pending Verification</span>
          <span class="text-sm font-medium font-mono text-warning">
            {{ dashboardStore.pendingVerification }}
          </span>
        </div>
        <p class="mt-1 text-xs text-text-muted">
          Payments awaiting verification will appear here.
        </p>
      </div>

      <div v-else class="border-t border-divider pt-3 mt-3">
        <p class="text-xs text-text-muted">All collections are verified</p>
      </div>
    </div>
  </ChartCard>
</template>
