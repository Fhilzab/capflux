<script setup lang="ts">
import { watch } from 'vue';

interface Props {
  modelValue: boolean;
  title?: string;
  placement?: 'left' | 'right';
  size?: 'sm' | 'md' | 'lg';
}

withDefaults(defineProps<Props>(), {
  placement: 'right',
  size: 'md',
});

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  close: [];
}>();

const sizeClasses = {
  sm: 'w-64',
  md: 'w-80',
  lg: 'w-96',
};

const closeDrawer = () => {
  emit('update:modelValue', false);
  emit('close');
};
</script>

<template>
  <teleport to="body">
    <transition
      enter-from-class="opacity-0"
      enter-active-class="transition-opacity duration-150"
      leave-to-class="opacity-0"
      leave-active-class="transition-opacity duration-150"
    >
      <div
        v-if="modelValue"
        class="fixed inset-0 z-modal bg-black/50 backdrop-blur-sm"
        @click.self="closeDrawer"
      >
        <transition
          :enter-from-class="placement === 'right' ? 'translate-x-full' : '-translate-x-full'"
          enter-active-class="transition-transform duration-150"
          :leave-to-class="placement === 'right' ? 'translate-x-full' : '-translate-x-full'"
          leave-active-class="transition-transform duration-150"
        >
          <div
            class="absolute top-0 h-full bg-card border-l border-border flex flex-col"
            :class="[
              placement === 'right' ? 'right-0' : 'left-0',
              sizeClasses[size],
            ]"
          >
            <div class="flex items-center justify-between p-5 border-b border-divider">
              <h2 v-if="title" class="text-lg font-semibold text-text-primary">{{ title }}</h2>
              <slot name="header" />
              <button
                @click="closeDrawer"
                class="rounded-button p-1.5 text-text-muted hover:text-text-primary hover:bg-surface transition-colors"
              >
                <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div class="flex-1 p-5 overflow-y-auto">
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