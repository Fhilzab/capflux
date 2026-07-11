<script setup>
import { onMounted, ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useSyncStore } from '../stores/syncStore';
import { StudentService } from '../services/StudentService';
import { ReportService } from '../services/ReportService';

const router = useRouter();
const syncStore = useSyncStore();
const DEFAULT_SCHOOL_ID = 'demo-school';

const online = ref(typeof navigator !== 'undefined' ? navigator.onLine : true);
const studentCount = ref(0);
const reportSummary = ref({
  totalCharges: 0,
  totalPayments: 0,
  netBalance: 0,
  outstandingByStudent: [],
  recentPayments: [],
});
const loading = ref(true);

const outstandingStudentCount = computed(() => {
  return reportSummary.value.outstandingByStudent.filter(s => s.outstanding > 0).length;
});

const refreshDashboard = async () => {
  loading.value = true;
  try {
    const students = await StudentService.getStudentsBySchool(DEFAULT_SCHOOL_ID);
    studentCount.value = students.length;
    reportSummary.value = await ReportService.getFeeDashboard(DEFAULT_SCHOOL_ID);
    await syncStore.refreshStatus();
  } catch {
    // silently fail
  } finally {
    loading.value = false;
  }
};

const updateOnlineStatus = () => {
  online.value = typeof navigator !== 'undefined' ? navigator.onLine : true;
};

onMounted(async () => {
  await refreshDashboard();
  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
      updateOnlineStatus();
      refreshDashboard();
    });
    window.addEventListener('offline', updateOnlineStatus);
  }
});
</script>

<template>
  <main class="min-h-screen bg-slate-950 text-white p-8">
    <div class="max-w-6xl mx-auto space-y-6">
      <!-- Page header -->
      <section class="rounded-3xl bg-slate-900 p-8 shadow-xl">
        <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 class="text-4xl font-semibold">Dashboard</h1>
            <p class="text-slate-400 mt-2">School finance overview at a glance.</p>
          </div>
          <div class="flex items-center gap-3">
            <span class="flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-sm">
              <span class="h-2 w-2 rounded-full" :class="online ? 'bg-emerald-400' : 'bg-rose-400'"></span>
              <span class="text-slate-400">{{ online ? 'Online' : 'Offline' }}</span>
            </span>
            <button
              @click="refreshDashboard"
              class="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400"
            >
              Refresh
            </button>
          </div>
        </div>
      </section>

      <!-- Summary cards -->
      <section class="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div class="rounded-3xl bg-slate-900 p-6 shadow-xl">
          <p class="text-sm uppercase tracking-[0.24em] text-slate-500">Students</p>
          <p class="mt-4 text-4xl font-bold text-white">{{ studentCount }}</p>
          <p class="mt-2 text-sm text-slate-400">Registered locally</p>
        </div>
        <div class="rounded-3xl bg-slate-900 p-6 shadow-xl">
          <p class="text-sm uppercase tracking-[0.24em] text-slate-500">Total charges</p>
          <p class="mt-4 text-4xl font-bold text-cyan-400">₦{{ reportSummary.totalCharges.toLocaleString() }}</p>
          <p class="mt-2 text-sm text-slate-400">All time</p>
        </div>
        <div class="rounded-3xl bg-slate-900 p-6 shadow-xl">
          <p class="text-sm uppercase tracking-[0.24em] text-slate-500">Total payments</p>
          <p class="mt-4 text-4xl font-bold text-emerald-400">₦{{ reportSummary.totalPayments.toLocaleString() }}</p>
          <p class="mt-2 text-sm text-slate-400">All time</p>
        </div>
        <div class="rounded-3xl bg-slate-900 p-6 shadow-xl">
          <p class="text-sm uppercase tracking-[0.24em] text-slate-500">Outstanding</p>
          <p class="mt-4 text-4xl font-bold text-amber-400">₦{{ reportSummary.netBalance.toLocaleString() }}</p>
          <p class="mt-2 text-sm text-slate-400">{{ outstandingStudentCount }} students owe</p>
        </div>
      </section>

      <!-- Sync status + quick actions -->
      <section class="grid gap-6 lg:grid-cols-2">
        <div class="rounded-3xl bg-slate-900 p-8 shadow-xl">
          <h2 class="text-2xl font-semibold mb-4">Sync Status</h2>
          <div class="grid gap-4 sm:grid-cols-3 mb-6">
            <div class="rounded-2xl bg-slate-950 p-4 text-center">
              <p class="text-sm uppercase tracking-[0.24em] text-slate-400">Pending</p>
              <p class="mt-3 text-3xl font-semibold text-cyan-400">{{ syncStore.pendingCount }}</p>
            </div>
            <div class="rounded-2xl bg-slate-950 p-4 text-center">
              <p class="text-sm uppercase tracking-[0.24em] text-slate-400">Failed</p>
              <p class="mt-3 text-3xl font-semibold text-amber-400">{{ syncStore.failedCount }}</p>
            </div>
            <div class="rounded-2xl bg-slate-950 p-4 text-center">
              <p class="text-sm uppercase tracking-[0.24em] text-slate-400">Last sync</p>
              <p class="mt-3 text-sm font-semibold text-slate-300">{{ syncStore.lastSyncedAt ? new Date(syncStore.lastSyncedAt).toLocaleTimeString() : 'Never' }}</p>
            </div>
          </div>
          <button
            @click="router.push({ name: 'Sync' })"
            class="rounded-2xl bg-cyan-500 px-5 py-3 font-semibold text-slate-950 hover:bg-cyan-400"
          >
            Open Sync Center
          </button>
        </div>

        <div class="rounded-3xl bg-slate-900 p-8 shadow-xl">
          <h2 class="text-2xl font-semibold mb-4">Quick Actions</h2>
          <div class="grid gap-3">
            <button
              @click="router.push({ name: 'Students' })"
              class="flex items-center gap-3 rounded-2xl bg-slate-950 p-4 text-left hover:bg-slate-800 transition-colors"
            >
              <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400">
                <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/></svg>
              </div>
              <div>
                <p class="font-semibold text-white">Register a student</p>
                <p class="text-sm text-slate-400">Add a new student to the local store</p>
              </div>
            </button>
            <button
              @click="router.push({ name: 'Billing' })"
              class="flex items-center gap-3 rounded-2xl bg-slate-950 p-4 text-left hover:bg-slate-800 transition-colors"
            >
              <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
                <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z"/></svg>
              </div>
              <div>
                <p class="font-semibold text-white">Record a charge</p>
                <p class="text-sm text-slate-400">Add a billing charge for a student</p>
              </div>
            </button>
            <button
              @click="router.push({ name: 'Payments' })"
              class="flex items-center gap-3 rounded-2xl bg-slate-950 p-4 text-left hover:bg-slate-800 transition-colors"
            >
              <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400">
                <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
              </div>
              <div>
                <p class="font-semibold text-white">Record a payment</p>
                <p class="text-sm text-slate-400">Log a payment received from a guardian</p>
              </div>
            </button>
          </div>
        </div>
      </section>

      <!-- Recent payments -->
      <section class="rounded-3xl bg-slate-900 p-8 shadow-xl">
        <div class="flex items-center justify-between mb-6">
          <div>
            <h2 class="text-2xl font-semibold">Recent Payments</h2>
            <p class="text-slate-400">Latest payment transactions recorded locally.</p>
          </div>
          <button
            @click="router.push({ name: 'Reports' })"
            class="rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
          >
            View Reports
          </button>
        </div>
        <div v-if="reportSummary.recentPayments.length === 0" class="rounded-2xl bg-slate-950 p-6 text-center text-slate-500">
          No payments recorded yet.
        </div>
        <div v-else class="grid gap-3">
          <div
            v-for="payment in reportSummary.recentPayments.slice(0, 5)"
            :key="payment.id"
            class="flex items-center justify-between rounded-2xl bg-slate-950 p-4"
          >
            <div>
              <p class="font-semibold text-white">{{ payment.student_name }}</p>
              <p class="text-sm text-slate-400">{{ payment.entry_description || 'Payment received' }}</p>
            </div>
            <div class="text-right">
              <p class="text-lg font-semibold text-emerald-400">₦{{ Number(payment.amount).toLocaleString() }}</p>
              <p class="text-xs text-slate-500">{{ new Date(payment.created_at).toLocaleDateString() }}</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  </main>
</template>