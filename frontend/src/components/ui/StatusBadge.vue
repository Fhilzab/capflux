<script setup lang="ts">
interface Props {
  status: 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'pending';
  label: string;
}

defineProps<Props>();
</script>

<template>
  <span 
    class="inline-flex items-center gap-1.5 rounded-card px-3 py-1.5 text-xs font-medium transition-all duration-150"
    :class="{
      'bg-success/10 text-success border border-success/20': status === 'success',
      'bg-warning/10 text-warning border border-warning/20': status === 'warning',
      'bg-danger/10 text-danger border border-danger/20': status === 'error',
      'bg-info/10 text-info border border-info/20': status === 'info',
      'bg-muted/10 text-muted border border-muted/20': status === 'neutral',
      'bg-info/10 text-info border border-info/20 animate-pulse': status === 'pending'
    }"
  >
    <span 
      class="h-1.5 w-1.5 rounded-full" 
      :class="{
        'bg-success': status === 'success',
        'bg-warning': status === 'warning',
        'bg-danger': status === 'error',
        'bg-info': status === 'info' || status === 'pending',
        'bg-muted': status === 'neutral'
      }"
    ></span>
    {{ label }}
  </span>
</template>