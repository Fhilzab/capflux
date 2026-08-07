<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { useRouter } from 'vue-router';
import CmButton from '@/components/ui/CmButton.vue';

const onboarding = useOnboardingStore();
const router = useRouter();

const steps = computed(() => [
  { key: 'profile', label: 'Profile', completed: onboarding.profileCompleted, step: 1 },
  { key: 'organization', label: 'Organization', completed: onboarding.organizationCompleted, step: 2 },
  { key: 'school', label: 'School', completed: onboarding.schoolCompleted, step: 3 },
  { key: 'owner', label: 'Owner Information', completed: onboarding.ownerCompleted, step: 4 },
]);

function goToStep(stepNum: number) {
  onboarding.setStep(stepNum);
  router.push({ name: 'SchoolSetup', query: { step: stepNum } });
}
</script>

<template>
  <aside
    v-if="onboarding.requiresSetup"
    class="sticky top-6 space-y-4"
  >
    <div class="rounded-card bg-card p-6 shadow-card">
      <h3 class="text-lg font-semibold text-text-primary mb-4">School Setup</h3>

      <!-- Progress bar -->
      <div class="w-full bg-surface rounded-full h-3 mb-2 overflow-hidden">
        <div
          class="bg-brand h-3 rounded-full transition-all duration-300"
          :style="{ width: onboarding.progressPercent + '%' }"
        />
      </div>

      <p class="text-sm font-medium text-text-primary mb-4">
        {{ onboarding.progressPercent }}% Complete
      </p>

      <!-- Checklist items -->
      <ul class="space-y-2">
        <li
          v-for="step in steps"
          :key="step.key"
          class="flex items-center justify-between"
        >
          <span class="text-sm text-text-secondary">{{ step.label }}</span>
          <span
            class="text-base"
            :class="step.completed ? 'text-success' : 'text-text-muted'"
          >
            {{ step.completed ? '✓' : '☐' }}
          </span>
        </li>
      </ul>

      <CmButton
        variant="primary"
        size="sm"
        class="w-full mt-4"
        @click="goToStep(onboarding.currentStep)"
      >
        Continue Setup
      </CmButton>
    </div>
  </aside>
</template>
