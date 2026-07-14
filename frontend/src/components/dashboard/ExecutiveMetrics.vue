<script setup lang="ts">
import MetricCard from '../ui/MetricCard.vue';

interface Props {
  totalStudents?: number;
  totalGuardians?: number;
  todaysPayments?: number;
  termCollections?: number;
  sessionCollections?: number;
  pendingVerification?: number;
  offlineQueue?: number;
  pendingNotifications?: number;
  collectionRate?: number;
  loading?: boolean;
}

defineProps<Props>();
</script>

<template>
  <section>
    <div class="mb-4">
      <h2 class="text-headline">Executive Metrics</h2>
      <p class="text-sm text-slate-500">Key performance indicators</p>
    </div>
    
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <MetricCard
        label="Total Students"
        :value="totalStudents || 0"
        variant="info"
        description="Active in current session"
      />
      <MetricCard
        label="Total Guardians"
        :value="totalGuardians || 0"
        variant="info"
        description="Registered parents"
      />
      <MetricCard
        label="Today's Payments"
        :value="todaysPayments || 0"
        variant="success"
        description="Transactions completed"
      />
      <MetricCard
        label="Term Collections"
        :value="termCollections || 0"
        :currency="true"
        variant="success"
        description="This academic term"
      />
      <MetricCard
        label="Session Collections"
        :value="sessionCollections || 0"
        :currency="true"
        variant="default"
        description="Full academic year"
      />
      <MetricCard
        label="Collection Rate"
        :value="((collectionRate || 0) / 100).toFixed(2)"
        variant="success"
        description="Actual vs Expected"
      />
      <MetricCard
        label="Pending Verification"
        :value="pendingVerification || 0"
        variant="warning"
        description="Payments requiring verification"
      />
      <MetricCard
        label="Offline Queue"
        :value="offlineQueue || 0"
        variant="info"
        description="Sync pending"
      />
      <MetricCard
        label="Pending Notifications"
        :value="pendingNotifications || 0"
        variant="warning"
        description="Messages to be sent"
      />
    </div>
  </section>
</template>