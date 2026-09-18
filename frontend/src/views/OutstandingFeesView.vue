<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useModuleLock } from '../composables/useModuleLock';
import ModuleLockOverlay from '../features/onboarding/ModuleLockOverlay.vue';
import CmButton from '../components/ui/CmButton.vue';
import CmSelect from '../components/ui/CmSelect.vue';
import ErrorState from '../components/ui/ErrorState.vue';
import EmptyState from '../components/ui/EmptyState.vue';
import SkeletonLoader from '../components/ui/SkeletonLoader.vue';
import { formatNairaKobo } from '../lib/ledgerSemantics';
import { buildLedgerSchoolReport, type OutstandingStudentRow } from '../lib/ledgerReportBuilder';

const router = useRouter();
const { paymentsLocked, requiresSetup, requiresKyc, requiresSettlement, loading: lockLoading } = useModuleLock();
const loading = ref(false);
const error = ref('');
const classFilter = ref('');
const outstandingData = ref<OutstandingStudentRow[]>([]);

const owingData = computed(() => outstandingData.value.filter((item) => item.outstandingMinor > 0));

const classNames = computed(() => {
  const names = new Set(outstandingData.value.map((item) => item.class_name).filter(Boolean));
  return Array.from(names).sort();
});

const classOptions = computed(() => [
  { value: '', label: 'All classes' },
  ...classNames.value.map((name) => ({ value: name, label: name })),
]);

const filteredData = computed(() => {
  if (!classFilter.value) return owingData.value;
  return owingData.value.filter((item) => item.class_name === classFilter.value);
});

const totalOutstandingMinor = computed(() => {
  return filteredData.value.reduce((sum, item) => sum + item.outstandingMinor, 0);
});

const loadOutstanding = async () => {
  loading.value = true;
  error.value = '';
  try {
    const report = await buildLedgerSchoolReport('demo-school');
    outstandingData.value = report.outstandingByStudent;
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load outstanding fees.';
    outstandingData.value = [];
  } finally {
    loading.value = false;
  }
};

const formatCsvValue = (value: string | number | null | undefined): string => {
  if (value === null || value === undefined) return '';
  const stringValue = String(value);
  if (/[,\n"]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
};

const downloadCsv = async () => {
  const rows: Array<Array<string | number>> = [
    ['Student', 'Admission', 'Class', 'Charges (₦)', 'Payments (₦)', 'Outstanding (₦)'],
    ...filteredData.value.map((item) => [
      item.student_name,
      item.admission_number,
      item.class_name,
      Number((item.assessedMinor / 100).toFixed(2)),
      Number((item.collectedMinor / 100).toFixed(2)),
      Number((item.outstandingMinor / 100).toFixed(2)),
    ]),
  ];
  const csvText = rows.map((row) => row.map(formatCsvValue).join(',')).join('\n');
  const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', 'outstanding_fees.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

onMounted(loadOutstanding);
</script>

<template>
  <main class="min-h-screen bg-background text-text-primary p-8 transition-colors duration-200">
    <ModuleLockOverlay v-if="requiresSetup && !lockLoading" variant="setup" />
    <ModuleLockOverlay v-else-if="requiresKyc && !lockLoading" variant="kyc" />
    <ModuleLockOverlay v-else-if="requiresSettlement && !lockLoading" variant="settlement" />
    <ModuleLockOverlay v-else-if="paymentsLocked && !lockLoading" variant="payment" />
    <template v-else>
      <div class="max-w-6xl mx-auto space-y-6">
        <section class="rounded-card bg-card p-8 shadow-card transition-colors duration-200">
          <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 class="text-headline mb-2 text-text-primary">Outstanding Fees</h1>
              <p class="text-text-muted">Drill down by class and student to see outstanding balances.</p>
              <nav class="mt-3 flex flex-wrap gap-2" aria-label="Reports sections">
                <RouterLink
                  :to="{ name: 'Reports' }"
                  class="rounded-button border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary"
                >
                  Reports Overview
                </RouterLink>
                <RouterLink
                  :to="{ name: 'DailyCollections' }"
                  class="rounded-button border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary"
                >
                  Daily Collections
                </RouterLink>
                <RouterLink
                  :to="{ name: 'OutstandingFees' }"
                  class="rounded-button border border-brand/20 bg-brand/10 px-3 py-1.5 text-xs font-medium text-brand"
                  aria-current="page"
                >
                  Outstanding Fees
                </RouterLink>
              </nav>
            </div>
            <CmButton
              @click="downloadCsv"
              :disabled="filteredData.length === 0"
              variant="primary"
            >
              Export CSV
            </CmButton>
          </div>
        </section>

        <ErrorState v-if="error" :description="error" @retry="loadOutstanding()" />
        <div v-else-if="loading" class="space-y-6">
          <SkeletonLoader type="metric" :count="1" />
          <SkeletonLoader type="table" :count="5" />
        </div>

        <template v-else>
          <section class="rounded-card bg-card p-8 shadow-card transition-colors duration-200">
            <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 class="text-headline mb-2 text-text-primary">Filter by class</h2>
                <CmSelect
                  v-model="classFilter"
                  :options="classOptions"
                  placeholder="All classes"
                  class="mt-2"
                />
              </div>
              <div class="text-right">
                <p class="text-sm text-text-muted">Total outstanding</p>
                <p class="text-3xl font-bold text-warning">{{ formatNairaKobo(totalOutstandingMinor) }}</p>
              </div>
            </div>
          </section>

          <section class="rounded-card bg-card p-8 shadow-card overflow-x-auto transition-colors duration-200">
            <h2 class="text-headline mb-4 text-text-primary">Students with outstanding balances</h2>
            <table class="w-full border-collapse text-left text-sm">
              <thead>
                <tr class="border-b border-divider text-text-muted">
                  <th class="py-3 text-xs font-bold uppercase tracking-wider">Student</th>
                  <th class="py-3 text-xs font-bold uppercase tracking-wider">Class</th>
                  <th class="py-3 text-xs font-bold uppercase tracking-wider">Charges</th>
                  <th class="py-3 text-xs font-bold uppercase tracking-wider">Payments</th>
                  <th class="py-3 text-xs font-bold uppercase tracking-wider">Outstanding</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="item in filteredData"
                  :key="item.student_id"
                  class="cursor-pointer border-b border-divider hover:bg-card/50 transition-colors"
                  @click="router.push({ name: 'StudentDetail', params: { id: item.student_id } })"
                >
                  <td class="py-3 font-bold uppercase text-text-primary">{{ item.student_name }}</td>
                  <td class="py-3 text-text-secondary">{{ item.class_name || '-' }}</td>
                  <td class="py-3 text-primary">{{ formatNairaKobo(item.assessedMinor) }}</td>
                  <td class="py-3 text-success">{{ formatNairaKobo(item.collectedMinor) }}</td>
                  <td class="py-3 font-semibold text-warning">
                    {{ formatNairaKobo(item.outstandingMinor) }}
                  </td>
                </tr>
                <tr v-if="filteredData.length === 0">
                  <td colspan="5" class="py-8 text-center text-text-muted">No outstanding balances found.</td>
                </tr>
              </tbody>
            </table>
            <EmptyState
              v-if="filteredData.length === 0"
              title="No outstanding balances"
              description="Students with a positive outstanding balance will appear here."
            />
          </section>
        </template>
      </div>
    </template>
  </main>
</template>