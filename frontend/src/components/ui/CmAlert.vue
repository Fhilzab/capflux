<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  variant?: 'success' | 'danger' | 'warning' | 'info' | 'primary';
  title?: string;
  description?: string;
  dismissible?: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  dismiss: [];
}>();

const variantClasses = {
  primary: 'bg-primary/10 border-primary/20',
  success: 'bg-success/10 border-success/20',
  danger: 'bg-danger/10 border-danger/20',
  warning: 'bg-warning/10 border-warning/20',
  info: 'bg-info/10 border-info/20',
};

const iconColorClasses = {
  primary: 'text-primary',
  success: 'text-success',
  danger: 'text-danger',
  warning: 'text-warning',
  info: 'text-info',
};

const iconPath = computed(() => {
  switch (props.variant) {
    case 'success': return 'M9 12.75L11.25 15 15 9';
    case 'danger': return 'M12 9v3.75m-9 3.75h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z';
    case 'warning': return 'M12 9v3.75m-9 3.75h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z';
    case 'info': return 'M11.25 11.25l.375 3.75m0-3.75l-.375 3.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z';
    default: return 'M12 9v3.75m-9 3.75h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z';
  }
});
</script>

<template>
  <div class="rounded-card border p-4 flex items-start gap-3" :class="variantClasses[variant]">
    <div class="flex-shrink-0 mt-0.5">
      <svg
        class="h-5 w-5"
        :class="iconColorClasses[variant]"
        fill="none"
        viewBox="0 0 24 24"
        stroke-width="1.5"
        stroke="currentColor"
      >
        <path stroke-linecap="round" stroke-linejoin="round" :d="iconPath" />
      </svg>
    </div>
    <div class="flex-1">
      <h3 v-if="title" class="text-sm font-semibold text-text-primary">{{ title }}</h3>
      <p v-if="description" class="text-xs text-text-muted mt-0.5">{{ description }}</p>
      <slot />
    </div>
    <button
      v-if="dismissible"
      @click="emit('dismiss')"
      class="flex-shrink-0 text-text-muted hover:text-text-primary transition-colors"
    >
      <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  </div>
</template>