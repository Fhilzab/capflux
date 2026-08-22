<template>
  <div class="border-b border-divider bg-card px-6 py-4">
    <div class="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 class="text-2xl font-semibold text-text-primary">Students</h1>
        <p class="mt-1 text-sm text-text-secondary">
          Manage your school's students, guardians, classes and enrollment records.
        </p>
      </div>
      <div class="flex items-center gap-3 mt-2 sm:mt-0">
        <CmButton variant="secondary" size="md" @click="$emit('import')">
          <Upload class="mr-2 h-4 w-4" />
          Import students
        </CmButton>
        <CmButton variant="primary" size="md" @click="$emit('add')">
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
</script>
