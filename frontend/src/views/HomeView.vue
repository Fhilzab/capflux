<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useDashboardStore } from '../stores/dashboardStore';
import { useSyncStore } from '../stores/syncStore';
import MissionControl from '../components/dashboard/MissionControl.vue';
import MorningBriefing from '../components/dashboard/MorningBriefing.vue';
import ExecutiveMetrics from '../components/dashboard/ExecutiveMetrics.vue';
import CollectionForecast from '../components/dashboard/CollectionForecast.vue';
import FeeCollectionTrend from '../components/dashboard/FeeCollectionTrend.vue';
import RecentPaymentsTable from '../components/dashboard/RecentPaymentsTable.vue';
import OutstandingBalancesTable from '../components/dashboard/OutstandingBalancesTable.vue';
import ActionCenter from '../components/dashboard/ActionCenter.vue';
import VirtualAccountHealth from '../components/dashboard/VirtualAccountHealth.vue';
import GuardianInsights from '../components/dashboard/GuardianInsights.vue';
import AIInsights from '../components/dashboard/AIInsights.vue';
import QuickActionsPanel from '../components/dashboard/QuickActionsPanel.vue';
import RightPanel from '../components/dashboard/RightPanel.vue';
import ErrorState from '../components/ui/ErrorState.vue';
import SkeletonLoader from '../components/ui/SkeletonLoader.vue';

const router = useRouter();
const dashboardStore = useDashboardStore();
const syncStore = useSyncStore();

const online = ref(typeof navigator !== 'undefined' ? navigator.onLine : true);

const aiInsights = computed(() => {
  const insights = [];
  
  // Simulate AI-generated insights based on data
  if (dashboardStore.collectionRate < 70) {
    insights.push({
      id: '1',
      type: 'warning' as const,
      message: `Collection rate dropped by ${Math.abs(70 - dashboardStore.collectionRate).toFixed(0)}%. Primary school collections outperform Secondary.`,
    });
  }
  
  if (dashboardStore.outstandingStudentCount > 10) {
    insights.push({
      id: '2',
      type: 'negative' as const,
      message: `${dashboardStore.outstandingStudentCount} guardians have outstanding balances. Reminder campaign may recover ₦${(dashboardStore.netBalance * 0.3).toLocaleString()}.`,
    });
  }
  
  insights.push({
    id: '3',
    type: 'positive' as const,
    message: '15 parents consistently pay before due dates. 18 guardians usually pay after reminder messages.',
  });
  
  return insights;
});

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
  <main class="min-h-screen bg-slate-950 text-white">
    <!-- Main Content Area with Right Panel -->
    <div class="pr-80">
      <div class="max-w-6xl mx-auto px-6 py-8 space-y-8">
        <!-- Page Header -->
        <header class="flex items-center justify-between">
          <div>
            <h1 class="text-display">Financial Command Center</h1>
            <p class="text-slate-500 mt-1">School revenue collection platform</p>
          </div>
          <div class="flex items-center gap-3">
            <span class="flex items-center gap-2 rounded-xl bg-slate-900/80 px-4 py-2 text-sm font-medium" :class="online ? 'text-emerald-400' : 'text-rose-400'">
              <span class="h-2 w-2 rounded-full" :class="online ? 'bg-emerald-400' : 'bg-rose-400'"></span>
              {{ online ? 'Online' : 'Offline' }}
            </span>
            <button 
              @click="refresh"
              class="rounded-xl bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20 transition-colors focus-ring"
            >
              Refresh
            </button>
          </div>
        </header>
        
        <!-- Loading State -->
        <div v-if="dashboardStore.loading" class="space-y-6">
          <SkeletonLoader type="card" :count="3" />
          <SkeletonLoader type="row" :count="2" />
          <SkeletonLoader type="card" :count="2" />
        </div>
        
        <!-- Error State -->
        <ErrorState v-else-if="dashboardStore.error" :error="dashboardStore.error" @retry="refresh" />
        
        <!-- Main Dashboard Content -->
        <div v-else class="space-y-8">
          <!-- Section 1: Mission Control -->
          <MissionControl 
            :todays-expected="dashboardStore.todaysExpected"
            :todays-collections="dashboardStore.todaysCollections"
            :outstanding="dashboardStore.netBalance"
            :loading="dashboardStore.loading"
          />
          
          <!-- Section 2: Morning Briefing -->
          <MorningBriefing
            :todays-collections="dashboardStore.todaysCollections"
            :outstanding-students="dashboardStore.outstandingStudentCount"
            :pending-d-v-as="dashboardStore.pendingDVAs"
            :pending-verification="dashboardStore.pendingVerification"
            :offline-queue="syncStore.pendingCount"
            :pending-notifications="dashboardStore.pendingNotifications"
            :loading="dashboardStore.loading"
          />
          
          <!-- Section 3: Executive Metrics -->
          <ExecutiveMetrics
            :total-students="dashboardStore.totalStudents"
            :total-guardians="dashboardStore.totalGuardians"
            :todays-payments="dashboardStore.todaysPaymentsCount"
            :term-collections="dashboardStore.totalPayments"
            :session-collections="dashboardStore.totalPayments * 3"
            :pending-verification="dashboardStore.pendingVerification"
            :offline-queue="syncStore.pendingCount"
            :pending-notifications="dashboardStore.pendingNotifications"
            :collection-rate="dashboardStore.collectionRate"
            :loading="dashboardStore.loading"
          />
          
          <!-- Section 4: Collection Forecast -->
          <CollectionForecast
            :projected-end-term="dashboardStore.totalCharges"
            :expected-outstanding="dashboardStore.netBalance"
            :likely-collection-rate="dashboardStore.collectionRate"
            :top-category="'Primary'"
            :active-day="'Tuesday'"
            :avg-installment="50000"
            :loading="dashboardStore.loading"
          />
          
          <!-- Section 5: Fee Collection Trend -->
          <FeeCollectionTrend
            :data="dashboardStore.trendData.payments"
            :loading="dashboardStore.loading"
          />
          
          <!-- Section 6: Recent Payments -->
          <RecentPaymentsTable
            :payments="dashboardStore.recentPayments"
            :loading="dashboardStore.loading"
          />
          
          <!-- Section 7: Outstanding Balances -->
          <OutstandingBalancesTable
            :students="dashboardStore.outstandingByStudent"
            :loading="dashboardStore.loading"
          />
          
          <!-- Section 8: Action Center -->
          <ActionCenter
            :pending-d-v-as="dashboardStore.pendingDVAs"
            :pending-verification="dashboardStore.pendingVerification"
            :failed-notifications="syncStore.failedCount"
            :payment-mismatches="0"
            :offline-records="syncStore.pendingCount"
            :reminders-needed="dashboardStore.outstandingStudentCount"
            :loading="dashboardStore.loading"
          />
          
          <!-- Section 9: Virtual Account Health -->
          <VirtualAccountHealth
            :total-active="dashboardStore.totalDVAs"
            :pending-creation="dashboardStore.pendingDVAs"
            :failed-creation="dashboardStore.failedDVAs"
            :recently-created="3"
            :webhook-status="online ? 'online' : 'offline'"
            :loading="dashboardStore.loading"
          />
          
          <!-- Section 10: Guardian Insights -->
          <GuardianInsights
            :total-guardians="dashboardStore.totalGuardians"
            :multiple-children="Math.floor(dashboardStore.totalGuardians * 0.3)"
            :recent-payments="dashboardStore.todaysPaymentsCount"
            :installment-payments="Math.floor(dashboardStore.totalPayments / 2)"
            :pending-notifications="dashboardStore.pendingNotifications"
            :loading="dashboardStore.loading"
          />
          
          <!-- Section 11: AI Insights -->
          <AIInsights
            :insights="aiInsights"
            :loading="dashboardStore.loading"
          />
          
          <!-- Section 12: Quick Actions -->
          <QuickActionsPanel :loading="dashboardStore.loading" />
        </div>
      </div>
    </div>
    
    <!-- Right Panel -->
    <RightPanel
      :todays-collections="dashboardStore.todaysCollections"
      :pending-sync="syncStore.pendingCount"
      :failed-sync="syncStore.failedCount"
      :internet-status="online"
      :last-synced-at="syncStore.lastSyncedAt"
      :notification-queue="dashboardStore.pendingNotifications"
      :webhook-queue="0"
    />
  </main>
</template>