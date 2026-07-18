<script setup lang="ts">
interface Props {
  internetStatus?: boolean;
  realtimeStatus?: 'online' | 'offline';
  webhookStatus?: 'online' | 'offline' | 'error';
  syncEngineStatus?: 'running' | 'stopped' | 'error';
  notificationQueue?: number;
  gatewayStatus?: 'online' | 'offline' | 'maintenance';
  loading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  internetStatus: true,
  realtimeStatus: 'online',
  webhookStatus: 'online',
  syncEngineStatus: 'running',
  notificationQueue: 0,
  gatewayStatus: 'online',
  loading: false,
});

const statusColor = (status: string | boolean) => {
  if (status === true || status === 'online' || status === 'running') return 'bg-success';
  if (status === false || status === 'offline') return 'bg-danger';
  return 'bg-warning';
};

const statusText = (status: string | boolean) => {
  if (status === true) return 'Online';
  if (status === false) return 'Offline';
  return status.charAt(0).toUpperCase() + status.slice(1);
};

const healthItems = [
  { label: 'Internet', value: props.internetStatus, key: 'internetStatus' },
  { label: 'Realtime', value: props.realtimeStatus, key: 'realtimeStatus' },
  { label: 'Webhook', value: props.webhookStatus, key: 'webhookStatus' },
  { label: 'Sync Engine', value: props.syncEngineStatus, key: 'syncEngineStatus' },
  { label: 'Gateway', value: props.gatewayStatus, key: 'gatewayStatus' },
];
</script>

<template>
  <div class="premium-card p-6">
    <h3 class="text-headline mb-4">System Health</h3>
    <div class="space-y-3">
      <div v-for="item in healthItems" :key="item.key" class="flex items-center justify-between">
        <span class="text-sm text-text-muted">{{ item.label }}</span>
        <span class="flex items-center gap-2">
          <span class="text-xs font-medium text-text-primary">
            {{ loading ? 'Loading...' : statusText(item.value) }}
          </span>
          <span class="h-2 w-2 rounded-full" :class="loading ? 'bg-text-muted animate-pulse' : statusColor(item.value)"></span>
        </span>
      </div>
      <div class="border-t border-divider pt-3 mt-3">
        <div class="flex items-center justify-between">
          <span class="text-sm text-text-muted">Notification Queue</span>
          <span class="text-sm font-medium" :class="loading ? 'text-text-muted' : 'text-brand'">
            {{ loading ? '-' : props.notificationQueue }} pending
          </span>
        </div>
      </div>
    </div>
  </div>
</template>