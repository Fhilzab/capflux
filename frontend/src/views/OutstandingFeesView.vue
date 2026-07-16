<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { ReportService } from '../shared/services/ReportService';

const router = useRouter();
const DEFAULT_SCHOOL_ID = 'demo-school';
const loading = ref(false);
const classFilter = ref('');
const outstandingData = ref([]);

const classNames = computed(() => {
  const names = new Set(outstandingData.value.map((item) => item.class_name));
  return Array.from(names).sort();
});

const filteredData = computed(() => {
  if (!classFilter.value) return outstandingData.value;
  return outstandingData.value.filter((item) => item.class_name === classFilter.value);
});

const totalOutstanding = computed(() => {
  return filteredData.value.reduce((sum, item) => sum + item.outstanding, 0);
});

const loadOutstanding = async () => {
  loading.value = true;
  try {
    const report = await ReportService.getFeeDashboard(DEFAULT_SCHOOL_ID);
    outstandingData.value = report.outstandingByStudent;
  } catch (err) {
    console.error('Failed to load outstanding fees:', err);
  } finally {
    loading.value = false;
  }
};

const formatCsvValue = (value) => {
  if (value === null || value === undefined) return '';
  const stringValue = String(value);
  if (/[,\n"]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
};

const downloadCsv = async () => {
  const rows = [
    ['Student', 'Class', 'Charges (₦)', 'Payments (₦)', 'Outstanding (₦)'],
    ...filteredData.value.map((item) => [
      item.student_name,
      item.class_name,
      item.totalCharges,
      item.totalPayments,
      item.outstanding,
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
  <main class="min-h-screen bg-slate-950 text-white p-8">
    <div class="max-w-6xl mx-auto space-y-6">
      <section class="rounded-3xl bg-slate-900 p-8 shadow-xl">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 class="text-4xl font-semibold mb-2">Outstanding Fees</h1>
            <p class="text-slate-400">Drill down by class and student to see outstanding balances.</p>
          </div>
          <button
            @click="downloadCsv"
            :disabled="filteredData.length === 0"
            class="rounded-2xl bg-cyan-500 px-5 py-3 font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-50"
          >
            Export CSV
          </button>
        </div>
      </section>

      <section class="rounded-3xl bg-slate-900 p-8 shadow-xl">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 class="text-2xl font-semibold mb-2">Filter by class</h2>
            <select
              v-model="classFilter"
              class="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white"
            >
              <option value="">All classes</option>
              <option v-for="name in classNames" :key="name" :value="name">{{ name }}</option>
            </select>
          </div>
          <div class="text-right">
            <p class="text-sm text-slate-400">Total outstanding</p>
            <p class="text-3xl font-bold text-amber-400">₦{{ totalOutstanding.toLocaleString() }}</p>
          </div>
        </div>
      </section>

      <section class="rounded-3xl bg-slate-900 p-8 shadow-xl overflow-x-auto">
        <h2 class="text-2xl font-semibold mb-4">Students with outstanding balances</h2>
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
            <tr
              v-for="item in filteredData"
              :key="item.student_id"
              class="cursor-pointer border-b border-slate-800 hover:bg-slate-950/50"
              @click="router.push({ name: 'StudentDetail', params: { id: item.student_id } })"
            >
              <td class="py-3 font-semibold">{{ item.student_name }}</td>
              <td class="py-3">{{ item.class_name }}</td>
              <td class="py-3 text-cyan-400">₦{{ item.totalCharges.toLocaleString() }}</td>
              <td class="py-3 text-emerald-400">₦{{ item.totalPayments.toLocaleString() }}</td>
              <td class="py-3 font-semibold" :class="item.outstanding > 0 ? 'text-amber-400' : 'text-slate-400'">
                ₦{{ item.outstanding.toLocaleString() }}
              </td>
            </tr>
            <tr v-if="filteredData.length === 0">
              <td colspan="5" class="py-8 text-center text-slate-500">No outstanding balances found.</td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  </main>
</template>