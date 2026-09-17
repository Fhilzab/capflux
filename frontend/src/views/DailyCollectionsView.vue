<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useModuleLock } from '../composables/useModuleLock';
import ModuleLockOverlay from '../features/onboarding/ModuleLockOverlay.vue';
import CmButton from '../components/ui/CmButton.vue';
import CmInput from '../components/ui/CmInput.vue';
import ErrorState from '../components/ui/ErrorState.vue';
import EmptyState from '../components/ui/EmptyState.vue';
import SkeletonLoader from '../components/ui/SkeletonLoader.vue';
import { formatNairaKobo } from '../lib/ledgerSemantics';
import { buildDailyCollections, type DailyCollectionRow } from '../lib/ledgerReportBuilder';

const { paymentsLocked, requiresSetup, requiresKyc, requiresSettlement, loading: lockLoading } = useModuleLock();
const loading = ref(false);
const error = ref('');
const startDate = ref('');
const endDate = ref('');
const collections = ref<DailyCollectionRow[]>([]);

const filteredCollections = computed(() => {
  return collections.value.filter((item) => {
    if (startDate.value && item.date < startDate.value) return false;
    if (endDate.value && item.date > endDate.value) return false;
    return true;
  });
});

const totalCollectedMinor = computed(() => {
  return filteredCollections.value.reduce((sum, item) => sum + item.collectedMinor, 0);
});

const loadCollections = async () => {
  loading.value = true;
  error.value = '';
  try {
    collections.value = await buildDailyCollections('demo-school');
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load daily collections.';
    collections.value = [];
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
    ['Date', 'Payments Count', 'Total Collected (₦)'],
    ...filteredCollections.value.map((item) => [
      item.date,
      item.count,
      Number((item.collectedMinor / 100).toFixed(2)),
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
    <ModuleLockOverlay v-if="requiresSetup && !lockLoading" variant="setup" />
    <ModuleLockOverlay v-else-if="requiresKyc && !lockLoading" variant="kyc" />
    <ModuleLockOverlay v-else-if="requiresSettlement && !lockLoading" variant="settlement" />
    <ModuleLockOverlay v-else-if="paymentsLocked && !lockLoading" variant="payment" />
    <template v-else>
      <div class="max-w-6xl mx-auto space-y-6">
        <section class="rounded-card bg-card p-8 shadow-card transition-colors duration-200">
          <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 class="text-headline mb-2 text-text-primary">Daily Collections</h1>
              <p class="text-text-muted">View payments collected per day with date range filtering.</p>
            </div>
            <CmButton
              @click="downloadCsv"
              :disabled="filteredCollections.length === 0"
              variant="primary"
            >
              Export CSV
            </CmButton>
          </div>
        </section>

        <ErrorState v-if="error" :description="error" @retry="loadCollections()" />
        <div v-else-if="loading" class="space-y-6">
          <SkeletonLoader type="metric" :count="1" />
          <SkeletonLoader type="table" :count="5" />
        </div>

        <template v-else>
          <section class="rounded-card bg-card p-8 shadow-card transition-colors duration-200">
            <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div class="grid gap-4 sm:grid-cols-2">
                <label class="block">
                  <span class="text-sm text-text-muted">Start date</span>
                  <CmInput v-model="startDate" type="date" class="mt-2" />
                </label>
                <label class="block">
                  <span class="text-sm text-text-muted">End date</span>
                  <CmInput v-model="endDate" type="date" class="mt-2" />
                </label>
              </div>
              <CmButton @click="loadCollections" variant="primary">
                Filter
              </CmButton>
            </div>
          </section>

          <section class="rounded-card bg-card p-8 shadow-card transition-colors duration-200">
            <h2 class="text-headline mb-4 text-text-primary">Total collected</h2>
            <p class="text-5xl font-bold text-success">{{ formatNairaKobo(totalCollectedMinor) }}</p>
            <p class="mt-2 text-text-muted">{{ filteredCollections.length }} day(s) with payments</p>
          </section>

          <section class="rounded-card bg-card p-8 shadow-card overflow-x-auto transition-colors duration-200">
            <h2 class="text-headline mb-4 text-text-primary">Collections by day</h2>
            <table class="w-full border-collapse text-left text-sm">
              <thead>
                <tr class="border-b border-divider text-text-muted">
                  <th class="py-3 text-xs font-bold uppercase tracking-wider">Date</th>
                  <th class="py-3 text-xs font-bold uppercase tracking-wider">Payments</th>
                  <th class="py-3 text-xs font-bold uppercase tracking-wider">Total collected</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in filteredCollections" :key="item.date" class="border-b border-divider hover:bg-card/50 transition-colors">
                  <td class="py-3 text-text-secondary">{{ item.date }}</td>
                  <td class="py-3 text-text-secondary">{{ item.count }}</td>
                  <td class="py-3 font-semibold text-success">{{ formatNairaKobo(item.collectedMinor) }}</td>
                </tr>
                <tr v-if="filteredCollections.length === 0">
                  <td colspan="3" class="py-8 text-center text-text-muted">No collections found for the selected period.</td>
                </tr>
              </tbody>
            </table>
            <EmptyState
              v-if="filteredCollections.length === 0"
              title="No collections in this period"
              description="Daily payment totals recorded in the ledger will appear here."
            />
          </section>
        </template>
      </div>
    </template>
  </main>
</template>