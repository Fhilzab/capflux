<script setup lang="ts">
import { computed } from 'vue';
import StatusBadge from '../../../components/ui/StatusBadge.vue';
import dayjs from 'dayjs';

interface Props {
  todaysCollections?: number;
  pendingSync?: number;
  failedSync?: number;
  internetStatus?: boolean;
  lastSyncedAt?: string | null;
  notificationQueue?: number;
  webhookQueue?: number;
  paymentGatewayStatus?: 'online' | 'offline';
  loading?: boolean;
}

defineProps<Props>();
</script>

<template>
  <aside class="fixed top-16 right-0 bottom-0 w-80 border-l border-slate-800/50 bg-slate-900/20 backdrop-blur-xl overflow-y-auto">
    <div class="p-5 space-y-4">
      <!-- Today's Collections -->
      <div class="premium-card p-5">
        <h3 class="text-label mb-2">Today's Collections</h3>
        <p class="text-metric text-emerald-400">₦{{ (todaysCollections || 0).toLocaleString() }}</p>
      </div>
      
      <!-- System Health -->
      <div class="premium-card p-5">
        <h3 class="text-label mb-3">System Health</h3>
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <span class="text-sm text-slate-400">Internet Status</span>
            <StatusBadge :status="internetStatus ? 'success' : 'error'" :label="internetStatus ? 'Online' : 'Offline'" />
          </div>
          <div class="flex items-center justify-between">
            <span class="text-sm text-slate-400">Offline Queue</span>
            <span class="text-sm font-mono" :class="pendingSync && pendingSync > 0 ? 'text-amber-400' : 'text-emerald-400'">{{ pendingSync || 0 }} pending</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-sm text-slate-400">Failed Sync</span>
            <span class="text-sm font-mono" :class="failedSync && failedSync > 0 ? 'text-rose-400' : 'text-emerald-400'">{{ failedSync || 0 }} failed</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-sm text-slate-400">Notification Queue</span>
            <span class="text-sm font-mono" :class="notificationQueue && notificationQueue > 0 ? 'text-amber-400' : 'text-emerald-400'">{{ notificationQueue || 0 }} pending</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-sm text-slate-400">Webhook Queue</span>
            <span class="text-sm font-mono" :class="webhookQueue && webhookQueue > 0 ? 'text-amber-400' : 'text-emerald-400'">{{ webhookQueue || 0 }} pending</span>
          </div>
        </div>
      </div>

      <!-- Payment Gateway Status -->
      <div class="premium-card p-5">
        <h3 class="text-label mb-3">Payment Gateway</h3>
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-sm text-slate-400">Monnify</span>
            <StatusBadge status="success" label="Active" />
          </div>
          <div class="flex items-center justify-between">
            <span class="text-sm text-slate-400">Webhook</span>
            <StatusBadge :status="internetStatus ? 'success' : 'error'" :label="internetStatus ? 'Listening' : 'Offline'" />
          </div>
        </div>
      </div>

      <!-- Last Sync -->
      <div class="premium-card p-5">
        <h3 class="text-label mb-2">Last Synchronization</h3>
        <p class="text-sm text-slate-300">
          {{ lastSyncedAt ? dayjs(lastSyncedAt).format('HH:mm') : 'Never' }}
        </p>
        <p class="text-xs text-slate-500 mt-1">
          {{ lastSyncedAt ? dayjs(lastSyncedAt).format('MMM D, YYYY') : '' }}
        </p>
      </div>
    </div>
  </aside>
</template>