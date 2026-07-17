<script setup lang="ts">
interface Props {
  status: 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'pending' | 'verified' | 'syncing';
  label: string;
}

defineProps<Props>();
</script>

<template>
  <span 
    class="inline-flex items-center gap-1.5 rounded-card px-3 py-1.5 text-xs font-medium transition-all duration-150"
    :class="{
      'bg-success/10 text-success border border-success/20': status === 'success',
      'bg-warning/10 text-warning border border-warning/20': status === 'warning' || status === 'pending' || status === 'syncing',
      'bg-danger/10 text-danger border border-danger/20': status === 'error',
      'bg-info/10 text-info border border-info/20': status === 'info',
      'bg-text-muted/10 text-text-muted border border-text-muted/20': status === 'neutral',
      'bg-brand/10 text-brand border border-brand/20': status === 'verified',
    }"
  >
    <span 
      class="h-1.5 w-1.5 rounded-full" 
      :class="{
        'bg-success': status === 'success',
        'bg-warning': status === 'warning' || status === 'pending' || status === 'syncing',
        'bg-danger': status === 'error',
        'bg-info': status === 'info',
        'bg-text-muted': status === 'neutral',
        'bg-brand': status === 'verified',
      }"
    ></span>
    {{ label }}
  </span>
</template>