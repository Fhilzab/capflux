<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';

interface Props {
  variant?: 'success' | 'danger' | 'warning' | 'info' | 'primary';
  title: string;
  description?: string;
  duration?: number;
  closable?: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  close: [];
}>();

const isVisible = ref(true);
let timeoutId: ReturnType<typeof setTimeout> | null = null;

const variantClasses = {
  primary: 'bg-brand/10 border-brand/20',
  success: 'bg-success/10 border-success/20',
  danger: 'bg-danger/10 border-danger/20',
  warning: 'bg-warning/10 border-warning/20',
  info: 'bg-info/10 border-info/20',
};

const iconColorClasses = {
  primary: 'text-brand',
  success: 'text-success',
  danger: 'text-danger',
  warning: 'text-warning',
  info: 'text-info',
};

const closeToast = () => {
  isVisible.value = false;
  emit('close');
};

watch(isVisible, (visible) => {
  if (!visible && timeoutId) {
    clearTimeout(timeoutId);
    timeoutId = null;
  }
});

onUnmounted(() => {
  if (timeoutId) {
    clearTimeout(timeoutId);
  }
});
</script>

<template>
  <transition
    enter-from-class="opacity-0 translate-x-8"
    enter-active-class="transition duration-300"
    leave-to-class="opacity-0 translate-x-8"
    leave-active-class="transition duration-200"
  >
    <div
      v-if="isVisible"
      class="fixed top-4 right-4 z-notification rounded-card border p-4 shadow-elevated flex items-start gap-3 w-80"
      :class="variantClasses[variant]"
    >
      <div class="flex-shrink-0 mt-0.5">
        <svg
          class="h-5 w-5"
          :class="iconColorClasses[variant]"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="1.5"
          stroke="currentColor"
        >
          <path stroke-linecap="round" stroke-linejoin="round" :d="
            variant === 'success' 
              ? 'M9 12.75L11.25 15 15 9' 
              : variant === 'danger' || variant === 'warning'
              ? 'M12 9v3.75m-9 3.75h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
              : 'M11.25 11.25l.375 3.75m0-3.75l-.375 3.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
          " />
        </svg>
      </div>
      <div class="flex-1">
        <p class="text-sm font-medium text-text-primary">{{ title }}</p>
        <p v-if="description" class="text-xs text-text-secondary mt-0.5">{{ description }}</p>
      </div>
      <button
        v-if="closable"
        @click="closeToast"
        class="flex-shrink-0 text-text-muted hover:text-text-primary transition-colors focus-ring"
      >
        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  </transition>
</template>