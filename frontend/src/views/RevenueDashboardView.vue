<script setup>
import { ref, onMounted, computed } from 'vue';
import { ReportService } from '../services/ReportService';

const DEFAULT_SCHOOL_ID = 'demo-school';
const loading = ref(false);
const report = ref({
  totalCharges: 0,
  totalPayments: 0,
  netBalance: 0,
  outstandingByStudent: [],
  recentPayments: [],
});

const collectionRate = computed(() => {
  if (report.value.totalCharges === 0) return 0;
  return Math.round((report.value.totalPayments / report.value.totalCharges) * 100);
});

const outstandingCount = computed(() => {
  return report.value.outstandingByStudent.filter((s) => s.outstanding > 0).length;
});

const loadReport = async () => {
  loading.value = true;
  try {
    report.value = await ReportService.getFeeDashboard(DEFAULT_SCHOOL_ID);
  } catch (err) {
    console.error('Failed to load revenue dashboard:', err);
  } finally {
    loading.value = false;
  }
};

onMounted(loadReport);
</script>

<template>
  <main class="min-h-screen bg-slate-950 text-white p-8">
    <div class="max-w-6xl mx-auto space-y-6">
      <section class="rounded-3xl bg-slate-900 p-8 shadow-xl">
        <h1 class="text-4xl font-semibold mb-2">Revenue Dashboard</h1>
        <p class="text-slate-400">High-level revenue metrics and financial health indicators.</p>
      </section>

      <!-- KPI cards -->
      <section class="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div class="rounded-3xl bg-slate-900 p-6 shadow-xl">
          <p class="text-sm uppercase tracking-[0.24em] text-slate-500">Total charges</p>
          <p class="mt-4 text-3xl font-bold text-cyan-400">₦{{ report.totalCharges.toLocaleString() }}</p>
          <p class="mt-2 text-sm text-slate-400">All fees billed</p>
        </div>
        <div class="rounded-3xl bg-slate-900 p-6 shadow-xl">
          <p class="text-sm uppercase tracking-[0.24em] text-slate-500">Total collected</p>
          <p class="mt-4 text-3xl font-bold text-emerald-400">₦{{ report.totalPayments.toLocaleString() }}</p>
          <p class="mt-2 text-sm text-slate-400">Payments received</p>
        </div>
        <div class="rounded-3xl bg-slate-900 p-6 shadow-xl">
          <p class="text-sm uppercase tracking-[0.24em] text-slate-500">Collection rate</p>
          <p class="mt-4 text-3xl font-bold" :class="collectionRate >= 50 ? 'text-emerald-400' : 'text-amber-400'">
            {{ collectionRate }}%
          </p>
          <p class="mt-2 text-sm text-slate-400">Of total charges collected</p>
        </div>
        <div class="rounded-3xl bg-slate-900 p-6 shadow-xl">
          <p class="text-sm uppercase tracking-[0.24em] text-slate-500">Outstanding</p>
          <p class="mt-4 text-3xl font-bold text-amber-400">₦{{ report.netBalance.toLocaleString() }}</p>
          <p class="mt-2 text-sm text-slate-400">{{ outstandingCount }} students owe</p>
        </div>
      </section>

      <!-- Visual bar chart (CSS-based) -->
      <section class="rounded-3xl bg-slate-900 p-8 shadow-xl">
        <h2 class="text-2xl font-semibold mb-6">Revenue Overview</h2>
        <div class="space-y-4">
          <div>
            <div class="flex items-center justify-between mb-2">
              <p class="text-sm text-slate-400">Charges</p>
              <p class="text-sm font-semibold text-cyan-400">₦{{ report.totalCharges.toLocaleString() }}</p>
            </div>
            <div class="h-4 w-full rounded-full bg-slate-800 overflow-hidden">
              <div
                class="h-full rounded-full bg-cyan-500 transition-all duration-500"
                :style="{ width: '100%' }"
              ></div>
            </div>
          </div>
          <div>
            <div class="flex items-center justify-between mb-2">
              <p class="text-sm text-slate-400">Collected</p>
              <p class="text-sm font-semibold text-emerald-400">₦{{ report.totalPayments.toLocaleString() }}</p>
            </div>
            <div class="h-4 w-full rounded-full bg-slate-800 overflow-hidden">
              <div
                class="h-full rounded-full bg-emerald-500 transition-all duration-500"
                :style="{ width: collectionRate + '%' }"
              ></div>
            </div>
          </div>
          <div>
            <div class="flex items-center justify-between mb-2">
              <p class="text-sm text-slate-400">Outstanding</p>
              <p class="text-sm font-semibold text-amber-400">₦{{ report.netBalance.toLocaleString() }}</p>
            </div>
            <div class="h-4 w-full rounded-full bg-slate-800 overflow-hidden">
              <div
                class="h-full rounded-full bg-amber-500 transition-all duration-500"
                :style="{ width: (100 - collectionRate) + '%' }"
              ></div>
            </div>
          </div>
        </div>
      </section>

      <!-- Summary table -->
      <section class="rounded-3xl bg-slate-900 p-8 shadow-xl">
        <h2 class="text-2xl font-semibold mb-4">Financial Summary</h2>
        <div class="grid gap-4 sm:grid-cols-2">
          <div class="rounded-2xl bg-slate-950 p-4">
            <p class="text-sm text-slate-400">Total students</p>
            <p class="mt-2 text-2xl font-bold">{{ report.outstandingByStudent.length }}</p>
          </div>
          <div class="rounded-2xl bg-slate-950 p-4">
            <p class="text-sm text-slate-400">Students with outstanding</p>
            <p class="mt-2 text-2xl font-bold text-amber-400">{{ outstandingCount }}</p>
          </div>
          <div class="rounded-2xl bg-slate-950 p-4">
            <p class="text-sm text-slate-400">Average per student (charges)</p>
            <p class="mt-2 text-2xl font-bold text-cyan-400">
              ₦{{ report.outstandingByStudent.length > 0
                ? Math.round(report.totalCharges / report.outstandingByStudent.length).toLocaleString()
                : 0 }}
            </p>
          </div>
          <div class="rounded-2xl bg-slate-950 p-4">
            <p class="text-sm text-slate-400">Average per student (outstanding)</p>
            <p class="mt-2 text-2xl font-bold text-amber-400">
              ₦{{ outstandingCount > 0
                ? Math.round(report.netBalance / outstandingCount).toLocaleString()
                : 0 }}
            </p>
          </div>
        </div>
      </section>
    </div>
  </main>
</template>