<script setup lang="ts">
import { onMounted, computed, onUnmounted } from 'vue';
import { useDashboardStore } from '../stores/dashboardStore';
import { useOnboardingStore } from '../../../stores/onboardingStore';
import { useSchoolStore } from '../../../stores/schoolStore';
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
import { runtimeEnvironment } from '../../../shared/environment/runtimeEnvironment';
import { WalletCards, Clock3, TriangleAlert, ChartColumn } from '@lucide/vue';

const dashboardStore = useDashboardStore();
const onboardingStore = useOnboardingStore();
const schoolStore = useSchoolStore();

const showActivationBanner = computed(() => {
  if (runtimeEnvironment.isSandbox) return false;
  if (!onboardingStore.statusLoaded && !schoolStore.initialized) return false;
  if (onboardingStore.requiresSetup || schoolStore.requiresSetup) return true;
  if (!onboardingStore.hasSchool && !schoolStore.school) return true;
  return false;
});

// Real trend indicator for "This Month" metric (month-over-month from actual entries)
const monthlyTrend = computed(() => dashboardStore.monthlyTrend);

// Real metric data derived from the dashboard store — Lucide icons for UI (brand C remains canonical)
const metricCards = computed(() => [
  {
    label: 'Total Collected',
    value: dashboardStore.totalPayments,
    currency: true,
    lucideIcon: WalletCards,
    variant: 'revenue' as const,
    description: `${dashboardStore.totalStudents} students • ${dashboardStore.totalPayments > 0 ? 'All accounts' : 'No payments recorded'}`,
  },
  {
    label: 'Collected This Month',
    value: dashboardStore.thisMonthsCollections,
    currency: true,
    lucideIcon: Clock3,
    variant: 'collection' as const,
    trend: monthlyTrend.value?.trend,
    trendValue: monthlyTrend.value?.value,
  },
  {
    label: 'Outstanding Balance',
    value: dashboardStore.netBalance,
    currency: true,
    lucideIcon: TriangleAlert,
    variant: 'outstanding' as const,
    description: `${dashboardStore.outstandingStudentCount} student${dashboardStore.outstandingStudentCount !== 1 ? 's' : ''} with balances`,
  },
  {
    label: 'Collection Rate',
    value: `${dashboardStore.collectionRate.toFixed(1)}%`,
    currency: false,
    lucideIcon: ChartColumn,
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

const ensureOnboardingState = async () => {
  if (!onboardingStore.statusLoaded && !onboardingStore.statusLoading) {
    onboardingStore.loadStatus().catch(() => {});
  }
  if (!schoolStore.initialized && !schoolStore.loading) {
    schoolStore.initialize().catch(() => {});
  }
};

const handleOnline = () => {
  refresh();
};

onMounted(async () => {
  await Promise.all([refresh(), ensureOnboardingState()]);

  window.addEventListener('online', handleOnline);
});

onUnmounted(() => {
  window.removeEventListener('online', handleOnline);
});
</script>

<template>
  <div class="flex-1 overflow-y-auto">
    <div class="max-w-7xl mx-auto px-6 py-6 space-y-6">
      <!-- Activation Banner (when school setup incomplete — canonical onboarding/school state) -->
      <ActivationBanner v-if="showActivationBanner" />

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
            :lucide-icon="metric.lucideIcon"
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
