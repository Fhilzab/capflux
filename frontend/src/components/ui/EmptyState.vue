<script setup lang="ts">
interface Props {
  title: string;
  description: string;
  icon?: string;
}

defineProps<Props>();
</script>

<template>
  <div class="flex flex-col items-center justify-center rounded-2xl bg-slate-900/30 p-10 text-center border border-slate-800/50">
    <div class="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-800/50 mb-4">
      <svg v-if="icon" class="h-8 w-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" :d="icon" />
      </svg>
      <svg v-else class="h-8 w-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v7a2 2 0 01-2 2H6a2 2 0 01-2-2v-7m16 0h-2M4 13h2m12 0h2M4 13v-2m2 0h2m4 0h2m2 0v2" />
      </svg>
    </div>
    <h3 class="text-lg font-semibold text-white mb-1">{{ title }}</h3>
    <p class="text-sm text-slate-500 max-w-sm">{{ description }}</p>
  </div>
</template>