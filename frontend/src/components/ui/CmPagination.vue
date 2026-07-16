<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  currentPage: number;
  totalPages: number;
  totalItems?: number;
  itemsPerPage?: number;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  'update:currentPage': [page: number];
}>();

const visiblePages = computed(() => {
  const pages: (number | string)[] = [];
  const maxVisible = 5;
  
  if (props.totalPages <= maxVisible) {
    for (let i = 1; i <= props.totalPages; i++) {
      pages.push(i);
    }
  } else {
    if (props.currentPage <= 3) {
      pages.push(1, 2, 3, 4, '...', props.totalPages);
    } else if (props.currentPage >= props.totalPages - 2) {
      pages.push(1, '...', props.totalPages - 3, props.totalPages - 2, props.totalPages - 1, props.totalPages);
    } else {
      pages.push(1, '...', props.currentPage - 1, props.currentPage, props.currentPage + 1, '...', props.totalPages);
    }
  }
  
  return pages;
});

const goToPage = (page: number) => {
  if (page < 1 || page > props.totalPages) return;
  emit('update:currentPage', page);
};
</script>

<template>
  <div class="flex items-center justify-between">
    <div v-if="totalItems" class="text-xs text-text-muted">
      Showing {{ Math.min((currentPage - 1) * (itemsPerPage || 10) + 1, totalItems) }} to 
      {{ Math.min(currentPage * (itemsPerPage || 10), totalItems) }} of {{ totalItems }} results
    </div>
    <div class="flex items-center gap-1">
      <button
        @click="goToPage(currentPage - 1)"
        :disabled="currentPage === 1"
        class="rounded-button px-3 py-1.5 text-sm font-medium text-text-primary border border-border bg-surface hover:bg-surface/80 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 focus-ring"
      >
        Previous
      </button>
      <button
        v-for="page in visiblePages"
        :key="page"
        @click="goToPage(Number(page))"
        :disabled="typeof page === 'string'"
        class="rounded-button px-3 py-1.5 text-sm font-medium border transition-all duration-150 focus-ring"
        :class="[
          page === currentPage
            ? 'bg-primary text-white border-primary'
            : 'text-text-primary border-border bg-surface hover:bg-surface/80',
          typeof page === 'string' ? 'cursor-default' : '',
        ]"
      >
        {{ page }}
      </button>
      <button
        @click="goToPage(currentPage + 1)"
        :disabled="currentPage === totalPages"
        class="rounded-button px-3 py-1.5 text-sm font-medium text-text-primary border border-border bg-surface hover:bg-surface/80 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 focus-ring"
      >
        Next
      </button>
    </div>
  </div>
</template>