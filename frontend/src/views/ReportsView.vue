<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import CmButton from '../components/ui/CmButton.vue';
import ErrorState from '../components/ui/ErrorState.vue';
import EmptyState from '../components/ui/EmptyState.vue';
import SkeletonLoader from '../components/ui/SkeletonLoader.vue';
import { formatNairaKobo } from '../lib/ledgerSemantics';
import { buildLedgerSchoolReport, type LedgerSchoolReport } from '../lib/ledgerReportBuilder';
import { useSchoolStore } from '../stores/schoolStore';
import { useModuleLock } from '../composables/useModuleLock';
import ModuleLockOverlay from '../features/onboarding/ModuleLockOverlay.vue';
import { usePermission } from '../shared/rbac/usePermission';
import { PERMISSIONS } from '../shared/rbac/permissions';

const schoolStore = useSchoolStore();
const { showLock, lockReason, canAccessFinancials } = useModuleLock();
const { can } = usePermission();

/** Separate export capability: viewing a report never implies export rights. */
const canExport = ref(false);

/** Authenticated school context — the only tenant scope for the report. */
const schoolId = computed(() => schoolStore.currentSchoolId);
const loading = ref(false);
const error = ref('');
const report = ref<LedgerSchoolReport | null>(null);

const formatCsvValue = (value: string | number | null | undefined): string => {
  if (value === null || value === undefined) return '';
  const stringValue = String(value);
  if (/[,\n"]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
};

const downloadCsv = async (filename: string, rows: Array<Array<string | number>>) => {
  const csvText = rows.map((row) => row.map(formatCsvValue).join(',')).join('\n');
  const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const exportOutstanding = async () => {
  if (!report.value || !canExport.value) return;
  const rows: Array<Array<string | number>> = [
    ['Student', 'Admission number', 'Class', 'Charges (₦)', 'Payments (₦)', 'Outstanding (₦)'],
    ...report.value.outstandingByStudent.map((item) => [
      item.student_name,
      item.admission_number,
      item.class_name,
      Number((item.assessedMinor / 100).toFixed(2)),
      Number((item.collectedMinor / 100).toFixed(2)),
      Number((item.outstandingMinor / 100).toFixed(2)),
    ]),
  ];
  await downloadCsv('outstanding_by_student.csv', rows);
};

const exportPayments = async () => {
  if (!report.value || !canExport.value) return;
  const rows: Array<Array<string | number>> = [
    ['Date', 'Student', 'Amount (₦)', 'Description'],
    ...report.value.recentPayments.map((payment) => [
      payment.occurred_at ? new Date(payment.occurred_at).toLocaleString() : '',
      payment.student_name,
      Number((payment.amount_minor / 100).toFixed(2)),
      payment.entry_description || 'Payment recorded',
    ]),
  ];
  await downloadCsv('recent_payments.csv', rows);
};

const exportSummary = async () => {
  if (!report.value || !canExport.value) return;
  const rows: Array<Array<string | number>> = [
    ['Metric', 'Value'],
    ['Total charges (₦)', Number((report.value.assessedMinor / 100).toFixed(2))],
    ['Total payments (₦)', Number((report.value.collectedMinor / 100).toFixed(2))],
    ['Outstanding balance (₦)', Number((report.value.outstandingMinor / 100).toFixed(2))],
    ['Students with balances', report.value.studentCount],
    ['Students owing', report.value.outstandingCount],
    ['Payments recorded', report.value.paymentCount],
  ];
  await downloadCsv('fee_summary.csv', rows);
};

const loadReport = async () => {
  // Financial gate: never build the school report while the module is locked
  // (or while activation is still resolving).
  if (!canAccessFinancials.value) {
    loading.value = false;
    return;
  }
  loading.value = true;
  error.value = '';
  try {
    const id = schoolId.value;
    if (!id) {
      error.value = schoolStore.error || 'School context is unavailable. Please retry.';
      report.value = null;
      return;
    }
    report.value = await buildLedgerSchoolReport(id);
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to build the fee report.';
    report.value = null;
  } finally {
    loading.value = false;
  }
};

onMounted(async () => {
  canExport.value = await can(PERMISSIONS.REPORT.EXPORT);
  if (canAccessFinancials.value) {
    void loadReport();
  }
});

// Activation may resolve after mount (stores load async): fetch once granted.
watch(canAccessFinancials, (granted) => {
  if (granted && !report.value && !loading.value) {
    void loadReport();
  }
});
</script>

<template>
  <main class="min-h-screen bg-background text-text-primary p-4 sm:p-8">
    <ModuleLockOverlay v-if="showLock" :variant="lockReason ?? 'setup'" />
    <div v-else-if="canAccessFinancials" class="max-w-6xl mx-auto space-y-6">
      <section class="rounded-card bg-card p-8 shadow-card flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 class="text-headline mb-2">Reports &amp; Analytics</h1>
          <p class="text-text-secondary">What do the school's financial records show? Read-only summaries, collections and exports.</p>
          <nav class="mt-3 flex flex-wrap gap-2" aria-label="Reports sections">
            <RouterLink
              :to="{ name: 'Reports' }"
              class="rounded-button border border-brand/20 bg-brand/10 px-3 py-1.5 text-xs font-medium text-brand"
              aria-current="page"
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
              class="rounded-button border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary"
            >
              Outstanding Fees
            </RouterLink>
            <RouterLink
              :to="{ name: 'RevenueDashboard' }"
              class="rounded-button border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary"
            >
              Revenue
            </RouterLink>
          </nav>
        </div>
        <div class="flex flex-wrap gap-3">
          <CmButton @click="exportOutstanding" variant="primary" :disabled="!report || !canExport">
            Export outstanding
          </CmButton>
          <CmButton @click="exportPayments" variant="success" :disabled="!report || !canExport">
            Export payments
          </CmButton>
          <CmButton @click="exportSummary" variant="warning" :disabled="!report || !canExport">
            Export summary
          </CmButton>
        </div>
      </section>

      <ErrorState v-if="error" :description="error" @retry="loadReport()" />
      <div v-else-if="loading" class="space-y-6">
        <div class="grid gap-6 lg:grid-cols-3">
          <SkeletonLoader type="metric" :count="3" />
        </div>
        <SkeletonLoader type="table" :count="5" />
      </div>

      <template v-else-if="report">
        <section class="grid gap-6 lg:grid-cols-3">
          <div class="rounded-card bg-card p-6 shadow-card">
            <p class="text-label">Total charges</p>
            <p class="mt-4 text-metric text-brand">{{ formatNairaKobo(report.assessedMinor) }}</p>
          </div>
          <div class="rounded-card bg-card p-6 shadow-card">
            <p class="text-label">Total payments</p>
            <p class="mt-4 text-metric text-success">{{ formatNairaKobo(report.collectedMinor) }}</p>
          </div>
          <div class="rounded-card bg-card p-6 shadow-card">
            <p class="text-label">Outstanding balance</p>
            <p class="mt-4 text-metric text-warning">{{ formatNairaKobo(report.outstandingMinor) }}</p>
          </div>
        </section>

        <section class="rounded-card bg-card p-8 shadow-card overflow-x-auto">
          <h2 class="text-headline mb-4">Outstanding by student</h2>
          <table class="w-full border-collapse text-left text-sm text-text-primary">
            <thead>
              <tr class="border-b border-divider text-text-muted">
                <th class="py-3">Student</th>
                <th class="py-3">Admission</th>
                <th class="py-3">Class</th>
                <th class="py-3">Charges</th>
                <th class="py-3">Payments</th>
                <th class="py-3">Outstanding</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in report.outstandingByStudent" :key="item.student_id" class="border-b border-divider hover:bg-surface/50">
                <td class="py-3">{{ item.student_name }}</td>
                <td class="py-3">{{ item.admission_number || '-' }}</td>
                <td class="py-3">{{ item.class_name || '-' }}</td>
                <td class="py-3">{{ formatNairaKobo(item.assessedMinor) }}</td>
                <td class="py-3">{{ formatNairaKobo(item.collectedMinor) }}</td>
                <td class="py-3 font-semibold text-warning">{{ formatNairaKobo(item.outstandingMinor) }}</td>
              </tr>
              <tr v-if="report.outstandingByStudent.length === 0">
                <td colspan="6" class="py-8 text-center text-text-muted">No student balances yet.</td>
              </tr>
            </tbody>
          </table>
          <EmptyState
            v-if="report.outstandingByStudent.length === 0"
            title="No outstanding balances"
            description="Charges and payments recorded in the ledger will appear here."
          />
        </section>

        <section class="rounded-card bg-card p-8 shadow-card">
          <h2 class="text-headline mb-4">Recent payments</h2>
          <div class="grid gap-3">
            <div v-for="payment in report.recentPayments" :key="payment.id" class="rounded-card border border-divider bg-surface p-4">
              <div class="flex items-center justify-between gap-4">
                <p class="font-semibold">{{ payment.student_name }}</p>
                <p class="text-brand">{{ formatNairaKobo(payment.amount_minor) }}</p>
              </div>
              <p class="mt-2 text-text-secondary">{{ payment.entry_description || 'Payment recorded' }}</p>
              <p v-if="payment.occurred_at" class="mt-2 text-xs text-text-muted">{{ new Date(payment.occurred_at).toLocaleString() }}</p>
            </div>
            <EmptyState
              v-if="report.recentPayments.length === 0"
              title="No payments recorded yet"
              description="Confirmed payment credits will appear here."
            />
          </div>
        </section>
      </template>
    </div>
    <div v-else class="max-w-6xl mx-auto space-y-6" aria-label="Checking financial access">
      <SkeletonLoader type="metric" :count="3" />
      <SkeletonLoader type="table" :count="5" />
    </div>
  </main>
</template>