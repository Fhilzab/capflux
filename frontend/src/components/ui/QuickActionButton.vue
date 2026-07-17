<script setup lang="ts">
interface Props {
  label: string;
  icon?: string;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'brand';
  disabled?: boolean;
  shortcut?: string;
}

defineProps<Props>();

const emit = defineEmits<{
  click: [];
}>();

const variantClasses = {
  default: 'bg-brand/10 text-brand border border-brand/20 hover:bg-brand/20',
  success: 'bg-success/10 text-success border border-success/20 hover:bg-success/20',
  warning: 'bg-warning/10 text-warning border border-warning/20 hover:bg-warning/20',
  error: 'bg-danger/10 text-danger border border-danger/20 hover:bg-danger/20',
  info: 'bg-info/10 text-info border border-info/20 hover:bg-info/20',
  brand: 'bg-brand/10 text-brand border border-brand/20 hover:bg-brand/20',
};
</script>

<template>
  <button
    @click="emit('click')"
    :disabled="disabled"
    class="flex items-center justify-center gap-2.5 rounded-button px-4 py-3 text-sm font-medium transition-all duration-150 focus-ring disabled:cursor-not-allowed disabled:opacity-50 shadow-sm hover:shadow-md hover:-translate-y-0.5"
    :class="variantClasses[variant || 'default']"
  >
    <svg v-if="icon" class="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" :d="icon" />
    </svg>
    <span class="truncate">{{ label }}</span>
    <kbd v-if="shortcut" class="hidden sm:inline-flex items-center rounded-md bg-surface px-1.5 py-0.5 text-xs text-text-muted">{{ shortcut }}</kbd>
  </button>
</template>