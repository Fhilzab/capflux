<template>
  <div class="mx-auto max-w-md rounded-card border border-divider bg-card px-6 py-8 text-center shadow-card">
    <Users class="mx-auto mb-4 h-12 w-12 text-text-muted opacity-50" aria-hidden="true" />
    <h3 class="mb-2 text-lg font-medium text-text-primary">
      No students registered yet
    </h3>
    <p class="mx-auto mb-6 max-w-md text-sm text-text-muted">
      Add your first student or import your existing
      student register to begin.
    </p>
    <div class="flex flex-col items-center justify-center gap-3 sm:flex-row">
      <CmButton variant="primary" size="md" @click="emit('add')">
        <UserPlus class="mr-2 h-4 w-4" />
        Add student
      </CmButton>
      <CmButton variant="secondary" size="md" @click="emit('import')">
        <Upload class="mr-2 h-4 w-4" />
        Import students
      </CmButton>
    </div>
    <p class="mt-4 text-xs text-text-muted">Excel · CSV supported</p>
  </div>
</template>

<script setup lang="ts">
import { Users, Upload, UserPlus } from '@lucide/vue';
import CmButton from '@/components/ui/CmButton.vue';

const emit = defineEmits<{
  (e: 'add'): void;
  (e: 'import'): void;
}>();
</script>
