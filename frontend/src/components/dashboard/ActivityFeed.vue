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
  payment: 'text-emerald-500',
  dva: 'text-cyan-500',
  registration: 'text-purple-500',
  sync: 'text-blue-500',
  webhook: 'text-indigo-500',
  notification: 'text-amber-500',
};
</script>

<template>
  <div class="premium-card p-6">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-headline">Recent Activity</h2>
      <span v-if="!loading && activities.length > 0" class="text-label text-slate-500">
        {{ activities.length }} events today
      </span>
    </div>
    
    <div v-if="loading" class="space-y-3">
      <div v-for="i in 3" :key="i" class="flex items-center gap-3 p-3 rounded-xl bg-slate-100/50 dark:bg-slate-800/50 animate-pulse">
        <div class="h-8 w-8 rounded-full bg-slate-200 dark:bg-slate-700"></div>
        <div class="flex-1">
          <div class="h-4 bg-slate-200 dark:bg-slate-700 rounded mb-2"></div>
          <div class="h-3 bg-slate-200 dark:bg-slate-700 rounded w-3/4"></div>
        </div>
      </div>
    </div>
    
    <div v-else class="space-y-1">
      <div v-for="activity in activities" :key="activity.id" 
        class="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transition-colors"
      >
        <div class="flex h-8 w-8 items-center justify-center rounded-full text-lg" :class="iconColors[activity.type]">
          {{ icons[activity.type] }}
        </div>
        <div class="flex-1 min-w-0">
          <p class="font-medium text-slate-900 dark:text-white">{{ activity.title }}</p>
          <p class="text-sm text-slate-500 dark:text-slate-400 truncate">{{ activity.description }}</p>
        </div>
        <div class="text-right">
          <p class="text-xs text-slate-500">{{ activity.timestamp }}</p>
          <p v-if="activity.amount" class="text-sm font-medium text-cyan-500">₦{{ activity.amount.toLocaleString() }}</p>
        </div>
      </div>
      
      <div v-if="activities.length === 0" class="text-center py-8">
        <p class="text-slate-500">No recent activity</p>
      </div>
    </div>
  </div>
</template>