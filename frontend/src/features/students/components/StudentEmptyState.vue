<template>
  <div class="text-center">
    <Users class="mx-auto mb-4 h-12 w-12 text-text-muted opacity-50" />
    <h3 class="mb-2 text-lg font-medium text-text-primary">
      No students registered yet
    </h3>
    <p class="mx-auto mb-6 max-w-md text-sm text-text-muted">
      Add your first student manually or import your existing student
      register from Excel, CSV or Google Sheets.
    </p>
    <div class="flex items-center justify-center gap-3">
      <CmButton variant="primary" size="md" @click="emit('add')">
        <UserPlus class="mr-2 h-4 w-4" />
        Add student
      </CmButton>
      <CmButton variant="secondary" size="md" @click="emit('import')">
        <Upload class="mr-2 h-4 w-4" />
        Import students
      </CmButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Users, Upload, UserPlus } from '@lucide/vue';
import CmButton from '@/components/ui/CmButton.vue';
</script>
