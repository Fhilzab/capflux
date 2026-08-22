<script setup lang="ts">
import { computed } from 'vue';
import { useAuthStore } from '../../../stores/authStore';
import { useSchoolStore } from '../../../stores/schoolStore';

const authStore = useAuthStore();
const schoolStore = useSchoolStore();

const displayName = computed(() => {
  const email = authStore.user?.email || '';
  if (!email) return 'there';
  const name = email.split('@')[0];
  return name || 'there';
});

const schoolName = computed(() => {
  return schoolStore.school?.name || authStore.organization?.name || '';
});

const supportingText = computed(() => {
  if (schoolName.value) {
    return `Overview of ${schoolName.value}'s financial activity.`;
  }
  return 'Overview of your school\'s financial activity.';
});
</script>

<template>
  <header class="mb-6">
    <div class="flex flex-col">
      <div class="flex items-center gap-2">
        <h1 class="text-xl font-semibold text-text-primary tracking-tight">
          Overview
        </h1>
      </div>
      <p v-if="!authStore.loading && authStore.isAuthenticated" class="mt-1 text-sm text-text-muted">
        Good morning, {{ displayName }}.
      </p>
      <p class="text-sm text-text-muted">
        {{ supportingText }}
      </p>
    </div>
  </header>
</template>
