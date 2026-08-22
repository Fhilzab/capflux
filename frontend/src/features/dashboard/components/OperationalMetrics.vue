<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue';
import { useDashboardStore } from '../stores/dashboardStore';
import { useSyncStore } from '../../../stores/syncStore';
import CmStatusChip from '../../../components/ui/CmStatusChip.vue';
import SkeletonLoader from '../../../components/ui/SkeletonLoader.vue';

interface Props {
  loading?: boolean;
}

const props = withDefaults(defineProps<Props>(), { loading: false });

const dashboardStore = useDashboardStore();
const syncStore = useSyncStore();

const online = ref(typeof navigator !== 'undefined' ? navigator.onLine : true);

const handleOnline = () => (online.value = true);
const handleOffline = () => (online.value = false);

onMounted(() => {
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
});

onUnmounted(() => {
  window.removeEventListener('online', handleOnline);
  window.removeEventListener('offline', handleOffline);
});

const metrics = computed(() => [
  {
    label: 'Collection Rate',
    value: dashboardStore.collectionRate,
    unit: '%',
    barColor: 'bg-brand',
    textColor: 'text-brand',
    trend: 'up' as const,
  },
]);

const statusItems = computed(() => [
  {
    label: 'Students with Outstanding',
    value: dashboardStore.outstandingStudentCount,
    unit: dashboardStore.outstandingStudentCount === 1 ? 'student' : 'students',
    status: dashboardStore.outstandingStudentCount > 0 ? 'warning' : 'success',
    statusLabel:
      dashboardStore.outstandingStudentCount > 0 ? 'Action needed' : 'All paid',
  },
  {
    label: 'Payments Pending Verification',
    value: dashboardStore.pendingVerification,
    unit: dashboardStore.pendingVerification === 1 ? 'payment' : 'payments',
    status: dashboardStore.pendingVerification > 0 ? 'warning' : 'success',
    statusLabel:
      dashboardStore.pendingVerification > 0
        ? 'Pending'
        : 'All verified',
  },
  {
    label: 'Offline Queue',
    value: syncStore.pendingCount,
    unit: syncStore.pendingCount === 1 ? 'item' : 'items',
    status: syncStore.pendingCount > 0 ? 'syncing' : 'online',
    statusLabel:
      syncStore.pendingCount > 0
        ? `${syncStore.pendingCount} pending`
        : 'Up to date',
  },
]);
</script>

<template>
  <section class="premium-card p-5">
    <div class="mb-4">
      <h2 class="text-headline">Operational Metrics</h2>
      <p class="text-xs text-text-muted mt-1">Real-time collection and system status</p>
    </div>

    <div v-if="loading" class="space-y-4">
      <SkeletonLoader type="text" :count="6" />
    </div>

    <div v-else class="space-y-4">
      <!-- Progress bar metrics -->
      <div v-for="metric in metrics" :key="metric.label" class="space-y-2">
        <div class="flex items-center justify-between">
          <span class="text-xs font-medium text-text-muted">{{ metric.label }}</span>
          <span class="text-sm font-bold font-mono" :class="metric.textColor">
            {{ metric.value.toFixed(0) }}%
          </span>
        </div>
        <div class="relative h-2 w-full rounded-full bg-divider overflow-hidden">
          <div
            class="h-full rounded-full transition-all duration-500"
            :class="metric.barColor"
            :style="{ width: `${Math.min(metric.value, 100)}%` }"
          />
        </div>
      </div>

      <!-- Status items -->
      <div class="border-t border-divider pt-3 space-y-2.5">
        <div
          v-for="item in statusItems"
          :key="item.label"
          class="flex items-center justify-between"
        >
          <span class="text-sm text-text-secondary">{{ item.label }}</span>
          <div class="flex items-center gap-2">
            <span class="text-sm font-medium font-mono text-text-primary">
              {{ item.value }}{{ item.value > 0 ? ` ${item.unit}` : '' }}
            </span>
            <CmStatusChip :status="item.status" :label="item.statusLabel" size="sm" />
          </div>
        </div>

        <!-- Connection status -->
        <div class="flex items-center justify-between">
          <span class="text-sm text-text-secondary">Connection</span>
          <CmStatusChip
            :status="online ? 'online' : 'offline'"
            :label="online ? 'Online' : 'Offline'"
            size="sm"
          />
        </div>
      </div>
    </div>
  </section>
</template>
