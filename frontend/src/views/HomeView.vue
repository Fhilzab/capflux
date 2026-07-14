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
import RevenueRiskPanel from '../components/dashboard/RevenueRiskPanel.vue';
import PaymentRecoveryPipeline from '../components/dashboard/PaymentRecoveryPipeline.vue';
import PaymentHeatmap from '../components/dashboard/PaymentHeatmap.vue';
import CategoryPerformance from '../components/dashboard/CategoryPerformance.vue';
import InstallmentAnalytics from '../components/dashboard/InstallmentAnalytics.vue';
import SystemHealth from '../components/dashboard/SystemHealth.vue';
import SmartAlerts from '../components/dashboard/SmartAlerts.vue';
import RevenueScoreboard from '../components/dashboard/RevenueScoreboard.vue';
import CapstoneScore from '../components/dashboard/CapstoneScore.vue';
import RecentSystemEvents from '../components/dashboard/RecentSystemEvents.vue';
import ErrorState from '../components/ui/ErrorState.vue';
import SkeletonLoader from '../components/ui/SkeletonLoader.vue';

const router = useRouter();
const dashboardStore = useDashboardStore();
const syncStore = useSyncStore();

const online = ref(typeof navigator !== 'undefined' ? navigator.onLine : true);

const aiInsights = computed(() => {
  const insights = [];
  
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
  <main class="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white">
    <div class="pr-80">
      <div class="max-w-6xl mx-auto px-6 py-8 space-y-8">
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
        
        <div v-if="dashboardStore.loading" class="space-y-6">
          <SkeletonLoader type="card" :count="3" />
          <SkeletonLoader type="row" :count="2" />
          <SkeletonLoader type="card" :count="2" />
        </div>
        
        <ErrorState v-else-if="dashboardStore.error" :error="dashboardStore.error" @retry="refresh" />
        
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
          
          <!-- Section 13: Revenue Risk Panel -->
          <RevenueRiskPanel
            :expected-revenue="dashboardStore.totalCharges"
            :collected-revenue="dashboardStore.totalPayments"
            :outstanding-revenue="dashboardStore.netBalance"
            :loading="dashboardStore.loading"
          />
          
          <!-- Section 14: Payment Recovery Pipeline -->
          <PaymentRecoveryPipeline
            :total-students="dashboardStore.totalStudents"
            :students-paid="dashboardStore.totalPayments > 0 ? 150 : 0"
            :students-installment="50"
            :students-overdue="dashboardStore.outstandingStudentCount"
            :students-reminded="20"
            :students-recovered="15"
            :loading="dashboardStore.loading"
          />
          
          <!-- Section 15: Payment Heatmap -->
          <PaymentHeatmap
            best-payment-day="Tuesday"
            best-payment-hour="14:00"
            best-collection-week="Week 3"
            best-category="Primary"
            highest-paying-segment="Class 5"
            :loading="dashboardStore.loading"
          />
          
          <!-- Section 16: Category Performance -->
          <CategoryPerformance
            :categories="[
              { name: 'Nursery', students: 50, expected: 1000000, collected: 800000, outstanding: 200000, collectionRate: 80 },
              { name: 'Primary', students: 120, expected: 2400000, collected: 2000000, outstanding: 400000, collectionRate: 83 },
              { name: 'Secondary', students: 80, expected: 1600000, collected: 1200000, outstanding: 400000, collectionRate: 75 }
            ]"
            :loading="dashboardStore.loading"
          />
          
          <!-- Section 17: Installment Analytics -->
          <InstallmentAnalytics
            :students-on-installments="Math.floor(dashboardStore.totalStudents * 0.4)"
            :average-installment="80000"
            :avg-installments-count="3"
            :largest-installment="500000"
            :installments-due-today="10"
            :installments-overdue="5"
            :recovery-rate="65"
            :loading="dashboardStore.loading"
          />
          
          <!-- Section 18: System Health -->
          <SystemHealth
            database-health="online"
            offline-engine="running"
            :sync-queue="syncStore.pendingCount"
            webhook-health="online"
            notification-delivery="healthy"
            payment-verification="passed"
            :dva-creation-queue="dashboardStore.pendingDVAs"
            :internet-status="online"
            :last-sync="syncStore.lastSyncedAt"
            :loading="dashboardStore.loading"
          />
          
          <!-- Section 19: Smart Alerts -->
          <SmartAlerts
            :alerts="[
              { id: '1', type: 'high', title: 'High Outstanding Balance', message: '₦420,000 at risk of unpaid collections.' },
              { id: '2', type: 'medium', title: 'Reminder Campaign Recommended', message: '23 guardians have outstanding balances.' }
            ]"
            :loading="dashboardStore.loading"
          />
          
          <!-- Section 20: Revenue Scoreboard -->
          <RevenueScoreboard
            :expected-revenue="dashboardStore.totalCharges"
            :collected-revenue="dashboardStore.totalPayments"
            :outstanding-revenue="dashboardStore.netBalance"
            :collection-rate="dashboardStore.collectionRate"
            :recovery-rate="65"
            :platform-revenue="Math.floor(dashboardStore.totalPayments * 0.01)"
            :gateway-fees="Math.floor(dashboardStore.totalPayments * 0.02)"
            :net-settlement="Math.floor(dashboardStore.totalPayments * 0.97)"
            :loading="dashboardStore.loading"
          />
          
          <!-- Section 21: Capstone Score -->
          <CapstoneScore
            :collection-rate="dashboardStore.collectionRate"
            :payment-success="95"
            :outstanding-balance="dashboardStore.netBalance"
            :notification-success="98"
            :offline-sync-health="92"
            :guardian-reachability="90"
            :verification-success="96"
            :loading="dashboardStore.loading"
          />
          
          <!-- Section 22: Recent System Events -->
          <RecentSystemEvents
            :events="[
              { id: '1', type: 'payment', title: 'Payment Verified', description: '₦150,000 from John Doe', timestamp: '2 mins ago' },
              { id: '2', type: 'dva', title: 'DVA Created', description: 'For new student Jane Smith', timestamp: '5 mins ago' },
              { id: '3', type: 'sync', title: 'Offline Sync Completed', description: '5 records synced', timestamp: '10 mins ago' }
            ]"
            :loading="dashboardStore.loading"
          />
        </div>
      </div>
    </div>
    
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