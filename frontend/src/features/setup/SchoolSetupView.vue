<script setup lang="ts">
/**
 * SchoolSetupView — canonical 4-step operational onboarding wizard.
 *
 * Steps:
 *   1. Profile
 *   2. Organization
 *   3. School
 *   4. Owner Information
 *
 * On completion the backend transitions the school to ACTIVE (operational)
 * and payment_status to PENDING_KYC. KYC is a separate compliance flow and
 * is NOT required for the school to be operational.
 */
import { computed, onMounted } from 'vue';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { useAuthStore } from '@/stores/authStore';
import OnboardingChecklist from '@/features/onboarding/OnboardingChecklist.vue';
import ProfileStep from '@/features/onboarding/steps/ProfileStep.vue';
import OrganizationStep from '@/features/onboarding/steps/OrganizationStep.vue';
import SchoolStep from '@/features/onboarding/steps/SchoolStep.vue';
import OwnerInfoStep from '@/features/onboarding/steps/OwnerInfoStep.vue';
import CmButton from '@/components/ui/CmButton.vue';
import CmAlert from '@/components/ui/CmAlert.vue';

const onboardingStore = useOnboardingStore();
const authStore = useAuthStore();

const currentStep = computed(() => onboardingStore.currentStep);
const error = computed(() => onboardingStore.error);

const stepTitle = computed(() => {
  const titles: Record<number, string> = {
    1: 'Complete Your Profile',
    2: 'Create Your Organization',
    3: 'Register Your School',
    4: 'Owner Information',
  };
  return titles[currentStep.value] || 'School Setup';
});

// Load onboarding status on mount so the wizard reflects server truth.
onMounted(async () => {
  if (authStore.isAuthenticated) {
    await onboardingStore.loadStatus();
  }
});
</script>

<template>
  <main class="min-h-screen bg-background text-text-primary">
    <div class="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div class="grid gap-8 lg:grid-cols-[280px_1fr]">
        <!-- Progress checklist -->
        <OnboardingChecklist />

        <!-- Active step -->
        <section class="rounded-card bg-card p-8 shadow-card">
          <div class="mb-6">
            <h1 class="text-2xl font-semibold text-text-primary">{{ stepTitle }}</h1>
            <p class="mt-1 text-sm text-text-muted">
              Step {{ currentStep }} of 4 — CAPFLUX school setup
            </p>
          </div>

          <CmAlert v-if="error" variant="error" class="mb-6">{{ error }}</CmAlert>

          <ProfileStep v-if="currentStep === 1" />
          <OrganizationStep v-else-if="currentStep === 2" />
          <SchoolStep v-else-if="currentStep === 3" />
          <OwnerInfoStep v-else-if="currentStep === 4" />

          <div v-else class="text-sm text-text-muted">
            Setup is complete. Returning to dashboard...
          </div>

          <div class="mt-8 flex items-center justify-between">
            <CmButton
              v-if="currentStep > 1"
              variant="ghost"
              @click="onboardingStore.goToPreviousStep()"
            >
              Back
            </CmButton>
            <CmButton
              v-if="currentStep === 4 && onboardingStore.isOnboardingComplete"
              variant="primary"
              @click="onboardingStore.completeOnboarding()"
            >
              Complete Setup
            </CmButton>
          </div>
        </section>
      </div>
    </div>
  </main>
</template>
