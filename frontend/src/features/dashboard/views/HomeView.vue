<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { useDashboardStore } from '../stores/dashboardStore';
import { useSyncStore } from '../../../stores/syncStore';
import { useAuthStore } from '../../../stores/authStore';
import DashboardHeader from '../components/DashboardHeader.vue';
import KpiHero from '../components/KpiHero.vue';
import ActivityFeed from '../components/ActivityFeed.vue';
import SystemHealthCard from '../components/SystemHealthCard.vue';
import GatewayCard from '../components/GatewayCard.vue';
import FeeCollectionTrend from '../components/FeeCollectionTrend.vue';
import RecentPaymentsTable from '../components/RecentPaymentsTable.vue';
import OutstandingBalancesTable from '../components/OutstandingBalancesTable.vue';
import AIInsights from '../components/AIInsights.vue';
import OnboardingBanner from '../../../components/onboarding/OnboardingBanner.vue';
import ErrorState from '../../../components/ui/ErrorState.vue';
import SkeletonLoader from '../../../components/ui/SkeletonLoader.vue';

const dashboardStore = useDashboardStore();
const syncStore = useSyncStore();
const authStore = useAuthStore();

const online = ref(typeof navigator !== 'undefined' ? navigator.onLine : true);

const isOwner = computed(() => authStore.isOwner);

type InsightType = 'positive' | 'warning' | 'negative';

interface Insight {
  id: string;
  type: InsightType;
  message: string;
}

interface Activity {
  id: string;
  type: 'payment' | 'dva' | 'registration' | 'sync' | 'webhook' | 'notification';
  title: string;
  description: string;
  timestamp: string;
  amount?: number;
}

const aiInsights = computed((): Insight[] => {
  const insights: Insight[] = [];
  
  if (dashboardStore.collectionRate < 70) {
    insights.push({
      id: '1',
      type: 'warning',
      message: `Collection rate dropped by ${Math.abs(70 - dashboardStore.collectionRate).toFixed(0)}%. Primary school collections outperform Secondary.`,
    });
  }
  
  if (dashboardStore.outstandingStudentCount > 10) {
    insights.push({
      id: '2',
      type: 'negative',
      message: `${dashboardStore.outstandingStudentCount} guardians have outstanding balances. Reminder campaign may recover ₦${(dashboardStore.netBalance * 0.3).toLocaleString()}.`,
    });
  }
  
  insights.push({
    id: '3',
    type: 'positive',
    message: '15 parents consistently pay before due dates. 18 guardians usually pay after reminder messages.',
  });
  
  return insights;
});

const activityItems = computed((): Activity[] => [
  { id: '1', type: 'payment', title: 'Guardian Paid', description: '₦150,000 from Grace Johnson', timestamp: '2 mins ago', amount: 150000 },
  { id: '2', type: 'dva', title: 'DVA Created', description: 'For student Michael Ade', timestamp: '5 mins ago' },
  { id: '3', type: 'registration', title: 'Student Registered', description: 'New student Sarah Smith - Class 3A', timestamp: '10 mins ago' },
  { id: '4', type: 'sync', title: 'Offline Sync', description: '5 records synced successfully', timestamp: '15 mins ago' },
]);

const refresh = async () => {
  await dashboardStore.fetchDashboardData();
  await syncStore.refreshStatus();
};

onMounted(async () => {
  await refresh();
  
  window.addEventListener('online', () => {
    online.value = true;
    refresh();
  });
  window.addEventListener('offline', () => {
    online.value = false;
  });
});
</script>

<template>
  <main class="flex-1 overflow-y-auto">
    <div class="max-w-7xl mx-auto px-6 py-6 space-y-6">
      <!-- Onboarding Banner (when school setup incomplete) -->
      <OnboardingBanner v-if="!authStore.isOnboardingComplete" />
      
      <!-- Header Section -->
      <DashboardHeader />
      
      <!-- Loading State -->
      <div v-if="dashboardStore.loading" class="space-y-6">
        <SkeletonLoader type="card" :count="3" />
        <SkeletonLoader type="row" :count="2" />
        <SkeletonLoader type="card" :count="2" />
      </div>
      
      <!-- Error State -->
      <ErrorState v-else-if="dashboardStore.error" :error="dashboardStore.error" @retry="refresh" />
      
      <!-- Dashboard Content - Financial Command Center -->
      <div v-else class="space-y-6">
        <!-- Section 1: Primary KPI Hero -->
        <KpiHero 
          :todays-collections="dashboardStore.todaysCollections"
          :outstanding-balance="dashboardStore.netBalance"
          :expected-collections="dashboardStore.todaysExpected"
          :students-awaiting-dva="dashboardStore.pendingDVAs"
          :pending-verification="dashboardStore.pendingVerification"
          :collection-rate="dashboardStore.collectionRate"
          :loading="dashboardStore.loading"
        />
        
        <!-- Section 2: Charts -->
        <FeeCollectionTrend 
          :data="dashboardStore.trendData.payments"
          :loading="dashboardStore.loading"
        />
        
        <!-- Section 3: Recent Activity & Payments -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ActivityFeed :activities="activityItems" :loading="dashboardStore.loading" />
          <RecentPaymentsTable 
            :payments="dashboardStore.recentPayments"
            :loading="dashboardStore.loading"
          />
        </div>
        
        <!-- Section 4: Outstanding & Needs Attention -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <OutstandingBalancesTable 
            :students="dashboardStore.outstandingByStudent"
            :loading="dashboardStore.loading"
          />
          <AIInsights 
            :insights="aiInsights"
            :loading="dashboardStore.loading"
          />
        </div>
        
        <!-- Section 5: System Health (Owner only) -->
        <div v-if="isOwner" class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <GatewayCard 
            :loading="dashboardStore.loading"
          />
          <SystemHealthCard 
            :internet-status="online"
            :loading="dashboardStore.loading"
          />
        </div>
      </div>
    </div>
  </main>
</template>