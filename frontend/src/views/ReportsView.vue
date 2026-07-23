<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ReportService } from '../shared/services/ReportService';
import CmButton from '../components/ui/CmButton.vue';

const DEFAULT_SCHOOL_ID = 'demo-school';
const loading = ref(false);
const report = ref({
  totalCharges: 0,
  totalPayments: 0,
  netBalance: 0,
  outstandingByStudent: [],
  recentPayments: [],
});

const formatCsvValue = (value) => {
  if (value === null || value === undefined) return '';
  const stringValue = String(value);
  if (/[,\n"]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
};

const downloadCsv = async (filename, rows) => {
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
  const rows = [
    ['Student', 'Class', 'Charges', 'Payments', 'Outstanding'],
    ...report.value.outstandingByStudent.map((item) => [
      item.student_name,
      item.class_name,
      item.totalCharges,
      item.totalPayments,
      item.outstanding,
    ]),
  ];
  await downloadCsv('outstanding_by_student.csv', rows);
};

const exportPayments = async () => {
  const rows = [
    ['Date', 'Student', 'Amount', 'Description'],
    ...report.value.recentPayments.map((payment) => [
      new Date(payment.created_at).toLocaleString(),
      payment.student_name,
      payment.amount,
      payment.entry_description || 'Payment recorded',
    ]),
  ];
  await downloadCsv('recent_payments.csv', rows);
};

const exportSummary = async () => {
  const rows = [
    ['Metric', 'Value'],
    ['Total charges', report.value.totalCharges],
    ['Total payments', report.value.totalPayments],
    ['Net balance', report.value.netBalance],
    ['Outstanding students', report.value.outstandingByStudent.length],
    ['Recent payments', report.value.recentPayments.length],
  ];
  await downloadCsv('fee_summary.csv', rows);
};

const loadReport = async () => {
  loading.value = true;
  report.value = await ReportService.getFeeDashboard(DEFAULT_SCHOOL_ID);
  loading.value = false;
};

onMounted(loadReport);
</script>

<template>
  <main class="min-h-screen bg-background text-text-primary p-8">
    <div class="max-w-6xl mx-auto space-y-6">
      <section class="rounded-card bg-card p-8 shadow-card flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 class="text-headline mb-2">Reports</h1>
          <p class="text-text-secondary">Fee-first financial summaries and collections reporting.</p>
        </div>
        <div class="flex flex-wrap gap-3">
          <CmButton @click="exportOutstanding" variant="primary">
            Export outstanding
          </CmButton>
          <CmButton @click="exportPayments" variant="success">
            Export payments
          </CmButton>
          <CmButton @click="exportSummary" variant="warning">
            Export summary
          </CmButton>
        </div>
      </section>

      <section class="grid gap-6 lg:grid-cols-3">
        <div class="rounded-card bg-card p-6 shadow-card">
          <p class="text-label">Total charges</p>
          <p class="mt-4 text-metric text-brand">₦{{ report.totalCharges }}</p>
        </div>
        <div class="rounded-card bg-card p-6 shadow-card">
          <p class="text-label">Total payments</p>
          <p class="mt-4 text-metric text-success">₦{{ report.totalPayments }}</p>
        </div>
        <div class="rounded-card bg-card p-6 shadow-card">
          <p class="text-label">Net balance</p>
          <p class="mt-4 text-metric text-warning">₦{{ report.netBalance }}</p>
        </div>
      </section>

      <section class="rounded-card bg-card p-8 shadow-card overflow-x-auto">
        <h2 class="text-headline mb-4">Outstanding by student</h2>
        <table class="w-full border-collapse text-left text-sm text-text-primary">
          <thead>
            <tr class="border-b border-divider text-text-muted">
              <th class="py-3">Student</th>
              <th class="py-3">Class</th>
              <th class="py-3">Charges</th>
              <th class="py-3">Payments</th>
              <th class="py-3">Outstanding</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in report.outstandingByStudent" :key="item.student_id" class="border-b border-divider hover:bg-surface/50">
              <td class="py-3">{{ item.student_name }}</td>
              <td class="py-3">{{ item.class_name }}</td>
              <td class="py-3">₦{{ item.totalCharges }}</td>
              <td class="py-3">₦{{ item.totalPayments }}</td>
              <td class="py-3">₦{{ item.outstanding }}</td>
            </tr>
            <tr v-if="report.outstandingByStudent.length === 0">
              <td colspan="5" class="py-8 text-center text-text-muted">No outstanding student balances yet.</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section class="rounded-card bg-card p-8 shadow-card">
        <h2 class="text-headline mb-4">Recent payments</h2>
        <div class="grid gap-3">
          <div v-for="payment in report.recentPayments" :key="payment.id" class="rounded-card border border-divider bg-surface p-4">
            <div class="flex items-center justify-between gap-4">
              <p class="font-semibold">{{ payment.student_name }}</p>
              <p class="text-brand">₦{{ payment.amount }}</p>
            </div>
            <p class="mt-2 text-text-secondary">{{ payment.entry_description || 'Payment recorded' }}</p>
            <p class="mt-2 text-xs text-text-muted">{{ new Date(payment.created_at).toLocaleString() }}</p>
          </div>
          <p v-if="report.recentPayments.length === 0" class="text-text-muted">No payments recorded yet.</p>
        </div>
      </section>
    </div>
  </main>
</template>