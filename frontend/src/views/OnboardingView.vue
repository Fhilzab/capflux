<script setup lang="ts">
import { onMounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import { useOnboardingStore } from '../stores/onboardingStore';
import OnboardingProgress from '../components/onboarding/OnboardingProgress.vue';
import StageSchoolProfile from '../components/onboarding/StageSchoolProfile.vue';
import StageFinancialSetup from '../components/onboarding/StageFinancialSetup.vue';
import StageActivate from '../components/onboarding/StageActivate.vue';
import OnboardingComplete from '../components/onboarding/OnboardingComplete.vue';

const route = useRoute();
const onboardingStore = useOnboardingStore();

// Determine current stage from route
const currentStage = computed(() => {
  const path = route.path;
  if (path === '/onboarding/complete') return 'complete';
  if (path.includes('activate')) return 3; // Confirmation
  if (path.includes('financial-setup')) return 2; // Administrator Account
  return 1; // School Information
});

onMounted(() => {
  onboardingStore.initialize();
});
</script>

<template>
  <div class="min-h-screen bg-background">
    <div class="container mx-auto px-6 py-12">
      <div class="max-w-2xl mx-auto">
        <!-- Header -->
        <div class="mb-10 text-center">
          <h1 class="text-display mb-2">Welcome to Capstone</h1>
          <p class="text-text-secondary">Set up your school's fee collection in minutes</p>
        </div>

        <!-- Progress Indicator -->
        <OnboardingProgress 
          v-if="currentStage !== 'complete'"
          :current-step="currentStage" 
        />

        <!-- Stage Content -->
        <div class="mt-8">
          <StageSchoolProfile v-if="currentStage === 1" />
          <StageFinancialSetup v-if="currentStage === 2" />
          <StageActivate v-if="currentStage === 3" />
          <OnboardingComplete v-if="currentStage === 'complete'" />
        </div>
      </div>
    </div>
  </div>
</template>