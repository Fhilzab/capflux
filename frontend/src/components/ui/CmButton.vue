<script setup lang="ts">
interface Props {
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'info' | 'black';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  type?: 'button' | 'submit' | 'reset';
}

withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'md',
  type: 'button',
});

const emit = defineEmits<{
  click: [event: MouseEvent];
}>();

const variantClasses = {
  primary: 'bg-primary text-background border-border hover:bg-primary-hover focus:ring-primary transition-colors duration-150',
  black: 'bg-background text-text-primary border-border hover:bg-sidebar focus-ring transition-colors duration-150',
  secondary: 'bg-surface text-text-secondary border-border hover:bg-sidebar focus-ring transition-colors duration-150',
  success: 'bg-success text-background border-border hover:bg-success-hover focus:ring-success transition-colors duration-150',
  danger: 'bg-danger text-background border-border hover:bg-danger-hover focus:ring-danger transition-colors duration-150',
  warning: 'bg-warning text-background border-border hover:bg-warning-hover focus:ring-warning transition-colors duration-150',
  info: 'bg-info text-background border-border hover:bg-info-hover focus:ring-info transition-colors duration-150',
};

const sizeClasses = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-6 py-3 text-base',
};
</script>

<template>
  <button
    :type="type"
    :disabled="disabled || loading"
    @click="emit('click', $event)"
    class="rounded-button font-medium inline-flex items-center justify-center gap-2 focus-ring disabled:cursor-not-allowed disabled:opacity-50"
    :class="[
      variantClasses[variant],
      sizeClasses[size]
    ]"
  >
    <svg
      v-if="loading"
      class="animate-spin h-4 w-4"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
    <slot />
  </button>
</template>