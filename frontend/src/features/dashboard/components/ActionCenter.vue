<script setup lang="ts">
import { computed } from 'vue';
import ActionCard from '../../../components/ui/ActionCard.vue';
import EmptyState from '../../../components/ui/EmptyState.vue';
import SkeletonLoader from '../../../components/ui/SkeletonLoader.vue';

interface Props {
  pendingDVAs?: number;
  pendingVerification?: number;
  failedNotifications?: number;
  paymentMismatches?: number;
  offlineRecords?: number;
  remindersNeeded?: number;
  loading?: boolean;
}

const props = defineProps<Props>();

interface Action {
  id: string;
  title: string;
  description: string;
  count: number;
  actionLabel?: string;
  status?: 'success' | 'warning' | 'error' | 'info' | 'pending';
}

const actions = computed<Action[]>(() => [
  {
    id: 'dva',
    title: 'Generate Virtual Accounts',
    description: 'Students awaiting DVA creation',
    count: props.pendingDVAs || 0,
    actionLabel: (props.pendingDVAs || 0) > 0 ? 'Generate Now' : undefined,
    status: props.pendingDVAs ? 'pending' : 'success'
  },
  {
    id: 'verify',
    title: 'Verify Payments',
    description: 'Payments awaiting verification',
    count: props.pendingVerification || 0,
    actionLabel: (props.pendingVerification || 0) > 0 ? 'Verify' : undefined,
    status: props.pendingVerification ? 'pending' : 'success'
  },
  {
    id: 'notifications',
    title: 'Retry Notifications',
    description: 'Failed notification delivery',
    count: props.failedNotifications || 0,
    actionLabel: (props.failedNotifications || 0) > 0 ? 'Retry' : undefined,
    status: props.failedNotifications ? 'warning' : 'success'
  },
  {
    id: 'sync',
    title: 'Sync Offline Records',
    description: 'Pending synchronization',
    count: props.offlineRecords || 0,
    actionLabel: (props.offlineRecords || 0) > 0 ? 'Sync Now' : undefined,
    status: props.offlineRecords ? 'info' : 'success'
  },
  {
    id: 'reminders',
    title: 'Send Reminders',
    description: 'Guardians with outstanding balances',
    count: props.remindersNeeded || 0,
    actionLabel: (props.remindersNeeded || 0) > 0 ? 'Send Reminders' : undefined,
    status: (props.remindersNeeded || 0) > 20 ? 'error' : 'warning'
  },
]);

const activeActions = computed(() => actions.value.filter(a => a.count > 0));
</script>

<template>
  <section>
    <div class="mb-4">
      <h2 class="text-headline">Action Center</h2>
      <p class="text-sm text-slate-500">Operational tasks requiring attention</p>
    </div>

    <SkeletonLoader v-if="loading" type="card" :count="3" />
    
    <EmptyState 
      v-else-if="activeActions.length === 0"
      title="All clear"
      description="No pending actions. The system is up to date."
    />

    <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <ActionCard
        v-for="action in activeActions"
        :key="action.id"
        :title="action.title"
        :description="action.description"
        :count="action.count"
        :action-label="action.actionLabel"
        :status="action.status"
        :loading="loading"
      />
    </div>
  </section>
</template>