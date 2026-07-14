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
  success: 'border-emerald-500/20 bg-emerald-500/5',
  warning: 'border-amber-500/20 bg-amber-500/5',
  error: 'border-rose-500/20 bg-rose-500/5',
  info: 'border-cyan-500/20 bg-cyan-500/5',
  pending: 'border-cyan-500/20 bg-cyan-500/5',
};
</script>

<template>
  <div class="premium-card p-5 transition-all duration-300 hover:shadow-lg" :class="status ? statusColors[status] : ''">
    <div class="flex items-start justify-between mb-3">
      <div class="flex-1">
        <h3 class="text-sm font-semibold text-white">{{ title }}</h3>
        <p v-if="description" class="text-xs text-slate-500 mt-1">{{ description }}</p>
      </div>
      <span v-if="count !== undefined" class="flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-slate-800 px-1.5 text-xs font-medium text-white">
        {{ count > 99 ? '99+' : count }}
      </span>
    </div>
    
    <div v-if="loading" class="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
      <div class="h-full bg-cyan-500 rounded-full animate-pulse" style="width: 60%"></div>
    </div>
    
    <button 
      v-if="actionLabel"
      @click="emit('action')"
      class="mt-3 w-full rounded-xl bg-cyan-500/10 px-3 py-2 text-xs font-medium text-cyan-400 hover:bg-cyan-500/20 transition-colors focus-ring"
    >
      {{ actionLabel }}
    </button>
  </div>
</template>