<script setup>
import { ref, onMounted, computed } from 'vue';
import { ReportService } from '../shared/services/ReportService';
import CmButton from '../components/ui/CmButton.vue';

const DEFAULT_SCHOOL_ID = 'demo-school';
const loading = ref(false);
const startDate = ref('');
const endDate = ref('');
const collections = ref([]);

const totalCollected = computed(() => {
  return collections.value.reduce((sum, item) => sum + item.total, 0);
});

const loadCollections = async () => {
  loading.value = true;
  try {
    const result = await ReportService.getDailyCollections(
      DEFAULT_SCHOOL_ID,
      startDate.value || null,
      endDate.value || null
    );
    collections.value = result;
  } catch (err) {
    console.error('Failed to load daily collections:', err);
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
    ['Date', 'Payments Count', 'Total Collected (₦)'],
    ...collections.map((item) => [
      item.date,
      item.count,
      item.total,
    ]),
  ];
  const csvText = rows.map((row) => row.map(formatCsvValue).join(',')).join('\n');
  const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', 'daily_collections.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

onMounted(loadCollections);
</script>

<template>
  <main class="min-h-screen bg-background text-text-primary p-8 transition-colors duration-200">
    <div class="max-w-6xl mx-auto space-y-6">
      <section class="rounded-card bg-card p-8 shadow-card transition-colors duration-200">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 class="text-4xl font-semibold mb-2 text-text-primary">Daily Collections</h1>
            <p class="text-text-muted">View payments collected per day with date range filtering.</p>
          </div>
          <CmButton
            @click="downloadCsv"
            :disabled="collections.length === 0"
            variant="primary"
          >
            Export CSV
          </CmButton>
        </div>
      </section>

      <section class="rounded-card bg-card p-8 shadow-card transition-colors duration-200">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div class="grid gap-4 sm:grid-cols-2">
            <label class="block">
              <span class="text-sm text-text-muted">Start date</span>
              <input
                v-model="startDate"
                type="date"
                class="mt-2 w-full rounded-button border border-border bg-surface px-4 py-3 text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-glow transition-shadow"
              />
            </label>
            <label class="block">
              <span class="text-sm text-text-muted">End date</span>
              <input
                v-model="endDate"
                type="date"
                class="mt-2 w-full rounded-button border border-border bg-surface px-4 py-3 text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-glow transition-shadow"
              />
            </label>
          </div>
          <CmButton @click="loadCollections" variant="primary">
            Filter
          </CmButton>
        </div>
      </section>

      <section class="rounded-card bg-card p-8 shadow-card transition-colors duration-200">
        <h2 class="text-2xl font-semibold mb-4 text-text-primary">Total collected</h2>
        <p class="text-5xl font-bold text-success">₦{{ totalCollected.toLocaleString() }}</p>
        <p class="mt-2 text-text-muted">{{ collections.length }} days with payments</p>
      </section>

      <section class="rounded-card bg-card p-8 shadow-card overflow-x-auto transition-colors duration-200">
        <h2 class="text-2xl font-semibold mb-4 text-text-primary">Collections by day</h2>
        <table class="w-full border-collapse text-left text-sm">
          <thead>
            <tr class="border-b border-divider text-text-muted">
              <th class="py-3 text-xs font-bold uppercase tracking-wider">Date</th>
              <th class="py-3 text-xs font-bold uppercase tracking-wider">Payments</th>
              <th class="py-3 text-xs font-bold uppercase tracking-wider">Total collected</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in collections" :key="item.date" class="border-b border-divider hover:bg-card/50 transition-colors">
              <td class="py-3 text-text-secondary">{{ item.date }}</td>
              <td class="py-3 text-text-secondary">{{ item.count }}</td>
              <td class="py-3 font-semibold text-success">₦{{ item.total.toLocaleString() }}</td>
            </tr>
            <tr v-if="collections.length === 0">
              <td colspan="3" class="py-8 text-center text-text-muted">No collections found for the selected period.</td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  </main>
</template>