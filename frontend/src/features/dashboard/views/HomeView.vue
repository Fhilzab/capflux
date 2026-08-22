<script setup lang="ts">
import { onMounted, computed, onUnmounted } from 'vue';
import { useDashboardStore } from '../stores/dashboardStore';
import { useAuthStore } from '../../../stores/authStore';
import type { TrendRange } from '../stores/dashboardStore';

import DashboardHeader from '../components/DashboardHeader.vue';
import FeeCollectionTrend from '../components/FeeCollectionTrend.vue';
import RecentPaymentsTable from '../components/RecentPaymentsTable.vue';
import OutstandingBalancesTable from '../components/OutstandingBalancesTable.vue';
import CollectionBreakdown from '../components/CollectionBreakdown.vue';
import OperationalMetrics from '../components/OperationalMetrics.vue';
import ActivationBanner from '../components/ActivationBanner.vue';
import MetricCard from '../../../components/ui/MetricCard.vue';
import ErrorState from '../../../components/ui/ErrorState.vue';
import SkeletonLoader from '../../../components/ui/SkeletonLoader.vue';

const dashboardStore = useDashboardStore();
const authStore = useAuthStore();

// Real trend indicator for "This Month" metric (month-over-month from actual entries)
const monthlyTrend = computed(() => dashboardStore.monthlyTrend);

// Icon path strings for metric cards (Heroicons outline, single-path)
const icons = {
  receipt:
    'M16.862 4.487l-.707.707M16.862 4.487a2.25 2.25 0 00-3.182 0L6.75 15.75m10.5-10.5l.707.707M16.862 4.487L6.75 15.75M16.862 4.487l.707.707M6.75 15.75l.707-.707M15 6.75h3.375c.621 0 1.125.504 1.125 1.125v3.375c0 .621-.504 1.125-1.125 1.125H15V6.75z',
  clock: 'M12 6v6l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  'exclamation-circle':
    'M12 9v3.75m0 0h.008v-.008H12V15zm0 0h.008v-.008H12V15zm0 0h-.008v.008H12V15zm0 0v-.008H12V12zM8.25 9V5.625c0-.621.504-1.125 1.125-1.125h3.375c.621 0 1.125.504 1.125 1.125V9',
  'chart-bar':
    'M3 13.5v-6A2.25 2.25 0 015.25 5.25h13.5A2.25 2.25 0 0121 7.5v6m-3 3v3.75a.75.75 0 01-.75.75h-1.5A.75.75 0 0115 15.75V15m-3 3v3.75a.75.75 0 01-.75.75h-1.5A.75.75 0 019 15.75V15m-3 3v3.75a.75.75 0 01-.75.75H3.75a.75.75 0 01-.75-.75V12',
};

// Real metric data derived from the dashboard store — no fabricated values
const metricCards = computed(() => [
  {
    label: 'Total Collected',
    value: dashboardStore.totalPayments,
    currency: true,
    icon: icons.receipt,
    variant: 'revenue' as const,
    description: `${dashboardStore.totalStudents} students • ${dashboardStore.totalPayments > 0 ? 'All accounts' : 'No payments recorded'}`,
  },
  {
    label: 'Collected This Month',
    value: dashboardStore.thisMonthsCollections,
    currency: true,
    icon: icons.clock,
    variant: 'collection' as const,
    trend: monthlyTrend.value?.trend,
    trendValue: monthlyTrend.value?.value,
  },
  {
    label: 'Outstanding Balance',
    value: dashboardStore.netBalance,
    currency: true,
    icon: icons['exclamation-circle'],
    variant: 'outstanding' as const,
    description: `${dashboardStore.outstandingStudentCount} student${dashboardStore.outstandingStudentCount !== 1 ? 's' : ''} with balances`,
  },
  {
    label: 'Collection Rate',
    value: `${dashboardStore.collectionRate.toFixed(1)}%`,
    currency: false,
    icon: icons['chart-bar'],
    variant: 'collection' as const,
    description:
      dashboardStore.totalCharges > 0
        ? `of ₦${dashboardStore.totalCharges.toLocaleString()} in fees`
        : 'No fees charged yet',
  },
]);

const availableRanges: TrendRange[] = ['7D', '30D', '3M', '6M', '1Y'];

const refresh = async () => {
  // fetchDashboardData already refreshes sync status internally —
  // calling it here too duplicated the Dexie queue reads on every load.
  await dashboardStore.fetchDashboardData();
};

const handleOnline = () => {
  refresh();
};

onMounted(async () => {
  await refresh();

  window.addEventListener('online', handleOnline);
});

onUnmounted(() => {
  window.removeEventListener('online', handleOnline);
});
</script>

<template>
  <div class="flex-1 overflow-y-auto">
    <div class="max-w-7xl mx-auto px-6 py-6 space-y-6">
      <!-- Activation Banner (when school setup incomplete) -->
      <ActivationBanner v-if="!authStore.isSchoolSetupComplete" />

      <!-- Page Introduction -->
      <DashboardHeader />

      <!-- Loading State -->
      <div v-if="dashboardStore.loading" class="space-y-6">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div v-for="i in 4" :key="i" class="skeleton h-28 rounded-2xl"></div>
        </div>
        <SkeletonLoader type="chart" />
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SkeletonLoader type="card" :count="2" />
        </div>
        <SkeletonLoader type="card" :count="1" />
      </div>
      <!-- Error State -->
      <ErrorState v-else-if="dashboardStore.error" :error="dashboardStore.error" @retry="refresh" />

      <!-- Dashboard Content -->
      <div v-else class="space-y-6">
        <!-- Top Metric Row: 4 compact cards -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            v-for="metric in metricCards"
            :key="metric.label"
            :label="metric.label"
            :value="metric.value"
            :currency="metric.currency"
            :icon="metric.icon"
            :variant="metric.variant"
            :trend="metric.trend"
            :trend-value="metric.trendValue"
            :description="metric.description"
          />
        </div>

        <!-- Primary Analytics + Secondary Panel -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div class="lg:col-span-2">
            <FeeCollectionTrend
              :data="dashboardStore.trendDataByRange"
              :loading="dashboardStore.loading"
              :selected-range="dashboardStore.selectedTrendRange"
              :available-ranges="availableRanges"
              @update:selectedRange="dashboardStore.setTrendRange"
            />
          </div>
          <div>
            <CollectionBreakdown :loading="dashboardStore.loading" />
          </div>
        </div>

        <!-- Recent Payments + Operational Metrics -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <RecentPaymentsTable
            :payments="dashboardStore.recentPayments"
            :loading="dashboardStore.loading"
          />
          <OperationalMetrics :loading="dashboardStore.loading" />
        </div>

        <!-- Outstanding Balances (operational detail) -->
        <OutstandingBalancesTable
          :students="dashboardStore.outstandingByStudent"
          :loading="dashboardStore.loading"
        />
      </div>
    </div>
  </div>
</template>
