<script setup lang="ts">
import { computed } from 'vue';
import StatusBadge from '../../../components/ui/StatusBadge.vue';

interface Props {
  databaseHealth?: 'online' | 'offline';
  offlineEngine?: 'running' | 'stopped';
  syncQueue?: number;
  webhookHealth?: 'online' | 'offline';
  notificationDelivery?: 'healthy' | 'issues';
  paymentVerification?: 'passed' | 'failed';
  dvaCreationQueue?: number;
  internetStatus?: boolean;
  lastSync?: string | null;
}

defineProps<Props>();
</script>

<template>
  <section>
    <div class="mb-4">
      <h2 class="text-headline">System Health</h2>
      <p class="text-sm text-text-secondary">Operational status dashboard</p>
    </div>

    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div class="premium-card p-5">
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm text-text-muted">Database Health</span>
          <StatusBadge :status="databaseHealth === 'online' ? 'success' : 'error'" :label="databaseHealth || 'Unknown'" />
        </div>
      </div>
      
      <div class="premium-card p-5">
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm text-text-muted">Offline Engine</span>
          <StatusBadge :status="offlineEngine === 'running' ? 'success' : 'error'" :label="offlineEngine || 'Stopped'" />
        </div>
      </div>
      
      <div class="premium-card p-5">
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm text-text-muted">Sync Queue</span>
          <span class="text-sm font-mono" :class="syncQueue && syncQueue > 0 ? 'text-warning' : 'text-success'">{{ syncQueue || 0 }} pending</span>
        </div>
      </div>
      
      <div class="premium-card p-5">
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm text-text-muted">Webhook Health</span>
          <StatusBadge :status="webhookHealth === 'online' ? 'success' : 'error'" :label="webhookHealth === 'online' ? 'Active' : 'Offline'" />
        </div>
      </div>
      
      <div class="premium-card p-5">
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm text-text-muted">Notification Delivery</span>
          <StatusBadge :status="notificationDelivery === 'healthy' ? 'success' : 'warning'" :label="notificationDelivery || 'Unknown'" />
        </div>
      </div>
      
      <div class="premium-card p-5">
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm text-text-muted">Payment Verification</span>
          <StatusBadge :status="paymentVerification === 'passed' ? 'success' : 'error'" :label="paymentVerification || 'Unknown'" />
        </div>
      </div>
      
      <div class="premium-card p-5">
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm text-text-muted">DVA Creation Queue</span>
          <span class="text-sm font-mono" :class="dvaCreationQueue && dvaCreationQueue > 0 ? 'text-warning' : 'text-success'">{{ dvaCreationQueue || 0 }} pending</span>
        </div>
      </div>
      
      <div class="premium-card p-5">
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm text-text-muted">Internet Status</span>
          <StatusBadge :status="internetStatus ? 'success' : 'error'" :label="internetStatus ? 'Online' : 'Offline'" />
        </div>
      </div>
      
      <div class="premium-card p-5">
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm text-text-muted">Last Successful Sync</span>
          <span class="text-sm font-mono text-text-secondary">{{ lastSync || 'Never' }}</span>
        </div>
      </div>
    </div>
  </section>
</template>