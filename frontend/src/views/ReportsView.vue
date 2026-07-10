<script setup>
import { ref, onMounted } from 'vue';
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
  <main class="min-h-screen bg-slate-950 text-white p-8">
    <div class="max-w-6xl mx-auto space-y-6">
      <section class="rounded-3xl bg-slate-900 p-8 shadow-xl flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 class="text-4xl font-semibold mb-2">Reports</h1>
          <p class="text-slate-400">Fee-first financial summaries and collections reporting.</p>
        </div>
        <div class="flex flex-wrap gap-3">
          <button @click="exportOutstanding" class="rounded-2xl bg-cyan-500 px-5 py-3 font-semibold text-slate-950 hover:bg-cyan-400">Export outstanding</button>
          <button @click="exportPayments" class="rounded-2xl bg-emerald-500 px-5 py-3 font-semibold text-slate-950 hover:bg-emerald-400">Export payments</button>
          <button @click="exportSummary" class="rounded-2xl bg-amber-500 px-5 py-3 font-semibold text-slate-950 hover:bg-amber-400">Export summary</button>
        </div>
      </section>

      <section class="grid gap-6 lg:grid-cols-3">
        <div class="rounded-3xl bg-slate-900 p-6 shadow-xl">
          <p class="text-sm uppercase tracking-[0.24em] text-slate-500">Total charges</p>
          <p class="mt-4 text-4xl font-bold text-cyan-400">₦{{ report.totalCharges }}</p>
        </div>
        <div class="rounded-3xl bg-slate-900 p-6 shadow-xl">
          <p class="text-sm uppercase tracking-[0.24em] text-slate-500">Total payments</p>
          <p class="mt-4 text-4xl font-bold text-emerald-400">₦{{ report.totalPayments }}</p>
        </div>
        <div class="rounded-3xl bg-slate-900 p-6 shadow-xl">
          <p class="text-sm uppercase tracking-[0.24em] text-slate-500">Net balance</p>
          <p class="mt-4 text-4xl font-bold text-amber-400">₦{{ report.netBalance }}</p>
        </div>
      </section>

      <section class="rounded-3xl bg-slate-900 p-8 shadow-xl overflow-x-auto">
        <h2 class="text-2xl font-semibold mb-4">Outstanding by student</h2>
        <table class="w-full border-collapse text-left text-sm text-slate-200">
          <thead>
            <tr class="border-b border-slate-700 text-slate-400">
              <th class="py-3">Student</th>
              <th class="py-3">Class</th>
              <th class="py-3">Charges</th>
              <th class="py-3">Payments</th>
              <th class="py-3">Outstanding</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in report.outstandingByStudent" :key="item.student_id" class="border-b border-slate-800 hover:bg-slate-950/50">
              <td class="py-3">{{ item.student_name }}</td>
              <td class="py-3">{{ item.class_name }}</td>
              <td class="py-3">₦{{ item.totalCharges }}</td>
              <td class="py-3">₦{{ item.totalPayments }}</td>
              <td class="py-3">₦{{ item.outstanding }}</td>
            </tr>
            <tr v-if="report.outstandingByStudent.length === 0">
              <td colspan="5" class="py-8 text-center text-slate-500">No outstanding student balances yet.</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section class="rounded-3xl bg-slate-900 p-8 shadow-xl">
        <h2 class="text-2xl font-semibold mb-4">Recent payments</h2>
        <div class="grid gap-3">
          <div v-for="payment in report.recentPayments" :key="payment.id" class="rounded-2xl border border-slate-800 bg-slate-950 p-4">
            <div class="flex items-center justify-between gap-4">
              <p class="font-semibold">{{ payment.student_name }}</p>
              <p class="text-cyan-400">₦{{ payment.amount }}</p>
            </div>
            <p class="mt-2 text-slate-400">{{ payment.entry_description || 'Payment recorded' }}</p>
            <p class="mt-2 text-xs text-slate-500">{{ new Date(payment.created_at).toLocaleString() }}</p>
          </div>
          <p v-if="report.recentPayments.length === 0" class="text-slate-500">No payments recorded yet.</p>
        </div>
      </section>
    </div>
  </main>
</template>
