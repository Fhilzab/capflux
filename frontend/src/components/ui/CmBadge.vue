<script setup lang="ts">
interface Props {
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'info' | 'muted' | 'brand';
  size?: 'sm' | 'md';
  pill?: boolean;
  dot?: boolean;
  label: string;
}

withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'md',
});

const variantClasses = {
  primary: 'bg-brand/10 text-brand border border-brand/20',
  secondary: 'bg-surface text-text-primary border border-border',
  success: 'bg-success/10 text-success border border-success/20',
  danger: 'bg-danger/10 text-danger border border-danger/20',
  warning: 'bg-warning/10 text-warning border border-warning/20',
  info: 'bg-info/10 text-info border border-info/20',
  muted: 'bg-text-muted/10 text-text-muted border border-text-muted/20',
  brand: 'bg-brand/10 text-brand border border-brand/20',
};

const sizeClasses = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-3 py-1.5 text-xs',
};
</script>

<template>
  <span
    class="inline-flex items-center gap-1.5 font-medium transition-all duration-150"
    :class="[
      variantClasses[variant],
      sizeClasses[size],
      pill ? 'rounded-full' : 'rounded-card',
    ]"
  >
    <span
      v-if="dot"
      class="h-1.5 w-1.5 rounded-full"
      :class="{
        'bg-brand': variant === 'primary' || variant === 'brand',
        'bg-success': variant === 'success',
        'bg-danger': variant === 'danger',
        'bg-warning': variant === 'warning',
        'bg-info': variant === 'info',
        'bg-text-muted': variant === 'muted',
        'bg-surface': variant === 'secondary',
      }"
    ></span>
    {{ label }}
  </span>
</template>