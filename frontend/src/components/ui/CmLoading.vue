<script setup lang="ts">
interface Props {
  variant?: 'spinner' | 'dots';
  size?: 'sm' | 'md' | 'lg';
  text?: string;
  fullscreen?: boolean;
}

withDefaults(defineProps<Props>(), {
  variant: 'spinner',
  size: 'md',
  fullscreen: false,
});
</script>

<template>
  <div
    class="flex items-center justify-center gap-3"
    :class="[
      fullscreen ? 'fixed inset-0 z-overlay bg-background/80 backdrop-blur-sm' : '',
    ]"
  >
    <div v-if="variant === 'spinner'" class="animate-spin rounded-full border-2 border-border border-t-primary" :class="[
      size === 'sm' ? 'h-4 w-4' : size === 'lg' ? 'h-8 w-8' : 'h-6 w-6',
    ]"></div>
    <div v-else class="flex gap-1">
      <div class="animate-bounce rounded-full bg-primary" :class="[
        size === 'sm' ? 'h-1.5 w-1.5' : size === 'lg' ? 'h-3 w-3' : 'h-2 w-2',
      ]" style="animation-delay: 0ms"></div>
      <div class="animate-bounce rounded-full bg-primary" :class="[
        size === 'sm' ? 'h-1.5 w-1.5' : size === 'lg' ? 'h-3 w-3' : 'h-2 w-2',
      ]" style="animation-delay: 150ms"></div>
      <div class="animate-bounce rounded-full bg-primary" :class="[
        size === 'sm' ? 'h-1.5 w-1.5' : size === 'lg' ? 'h-3 w-3' : 'h-2 w-2',
      ]" style="animation-delay: 300ms"></div>
    </div>
    <span v-if="text" class="text-sm text-text-secondary">{{ text }}</span>
  </div>
</template>