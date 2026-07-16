<script setup lang="ts">
import { computed, ref } from 'vue';

interface Activity {
  id: string;
  type: 'payment' | 'dva' | 'registration' | 'sync' | 'webhook' | 'notification';
  title: string;
  description: string;
  timestamp: string;
  amount?: number;
}

interface Props {
  activities?: Activity[];
  loading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  activities: () => [],
  loading: false,
});

const icons = {
  payment: '💰',
  dva: '🏦',
  registration: '👤',
  sync: '🔄',
  webhook: '🔗',
  notification: '🔔',
};

const iconColors = {
  payment: 'text-success',
  dva: 'text-primary',
  registration: 'text-ai',
  sync: 'text-info',
  webhook: 'text-info',
  notification: 'text-warning',
};
</script>

<template>
  <div class="bg-card border border-border shadow-card rounded-card p-6 transition-colors duration-200">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-headline">Recent Activity</h2>
      <span v-if="!loading && activities.length > 0" class="text-label text-text-muted">
        {{ activities.length }} events today
      </span>
    </div>
    
    <div v-if="loading" class="space-y-3">
      <div v-for="i in 3" :key="i" class="flex items-center gap-3 p-3 rounded-card bg-surface animate-pulse">
        <div class="h-8 w-8 rounded-full bg-divider"></div>
        <div class="flex-1">
          <div class="h-4 bg-divider rounded mb-2"></div>
          <div class="h-3 bg-divider rounded w-3/4"></div>
        </div>
      </div>
    </div>
    
    <div v-else class="space-y-1">
      <div v-for="activity in activities" :key="activity.id" 
        class="flex items-center gap-3 p-3 rounded-card hover:bg-surface transition-colors duration-200"
      >
        <div class="flex h-8 w-8 items-center justify-center rounded-full text-lg" :class="iconColors[activity.type]">
          {{ icons[activity.type] }}
        </div>
        <div class="flex-1 min-w-0">
          <p class="font-medium text-text-primary">{{ activity.title }}</p>
          <p class="text-sm text-text-muted truncate">{{ activity.description }}</p>
        </div>
        <div class="text-right">
          <p class="text-xs text-text-muted">{{ activity.timestamp }}</p>
          <p v-if="activity.amount" class="text-sm font-medium text-primary">₦{{ activity.amount.toLocaleString() }}</p>
        </div>
      </div>
      
      <div v-if="activities.length === 0" class="text-center py-8">
        <p class="text-text-muted">No recent activity</p>
      </div>
    </div>
  </div>
</template>