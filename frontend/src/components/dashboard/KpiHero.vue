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
  { label: 'Expected Collections', value: props.expectedCollections, format: 'currency' as const, color: 'text-blue-400', icon: 'receipt' },
  { label: 'Outstanding Balance', value: props.outstandingBalance, format: 'currency' as const, color: 'text-rose-400', icon: 'exclamation-circle' },
  { label: 'Students Awaiting DVA', value: props.studentsAwaitingDva, format: 'number' as const, color: 'text-amber-400', icon: 'wallet' },
  { label: 'Pending Verification', value: props.pendingVerification, format: 'number' as const, color: 'text-orange-400', icon: 'clock' },
  { label: 'Collection Rate', value: props.collectionRate, format: 'percent' as const, color: 'text-emerald-400', icon: 'chart-bar' },
]);

const formattedValue = (stat: typeof secondaryStats.value[0]) => {
  if (props.loading) return '-';
  if (stat.format === 'currency') return `₦${stat.value.toLocaleString()}`;
  if (stat.format === 'percent') return `${stat.value}%`;
  return `${stat.value}`;
};
</script>

<template>
  <div class="space-y-4">
    <!-- Primary KPI Hero Card - Focal Point -->
    <div class="premium-card p-8">
      <div class="flex items-start justify-between">
        <div>
          <p class="text-xs uppercase tracking-[0.24em] font-medium text-slate-400 mb-2">Today's Collection</p>
          <p class="text-6xl font-bold text-white mb-1">
            ₦{{ loading ? '---' : (todaysCollections || 0).toLocaleString() }}
          </p>
          <p class="text-sm text-slate-400">
            {{ loading ? '-' : '0' }} Payments Today
          </p>
        </div>
        <div v-if="isOwner" class="flex items-center gap-2">
          <svg class="h-8 w-8 text-cyan-500" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M2.278 12c0 5.314 4.286 9.75 9.5 10.125V12H2.278z" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M21.75 12c0-5.314-4.286-9.75-9.5-10.125V12h9.5z" />
          </svg>
        </div>
      </div>
    </div>

    <!-- Secondary Stats Grid -->
    <div class="grid grid-cols-5 gap-3">
      <div v-for="(stat, index) in secondaryStats" :key="stat.label" 
        class="premium-card p-4 text-center"
      >
        <div class="flex items-center justify-center mb-2">
          <svg v-if="stat.icon === 'receipt'" class="h-4 w-4" :class="stat.color" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l-.707.707M16.862 4.487a2.25 2.25 0 00-3.182 0L6.75 15.75m10.5-10.5l.707.707M16.862 4.487L6.75 15.75M16.862 4.487l.707.707M6.75 15.75l.707-.707M15 6.75h3.375c.621 0 1.125.504 1.125 1.125v3.375c0 .621-.504 1.125-1.125 1.125H15V6.75z" />
          </svg>
          <svg v-else-if="stat.icon === 'exclamation-circle'" class="h-4 w-4" :class="stat.color" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m0 0h.008v-.008H12V15zm0 0h.008v-.008H12V15zm0 0h-.008v.008H12V15zm0 0v-.008H12V12zM8.25 9V5.625c0-.621.504-1.125 1.125-1.125h3.375c.621 0 1.125.504 1.125 1.125V9" />
          </svg>
          <svg v-else-if="stat.icon === 'wallet'" class="h-4 w-4" :class="stat.color" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M2.278 12c0 5.314 4.286 9.75 9.5 10.125V12H2.278z" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M21.75 12c0-5.314-4.286-9.75-9.5-10.125V12h9.5z" />
          </svg>
          <svg v-else-if="stat.icon === 'clock'" class="h-4 w-4" :class="stat.color" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <svg v-else-if="stat.icon === 'chart-bar'" class="h-4 w-4" :class="stat.color" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 13.5v6A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 19.5v-6M3 8.75v6A2.25 2.25 0 005.25 15h13.5A2.25 2.25 0 0021 12.75v-4.5A2.25 2.25 0 0018.75 4.5H5.25A2.25 2.25 0 003 6.75v2z" />
          </svg>
          <svg v-else class="h-4 w-4" :class="stat.color" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <circle cx="12" cy="12" r="9" />
          </svg>
        </div>
        <p class="text-xs uppercase tracking-[0.24em] font-medium text-slate-400 mb-1">{{ stat.label }}</p>
        <p class="text-xl font-semibold font-mono" :class="stat.color">
          {{ formattedValue(stat) }}
        </p>
      </div>
    </div>
  </div>
</template>