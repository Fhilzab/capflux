<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { ReportService } from '../shared/services/ReportService';

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
  <main class="min-h-screen bg-background text-text-primary p-8">
    <div class="max-w-6xl mx-auto space-y-6">
      <section class="rounded-card bg-card p-8 shadow-card">
        <h1 class="text-headline mb-2">Revenue Dashboard</h1>
        <p class="text-text-secondary">High-level revenue metrics and financial health indicators.</p>
      </section>

      <!-- KPI cards -->
      <section class="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div class="rounded-card bg-card p-6 shadow-card">
          <p class="text-label">Total charges</p>
          <p class="mt-4 text-3xl font-bold text-brand">₦{{ report.totalCharges.toLocaleString() }}</p>
          <p class="mt-2 text-sm text-text-secondary">All fees billed</p>
        </div>
        <div class="rounded-card bg-card p-6 shadow-card">
          <p class="text-label">Total collected</p>
          <p class="mt-4 text-3xl font-bold text-success">₦{{ report.totalPayments.toLocaleString() }}</p>
          <p class="mt-2 text-sm text-text-secondary">Payments received</p>
        </div>
        <div class="rounded-card bg-card p-6 shadow-card">
          <p class="text-label">Collection rate</p>
          <p class="mt-4 text-3xl font-bold" :class="collectionRate >= 50 ? 'text-success' : 'text-warning'">
            {{ collectionRate }}%
          </p>
          <p class="mt-2 text-sm text-text-secondary">Of total charges collected</p>
        </div>
        <div class="rounded-card bg-card p-6 shadow-card">
          <p class="text-label">Outstanding</p>
          <p class="mt-4 text-3xl font-bold text-warning">₦{{ report.netBalance.toLocaleString() }}</p>
          <p class="mt-2 text-sm text-text-secondary">{{ outstandingCount }} students owe</p>
        </div>
      </section>

      <!-- Visual bar chart (CSS-based) -->
      <section class="rounded-card bg-card p-8 shadow-card">
        <h2 class="text-headline mb-6">Revenue Overview</h2>
        <div class="space-y-4">
          <div>
            <div class="flex items-center justify-between mb-2">
              <p class="text-sm text-text-secondary">Charges</p>
              <p class="text-sm font-semibold text-brand">₦{{ report.totalCharges.toLocaleString() }}</p>
            </div>
            <div class="h-4 w-full rounded-full bg-surface overflow-hidden">
              <div
                class="h-full rounded-full bg-brand transition-all duration-500"
                :style="{ width: '100%' }"
              ></div>
            </div>
          </div>
          <div>
            <div class="flex items-center justify-between mb-2">
              <p class="text-sm text-text-secondary">Collected</p>
              <p class="text-sm font-semibold text-success">₦{{ report.totalPayments.toLocaleString() }}</p>
            </div>
            <div class="h-4 w-full rounded-full bg-surface overflow-hidden">
              <div
                class="h-full rounded-full bg-success transition-all duration-500"
                :style="{ width: collectionRate + '%' }"
              ></div>
            </div>
          </div>
          <div>
            <div class="flex items-center justify-between mb-2">
              <p class="text-sm text-text-secondary">Outstanding</p>
              <p class="text-sm font-semibold text-warning">₦{{ report.netBalance.toLocaleString() }}</p>
            </div>
            <div class="h-4 w-full rounded-full bg-surface overflow-hidden">
              <div
                class="h-full rounded-full bg-warning transition-all duration-500"
                :style="{ width: (100 - collectionRate) + '%' }"
              ></div>
            </div>
          </div>
        </div>
      </section>

      <!-- Summary table -->
      <section class="rounded-card bg-card p-8 shadow-card">
        <h2 class="text-headline mb-4">Financial Summary</h2>
        <div class="grid gap-4 sm:grid-cols-2">
          <div class="rounded-card bg-surface p-4">
            <p class="text-sm text-text-secondary">Total students</p>
            <p class="mt-2 text-2xl font-bold">{{ report.outstandingByStudent.length }}</p>
          </div>
          <div class="rounded-card bg-surface p-4">
            <p class="text-sm text-text-secondary">Students with outstanding</p>
            <p class="mt-2 text-2xl font-bold text-warning">{{ outstandingCount }}</p>
          </div>
          <div class="rounded-card bg-surface p-4">
            <p class="text-sm text-text-secondary">Average per student (charges)</p>
            <p class="mt-2 text-2xl font-bold text-brand">
              ₦{{ report.outstandingByStudent.length > 0
                ? Math.round(report.totalCharges / report.outstandingByStudent.length).toLocaleString()
                : 0 }}
            </p>
          </div>
          <div class="rounded-card bg-surface p-4">
            <p class="text-sm text-text-secondary">Average per student (outstanding)</p>
            <p class="mt-2 text-2xl font-bold text-warning">
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