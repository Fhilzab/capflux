<script setup lang="ts">
interface Props {
  title?: string;
  description?: string;
  error?: string;
}

withDefaults(defineProps<Props>(), {
  title: 'Something went wrong',
  description: 'Unable to load the requested data.',
});

const emit = defineEmits<{
  retry: [];
}>();
</script>

<template>
  <div class="flex flex-col items-center justify-center rounded-card bg-danger/5 p-10 text-center border border-danger/20">
    <div class="flex h-16 w-16 items-center justify-center rounded-card bg-danger/10 mb-4">
      <svg class="h-8 w-8 text-danger" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9 3.75h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </div>
    <h3 class="text-title text-text-primary mb-1">{{ title }}</h3>
    <p class="text-sm text-text-muted mb-4 max-w-sm">{{ error || description }}</p>
    <button @click="emit('retry')" class="rounded-button bg-info/10 px-5 py-2.5 text-sm font-medium text-info border border-info/20 hover:bg-info/20 transition-colors focus-ring">
      Try Again
    </button>
  </div>
</template>