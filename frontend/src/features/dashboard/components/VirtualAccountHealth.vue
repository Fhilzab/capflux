<script setup lang="ts">
import { computed } from 'vue';
import MetricCard from '../../../components/ui/MetricCard.vue';
import StatusBadge from '../../../components/ui/StatusBadge.vue';
import EmptyState from '../../../components/ui/EmptyState.vue';
import SkeletonLoader from '../../../components/ui/SkeletonLoader.vue';

interface Props {
  totalActive?: number;
  pendingCreation?: number;
  failedCreation?: number;
  recentlyCreated?: number;
  webhookStatus?: 'online' | 'offline';
  loading?: boolean;
}

defineProps<Props>();
</script>

<template>
  <section>
    <div class="mb-4">
      <h2 class="text-headline">Virtual Account Health</h2>
      <p class="text-sm text-slate-500">DVA status and provider health</p>
    </div>

    <SkeletonLoader v-if="loading" type="card" :count="4" />

    <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        label="Total Active DVAs"
        :value="totalActive || 0"
        variant="success"
        description="Ready for payments"
      />
      <MetricCard
        label="Pending Creation"
        :value="pendingCreation || 0"
        variant="warning"
        description="Awaiting activation"
      />
      <MetricCard
        label="Failed Creation"
        :value="failedCreation || 0"
        variant="error"
        description="Needs attention"
      />
      <MetricCard
        label="Recently Created"
        :value="recentlyCreated || 0"
        variant="info"
        description="Last 24 hours"
      />
    </div>

    <!-- Provider Health -->
    <div class="mt-4 premium-card p-5">
      <h3 class="text-sm font-semibold text-white mb-3">Provider Health</h3>
      <div class="grid gap-3 sm:grid-cols-2">
        <div class="flex items-center justify-between">
          <span class="text-sm text-slate-400">Monnify</span>
          <StatusBadge status="success" label="Operational" />
        </div>
        <div class="flex items-center justify-between">
          <span class="text-sm text-slate-400">Webhook</span>
          <StatusBadge :status="webhookStatus === 'online' ? 'success' : 'error'" :label="webhookStatus === 'online' ? 'Listening' : 'Offline'" />
        </div>
      </div>
    </div>
  </section>
</template>