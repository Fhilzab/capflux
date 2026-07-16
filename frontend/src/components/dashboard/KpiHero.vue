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
  { label: 'Expected Collections', value: props.expectedCollections, format: 'currency' as const, icon: 'receipt' },
  { label: 'Outstanding Balance', value: props.outstandingBalance, format: 'currency' as const, icon: 'exclamation-circle' },
  { label: 'Students Awaiting DVA', value: props.studentsAwaitingDva, format: 'number' as const, icon: 'wallet' },
  { label: 'Pending Verification', value: props.pendingVerification, format: 'number' as const, icon: 'clock' },
]);

const formattedValue = (stat: { format: 'currency' | 'number' | 'percent'; value: number }) => {
  if (props.loading) return stat.format === 'currency' ? '₦---' : '---';
  if (stat.value === 0 || stat.value === undefined) {
    return stat.format === 'currency' ? '₦0' : '0';
  }
  if (stat.format === 'currency') return `₦${stat.value.toLocaleString()}`;
  if (stat.format === 'percent') return `${stat.value}%`;
  if (stat.format === 'number') return `${stat.value}`;
  return `${stat.value}`;
};

const emptyStateMessage = (stat: typeof secondaryStats.value[0]) => {
  if (stat.label === 'Expected Collections') return 'No expected collections scheduled';
  if (stat.label === 'Outstanding Balance') return 'No outstanding balances';
  if (stat.label === 'Students Awaiting DVA') return 'No students awaiting DVA';
  if (stat.label === 'Pending Verification') return 'No pending verifications';
  return '';
};
</script>

<template>
  <div class="space-y-4">
    <!-- Primary KPI Hero Card - Focal Point -->
    <div class="premium-card p-6">
      <div class="flex items-start justify-between">
        <div>
          <p class="text-label mb-2">Today's Collection</p>
          <p class="text-display text-text-primary mb-1">
            {{ loading ? '₦---' : `₦${todaysCollections.toLocaleString()}` }}
          </p>
          <p class="text-sm text-text-muted">
            {{ loading ? '-' : '0' }} Payments Today
          </p>
        </div>
      </div>
    </div>

    <!-- Secondary KPI Cards - Monochrome with accent values -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <div v-for="stat in secondaryStats" :key="stat.label" class="premium-card p-4">
        <div class="flex items-start justify-between mb-2">
          <span class="text-xs text-label">{{ stat.label }}</span>
          <svg class="h-4 w-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path v-if="stat.icon === 'receipt'" stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l-.707.707M16.862 4.487a2.25 2.25 0 00-3.182 0L6.75 15.75m10.5-10.5l.707.707M16.862 4.487L6.75 15.75M16.862 4.487l.707.707M6.75 15.75l.707-.707M15 6.75h3.375c.621 0 1.125.504 1.125 1.125v3.375c0 .621-.504 1.125-1.125 1.125H15V6.75z" />
            <path v-else-if="stat.icon === 'exclamation-circle'" stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m0 0h.008v-.008H12V15zm0 0h.008v-.008H12V15zm0 0h-.008v.008H12V15zm0 0v-.008H12V12zM8.25 9V5.625c0-.621.504-1.125 1.125-1.125h3.375c.621 0 1.125.504 1.125 1.125V9" />
            <path v-else-if="stat.icon === 'wallet'" stroke-linecap="round" stroke-linejoin="round" d="M2.278 12c0 5.314 4.286 9.75 9.5 10.125V12H2.278z" />
            <path v-else-if="stat.icon === 'clock'" stroke-linecap="round" stroke-linejoin="round" d="M12 6v6l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p class="text-lg font-semibold font-mono text-text-primary">
          {{ formattedValue(stat) }}
        </p>
        <p v-if="stat.value === 0 && !loading" class="text-xs text-text-muted mt-1">
          {{ emptyStateMessage(stat) }}
        </p>
      </div>
    </div>
  </div>
</template>