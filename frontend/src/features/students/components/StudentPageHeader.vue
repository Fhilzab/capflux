<template>
  <div class="border-b border-divider bg-card px-4 py-4 sm:px-6">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div class="min-w-0">
        <div class="flex flex-wrap items-center gap-3" data-testid="students-page-title">
          <h1 class="text-2xl font-semibold text-text-primary">Students</h1>
          <span
            v-if="studentCount !== undefined"
            class="rounded-full bg-surface px-3 py-1 text-sm font-medium text-text-secondary border border-border"
            data-testid="students-count"
          >
            {{ studentCount }}
          </span>
        </div>
        <p class="mt-1 text-sm text-text-secondary">
          Student register — search, enroll and manage every student in your school.
        </p>
      </div>
      <!-- Hidden when the empty state owns the CTAs, so Add/Import never compete. -->
      <div v-if="!hideActions" class="flex flex-shrink-0 items-center gap-3">
        <CmButton variant="secondary" size="md" data-testid="header-import-students" @click="$emit('import')">
          <Upload class="mr-2 h-4 w-4" />
          Import students
        </CmButton>
        <CmButton variant="primary" size="md" data-testid="header-add-student" @click="$emit('add')">
          <UserPlus class="mr-2 h-4 w-4" />
          Add student
        </CmButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Upload, UserPlus } from '@lucide/vue';
import CmButton from '@/components/ui/CmButton.vue';

withDefaults(
  defineProps<{
    hideActions?: boolean;
    studentCount?: number;
  }>(),
  { hideActions: false },
);

defineEmits<{
  (e: 'import'): void;
  (e: 'add'): void;
}>();
</script>