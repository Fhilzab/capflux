<script setup lang="ts">
interface Props {
  provider?: string;
  gatewayStatus?: 'online' | 'offline' | 'maintenance';
  webhookStatus?: 'online' | 'offline' | 'error';
  lastPayment?: string;
  settlementStatus?: 'pending' | 'settled' | 'failed';
  loading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  provider: 'Monnify',
  gatewayStatus: 'online',
  webhookStatus: 'online',
  lastPayment: '2 hours ago',
  settlementStatus: 'settled',
  loading: false,
});

const statusColor = (status: string) => {
  if (status === 'online' || status === 'settled') return 'text-emerald-500';
  if (status === 'offline' || status === 'failed') return 'text-rose-500';
  return 'text-amber-500';
};
</script>

<template>
  <div class="premium-card p-6">
    <h3 class="text-headline mb-4">Payment Gateway</h3>
    <div class="space-y-3">
      <div class="flex items-center justify-between">
        <span class="text-sm text-slate-500">Provider</span>
        <span class="text-sm font-medium text-slate-700 dark:text-slate-300">
          {{ loading ? 'Loading...' : provider }}
        </span>
      </div>
      <div class="flex items-center justify-between">
        <span class="text-sm text-slate-500">Gateway Status</span>
        <span class="text-sm font-medium" :class="loading ? 'text-slate-400' : statusColor(gatewayStatus)">
          {{ loading ? '-' : gatewayStatus }}
        </span>
      </div>
      <div class="flex items-center justify-between">
        <span class="text-sm text-slate-500">Webhook Status</span>
        <span class="text-sm font-medium" :class="loading ? 'text-slate-400' : statusColor(webhookStatus)">
          {{ loading ? '-' : webhookStatus }}
        </span>
      </div>
      <div class="flex items-center justify-between">
        <span class="text-sm text-slate-500">Last Payment</span>
        <span class="text-sm font-medium text-slate-700 dark:text-slate-300">
          {{ loading ? '-' : lastPayment }}
        </span>
      </div>
      <div class="border-t border-slate-200/50 dark:border-slate-700/50 pt-3 mt-3">
        <div class="flex items-center justify-between">
          <span class="text-sm text-slate-500">Settlement Status</span>
          <span class="text-sm font-medium" :class="loading ? 'text-slate-400' : statusColor(settlementStatus)">
            {{ loading ? '-' : settlementStatus }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>