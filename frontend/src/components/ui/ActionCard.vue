<script setup lang="ts">
interface Props {
  title: string;
  description?: string;
  count?: number;
  status?: 'success' | 'warning' | 'error' | 'info' | 'pending';
  actionLabel?: string;
  loading?: boolean;
}

defineProps<Props>();
const emit = defineEmits<{
  action: [];
}>();

const statusColors = {
  success: 'border-success/20 bg-success/5',
  warning: 'border-warning/20 bg-warning/5',
  error: 'border-danger/20 bg-danger/5',
  info: 'border-info/20 bg-info/5',
  pending: 'border-info/20 bg-info/5',
};
</script>

<template>
  <div class="premium-card p-5 transition-all duration-300 hover:shadow-lg" :class="status ? statusColors[status] : ''">
    <div class="flex items-start justify-between mb-3">
      <div class="flex-1">
        <h3 class="text-sm font-semibold text-text-primary">{{ title }}</h3>
        <p v-if="description" class="text-xs text-text-muted mt-1">{{ description }}</p>
      </div>
      <span v-if="count !== undefined" class="flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-surface px-1.5 text-xs font-medium text-text-primary">
        {{ count > 99 ? '99+' : count }}
      </span>
    </div>
    
    <div v-if="loading" class="w-full bg-surface rounded-full h-1.5 overflow-hidden">
      <div class="h-full bg-primary rounded-full animate-pulse" style="width: 60%"></div>
    </div>
    
    <button 
      v-if="actionLabel"
      @click="emit('action')"
      class="mt-3 w-full rounded-xl bg-primary/10 px-3 py-2 text-xs font-medium text-primary hover:bg-primary/20 transition-colors focus-ring"
    >
      {{ actionLabel }}
    </button>
  </div>
</template>