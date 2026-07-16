<script setup>
import { ref, onMounted, computed } from 'vue';
import { ReportService } from '../shared/services/ReportService';

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
  <main class="min-h-screen bg-slate-950 text-white p-8">
    <div class="max-w-6xl mx-auto space-y-6">
      <section class="rounded-3xl bg-slate-900 p-8 shadow-xl">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 class="text-4xl font-semibold mb-2">Daily Collections</h1>
            <p class="text-slate-400">View payments collected per day with date range filtering.</p>
          </div>
          <button
            @click="downloadCsv"
            :disabled="collections.length === 0"
            class="rounded-2xl bg-cyan-500 px-5 py-3 font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-50"
          >
            Export CSV
          </button>
        </div>
      </section>

      <section class="rounded-3xl bg-slate-900 p-8 shadow-xl">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div class="grid gap-4 sm:grid-cols-2">
            <label class="block">
              <span class="text-sm text-slate-400">Start date</span>
              <input
                v-model="startDate"
                type="date"
                class="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white"
              />
            </label>
            <label class="block">
              <span class="text-sm text-slate-400">End date</span>
              <input
                v-model="endDate"
                type="date"
                class="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white"
              />
            </label>
          </div>
          <button
            @click="loadCollections"
            class="rounded-xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-400"
          >
            Filter
          </button>
        </div>
      </section>

      <section class="rounded-3xl bg-slate-900 p-8 shadow-xl">
        <h2 class="text-2xl font-semibold mb-4">Total collected</h2>
        <p class="text-5xl font-bold text-emerald-400">₦{{ totalCollected.toLocaleString() }}</p>
        <p class="mt-2 text-slate-400">{{ collections.length }} days with payments</p>
      </section>

      <section class="rounded-3xl bg-slate-900 p-8 shadow-xl overflow-x-auto">
        <h2 class="text-2xl font-semibold mb-4">Collections by day</h2>
        <table class="w-full border-collapse text-left text-sm text-slate-200">
          <thead>
            <tr class="border-b border-slate-700 text-slate-400">
              <th class="py-3">Date</th>
              <th class="py-3">Payments</th>
              <th class="py-3">Total collected</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in collections" :key="item.date" class="border-b border-slate-800 hover:bg-slate-950/50">
              <td class="py-3">{{ item.date }}</td>
              <td class="py-3">{{ item.count }}</td>
              <td class="py-3 font-semibold text-emerald-400">₦{{ item.total.toLocaleString() }}</td>
            </tr>
            <tr v-if="collections.length === 0">
              <td colspan="3" class="py-8 text-center text-slate-500">No collections found for the selected period.</td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  </main>
</template>