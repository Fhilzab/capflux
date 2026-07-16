<script setup lang="ts">
interface Props {
  status: 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'pending';
  label: string;
  size?: 'sm' | 'md';
}

withDefaults(defineProps<Props>(), {
  size: 'md',
});

const variantClasses = {
  success: 'bg-success/10 text-success border-success/20',
  warning: 'bg-warning/10 text-warning border-warning/20',
  error: 'bg-danger/10 text-danger border-danger/20',
  info: 'bg-info/10 text-info border-info/20',
  neutral: 'bg-muted/10 text-muted border-muted/20',
  pending: 'bg-info/10 text-info border-info/20',
};

const sizeClasses = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-3 py-1.5 text-xs',
};

const dotClasses = {
  success: 'bg-success',
  warning: 'bg-warning',
  error: 'bg-danger',
  info: 'bg-info',
  neutral: 'bg-muted',
  pending: 'bg-info animate-pulse',
};
</script>

<template>
  <span
    class="inline-flex items-center gap-1.5 rounded-full font-medium transition-all duration-150"
    :class="[variantClasses[status], sizeClasses[size]]"
  >
    <span class="h-1.5 w-1.5 rounded-full" :class="dotClasses[status]" />
    {{ label }}
  </span>
</template>