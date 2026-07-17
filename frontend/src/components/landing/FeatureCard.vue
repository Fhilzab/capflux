<script setup lang="ts">
interface Props {
  icon: string;
  title: string;
  description: string;
  delay?: number;
}

defineProps<Props>();
</script>

<template>
  <div
    class="premium-card bg-card p-6 transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5"
    :style="{ animationDelay: `${delay || 0}ms` }"
  >
    <div class="flex h-12 w-12 items-center justify-center rounded-xl bg-brand/10 mb-4 border border-brand/20">
      <svg class="h-6 w-6 text-brand" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" :d="icon" />
      </svg>
    </div>
    <h3 class="text-lg font-semibold text-text-primary mb-2">{{ title }}</h3>
    <p class="text-sm text-text-secondary">{{ description }}</p>
  </div>
</template>

<style scoped>
@media (prefers-reduced-motion: no-preference) {
  .premium-card {
    animation: fadeInUp 0.5s ease-out forwards;
    opacity: 0;
    transform: translateY(20px);
  }
  
  @keyframes fadeInUp {
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
}
</style>