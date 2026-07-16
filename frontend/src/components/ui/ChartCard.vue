<script setup lang="ts">
interface Props {
  title: string;
  description?: string;
}

withDefaults(defineProps<Props>(), {});
</script>

<template>
  <div class="premium-card flex flex-col h-full">
    <div class="p-5 border-b border-divider flex-shrink-0">
      <h3 class="text-sm font-semibold text-text-primary">{{ title }}</h3>
      <p v-if="description" class="text-xs text-text-muted mt-1">{{ description }}</p>
    </div>
    <div class="flex-1 p-5 min-h-0">
      <slot />
    </div>
  </div>
</template>