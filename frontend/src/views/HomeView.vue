<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useDashboardStore } from '../stores/dashboardStore';
import { useSyncStore } from '../stores/syncStore';
import { useAuthStore } from '../stores/authStore';
import DashboardHeader from '../components/dashboard/DashboardHeader.vue';
import KpiHero from '../components/dashboard/KpiHero.vue';
import UniversalSearch from '../components/dashboard/UniversalSearch.vue';
import ActivityFeed from '../components/dashboard/ActivityFeed.vue';
import SystemHealthCard from '../components/dashboard/SystemHealthCard.vue';
import GatewayCard from '../components/dashboard/GatewayCard.vue';
import SmartAlerts from '../components/dashboard/SmartAlerts.vue';
import FeeCollectionTrend from '../components/dashboard/FeeCollectionTrend.vue';
import RecentPaymentsTable from '../components/dashboard/RecentPaymentsTable.vue';
import OutstandingBalancesTable from '../components/dashboard/OutstandingBalancesTable.vue';
import AIInsights from '../components/dashboard/AIInsights.vue';
import ErrorState from '../components/ui/ErrorState.vue';
import SkeletonLoader from '../components/ui/SkeletonLoader.vue';

const router = useRouter();
const dashboardStore = useDashboardStore();
const syncStore = useSyncStore();
const authStore = useAuthStore();

const online = ref(typeof navigator !== 'undefined' ? navigator.onLine : true);
const isSidebarCollapsed = ref(false);

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
  <div class="min-h-screen bg-slate-50 dark:bg-slate-950">
    <div class="flex h-screen overflow-hidden">
      <!-- Sidebar -->
      <aside 
        class="premium-card fixed left-0 top-0 bottom-0 z-30 p-4 transition-all duration-300"
        :class="isSidebarCollapsed ? 'w-20' : 'w-72'"
      >
        <div class="flex items-center justify-between mb-8">
          <div v-if="!isSidebarCollapsed" class="text-headline text-cyan-500">Capstone</div>
          <button 
            @click="isSidebarCollapsed = !isSidebarCollapsed"
            class="p-2 rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors"
          >
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
        
        <nav class="space-y-1">
          <router-link 
            to="/dashboard" 
            class="flex items-center gap-3 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors"
            active-class="bg-cyan-500/10 text-cyan-600"
          >
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2 7-7 9 9-14 14" />
            </svg>
            <span v-if="!isSidebarCollapsed">Dashboard</span>
          </router-link>
          
          <router-link 
            to="/students" 
            class="flex items-center gap-3 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors"
            active-class="bg-cyan-500/10 text-cyan-600"
          >
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 0 8 8 0 10-8-8 3 3 0 00-6 6c0 1.59.58 3.03 1.57 4.15" />
            </svg>
            <span v-if="!isSidebarCollapsed">Students</span>
          </router-link>
          
          <router-link 
            to="/payments" 
            class="flex items-center gap-3 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors"
            active-class="bg-cyan-500/10 text-cyan-600"
          >
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.654 0-3 .896-3 2s1.346 2 3 2 3-.896 3-2-1.346-2-3-2z" />
            </svg>
            <span v-if="!isSidebarCollapsed">Payments</span>
          </router-link>
          
          <router-link 
            v-if="isOwner"
            to="/billing" 
            class="flex items-center gap-3 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors"
            active-class="bg-cyan-500/10 text-cyan-600"
          >
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 00-2 2v8a2 2 0 002 2h7a2 2 0 002-2v-8a2 2 0 00-2-2H9V6m2-2h6a2 2 0 012 2v2H9V6a2 2 0 012-2z" />
            </svg>
            <span v-if="!isSidebarCollapsed">Fee Structure</span>
          </router-link>
        </nav>
      </aside>

      <!-- Main Content -->
      <main class="flex-1 overflow-y-auto" :class="isSidebarCollapsed ? 'ml-20' : 'ml-72'">
        <div class="max-w-7xl mx-auto px-6 py-8 space-y-8">
          
          <!-- Header Section -->
          <div class="flex items-center justify-between gap-4">
            <DashboardHeader />
            <UniversalSearch class="w-80" />
          </div>
          
          <!-- Loading State -->
          <div v-if="dashboardStore.loading" class="space-y-6">
            <SkeletonLoader type="card" :count="3" />
            <SkeletonLoader type="row" :count="2" />
            <SkeletonLoader type="card" :count="2" />
          </div>
          
          <!-- Error State -->
          <ErrorState v-else-if="dashboardStore.error" :error="dashboardStore.error" @retry="refresh" />
          
          <!-- Dashboard Content -->
          <div v-else class="space-y-8">
            <!-- Section 1: KPI Hero -->
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
            
            <!-- Section 3: Activity & Payments -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ActivityFeed :activities="activityItems" :loading="dashboardStore.loading" />
              <RecentPaymentsTable 
                :payments="dashboardStore.recentPayments"
                :loading="dashboardStore.loading"
              />
            </div>
            
            <!-- Section 4: Outstanding & AI Insights -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <OutstandingBalancesTable 
                :students="dashboardStore.outstandingByStudent"
                :loading="dashboardStore.loading"
              />
              <AIInsights 
                :insights="aiInsights"
                :loading="dashboardStore.loading"
              />
            </div>
            
            <!-- Section 5: Owner-only -->
            <div v-if="isOwner" class="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
    </div>
  </div>
</template>