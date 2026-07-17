<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';

interface Props {
  modelValue: boolean;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  closable?: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  close: [];
}>();

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
};

const closeModal = () => {
  emit('update:modelValue', false);
  emit('close');
};

const handleEscape = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    closeModal();
  }
};

onMounted(() => {
  if (props.modelValue) {
    document.body.style.overflow = 'hidden';
  }
});

watch(() => props.modelValue, (open) => {
  document.body.style.overflow = open ? 'hidden' : '';
});

onUnmounted(() => {
  document.body.style.overflow = '';
});
</script>

<template>
  <teleport to="body">
    <transition
      enter-from-class="opacity-0"
      enter-active-class="transition-opacity duration-200"
      leave-to-class="opacity-0"
      leave-active-class="transition-opacity duration-200"
    >
      <div
        v-if="modelValue"
        class="fixed inset-0 z-modal flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        @click.self="closeModal"
      >
        <transition
          enter-from-class="opacity-0 scale-95 -translate-y-4"
          enter-active-class="transition-all duration-200"
          leave-to-class="opacity-0 scale-95 -translate-y-4"
          leave-active-class="transition-all duration-200"
        >
          <div
            class="relative w-full rounded-dialog border border-border bg-card shadow-xl"
            :class="sizeClasses[size]"
          >
            <div class="flex items-center justify-between p-5 border-b border-divider">
              <h2 v-if="title" class="text-lg font-semibold text-text-primary">{{ title }}</h2>
              <slot name="header" />
              <button
                v-if="closable"
                @click="closeModal"
                class="rounded-button p-1.5 text-text-muted hover:text-text-primary hover:bg-surface transition-colors focus-ring"
              >
                <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div class="p-5 max-h-[60vh] overflow-y-auto">
              <slot />
            </div>
            <div v-if="$slots.footer" class="p-5 border-t border-divider">
              <slot name="footer" />
            </div>
          </div>
        </transition>
      </div>
    </transition>
  </teleport>
</template>