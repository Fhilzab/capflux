<script setup lang="ts">
import { computed } from 'vue';
import { useAuthStore } from '../../stores/authStore';

interface Props {
  todaysCollections: number;
  outstandingBalance: number;
  expectedCollections: number;
  studentsAwaitingDva: number;
  pendingVerification: number;
  collectionRate: number;
  platformStatus?: string;
  loading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  todaysCollections: 0,
  outstandingBalance: 0,
  expectedCollections: 0,
  studentsAwaitingDva: 0,
  pendingVerification: 0,
  collectionRate: 0,
  platformStatus: 'healthy',
  loading: false,
});

const authStore = useAuthStore();
const isOwner = computed(() => authStore.isOwner);

const secondaryStats = computed(() => [
  { label: 'Expected Collections', value: props.expectedCollections, format: 'currency' as const },
  { label: 'Outstanding Balance', value: props.outstandingBalance, format: 'currency' as const },
  { label: 'Students Awaiting DVA', value: props.studentsAwaitingDva, format: 'number' as const },
  { label: 'Pending Verification', value: props.pendingVerification, format: 'number' as const },
  { label: 'Collection Rate', value: props.collectionRate, format: 'percent' as const },
]);
</script>

<template>
  <div class="space-y-4">
    <!-- Primary KPI Hero Card -->
    <div class="premium-card p-8">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-label mb-2">Today's Collection</p>
          <p class="text-metric text-cyan-500">
            ₦{{ loading ? '---' : (todaysCollections || 0).toLocaleString() }}
          </p>
          <p v-if="!loading && todaysCollections > 0" class="text-sm text-slate-500 mt-1">
            Updated {{ new Date().toLocaleTimeString() }}
          </p>
        </div>
        <div v-if="isOwner" class="flex items-center gap-2">
          <span class="text-4xl">🏦</span>
        </div>
      </div>
    </div>

    <!-- Secondary Stats Grid -->
    <div class="grid grid-cols-5 gap-3">
      <div v-for="(stat, index) in secondaryStats" :key="stat.label" 
        class="premium-card p-4 text-center animate-scale-in"
        :class="`delay-${(index + 1) * 100}`"
      >
        <p class="text-label mb-1">{{ stat.label }}</p>
        <p class="text-lg font-semibold font-mono text-cyan-600 dark:text-cyan-400">
          <template v-if="loading">-</template>
          <template v-else>
            <template v-if="stat.format === 'currency'">₦{{ stat.value.toLocaleString() }}</template>
            <template v-else-if="stat.format === 'percent'">{{ stat.value }}%</template>
            <template v-else>{{ stat.value }}</template>
          </template>
        </p>
      </div>
    </div>
  </div>
</template>