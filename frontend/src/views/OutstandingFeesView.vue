<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useReportingStore } from '../stores/reportingStore';
import { useModuleLock } from '../composables/useModuleLock';
import ModuleLockOverlay from '../features/onboarding/ModuleLockOverlay.vue';
import CmButton from '../components/ui/CmButton.vue';

const router = useRouter();
const DEFAULT_SCHOOL_ID = 'demo-school';
const reportingStore = useReportingStore();
const { paymentsLocked, loading: lockLoading } = useModuleLock();
const loading = ref(false);
const classFilter = ref('');
const outstandingData = ref([]) as any;

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
    const filter = {
      organizationId: DEFAULT_SCHOOL_ID,
      schoolId: DEFAULT_SCHOOL_ID,
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
    };
    await reportingStore.loadStudentStatement('', filter);
    const statement = reportingStore.studentStatements[''];
    if (statement) {
      const lines = (statement as any).lines || [];
      outstandingData.value = lines.map((line: any) => ({
        student_id: line.studentId || '',
        student_name: line.studentName || 'Unknown',
        class_name: '',
        totalCharges: line.totalCharges,
        totalPayments: line.totalPayments,
        outstanding: line.balance,
      }));
    }
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
  <main class="min-h-screen bg-background text-text-primary p-8 transition-colors duration-200">
    <ModuleLockOverlay v-if="paymentsLocked && !lockLoading" variant="payment" />
    <template v-else>
    <div class="max-w-6xl mx-auto space-y-6">
      <section class="rounded-card bg-card p-8 shadow-card transition-colors duration-200">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 class="text-4xl font-semibold mb-2 text-text-primary">Outstanding Fees</h1>
            <p class="text-text-muted">Drill down by class and student to see outstanding balances.</p>
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

      <section class="rounded-card bg-card p-8 shadow-card transition-colors duration-200">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 class="text-2xl font-semibold mb-2 text-text-primary">Filter by class</h2>
            <select
              v-model="classFilter"
              class="rounded-button border border-border bg-surface px-4 py-3 text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-glow transition-shadow"
            >
              <option value="">All classes</option>
              <option v-for="name in classNames" :key="name" :value="name">{{ name }}</option>
            </select>
          </div>
          <div class="text-right">
            <p class="text-sm text-text-muted">Total outstanding</p>
            <p class="text-3xl font-bold text-warning">₦{{ totalOutstanding.toLocaleString() }}</p>
          </div>
        </div>
      </section>

      <section class="rounded-card bg-card p-8 shadow-card overflow-x-auto transition-colors duration-200">
        <h2 class="text-2xl font-semibold mb-4 text-text-primary">Students with outstanding balances</h2>
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
              <td class="py-3 text-text-secondary">{{ item.class_name }}</td>
              <td class="py-3 text-primary">₦{{ item.totalCharges.toLocaleString() }}</td>
              <td class="py-3 text-success">₦{{ item.totalPayments.toLocaleString() }}</td>
              <td class="py-3 font-semibold" :class="item.outstanding > 0 ? 'text-warning' : 'text-text-muted'">
                ₦{{ item.outstanding.toLocaleString() }}
              </td>
            </tr>
            <tr v-if="filteredData.length === 0">
              <td colspan="5" class="py-8 text-center text-text-muted">No outstanding balances found.</td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
    </template>
  </main>
</template>