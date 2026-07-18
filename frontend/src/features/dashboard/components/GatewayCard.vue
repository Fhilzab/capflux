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
  if (status === 'online' || status === 'settled') return 'text-success';
  if (status === 'offline' || status === 'failed') return 'text-danger';
  return 'text-warning';
};
</script>

<template>
  <div class="premium-card p-6">
    <h3 class="text-headline mb-4">Payment Gateway</h3>
    <div class="space-y-3">
      <div class="flex items-center justify-between">
        <span class="text-sm text-text-muted">Provider</span>
        <span class="text-sm font-medium text-text-primary">
          {{ loading ? 'Loading...' : provider }}
        </span>
      </div>
      <div class="flex items-center justify-between">
        <span class="text-sm text-text-muted">Gateway Status</span>
        <span class="text-sm font-medium" :class="loading ? 'text-text-muted' : statusColor(gatewayStatus)">
          {{ loading ? '-' : gatewayStatus }}
        </span>
      </div>
      <div class="flex items-center justify-between">
        <span class="text-sm text-text-muted">Webhook Status</span>
        <span class="text-sm font-medium" :class="loading ? 'text-text-muted' : statusColor(webhookStatus)">
          {{ loading ? '-' : webhookStatus }}
        </span>
      </div>
      <div class="flex items-center justify-between">
        <span class="text-sm text-text-muted">Last Payment</span>
        <span class="text-sm font-medium text-text-primary">
          {{ loading ? '-' : lastPayment }}
        </span>
      </div>
      <div class="border-t border-border pt-3 mt-3">
        <div class="flex items-center justify-between">
          <span class="text-sm text-text-muted">Settlement Status</span>
          <span class="text-sm font-medium" :class="loading ? 'text-text-muted' : statusColor(settlementStatus)">
            {{ loading ? '-' : settlementStatus }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>