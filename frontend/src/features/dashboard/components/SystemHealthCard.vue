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
  if (status === true || status === 'online' || status === 'running') return 'bg-emerald-500';
  if (status === false || status === 'offline') return 'bg-rose-500';
  return 'bg-amber-500';
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
        <span class="text-sm text-slate-500">{{ item.label }}</span>
        <span class="flex items-center gap-2">
          <span class="text-xs font-medium text-slate-700 dark:text-slate-300">
            {{ loading ? 'Loading...' : statusText(item.value) }}
          </span>
          <span class="h-2 w-2 rounded-full" :class="loading ? 'bg-slate-400 animate-pulse' : statusColor(item.value)"></span>
        </span>
      </div>
      <div class="border-t border-slate-200/50 dark:border-slate-700/50 pt-3 mt-3">
        <div class="flex items-center justify-between">
          <span class="text-sm text-slate-500">Notification Queue</span>
          <span class="text-sm font-medium" :class="loading ? 'text-slate-400' : 'text-cyan-500'">
            {{ loading ? '-' : props.notificationQueue }} pending
          </span>
        </div>
      </div>
    </div>
  </div>
</template>