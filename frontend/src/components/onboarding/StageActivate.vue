<script setup lang="ts">
import { useRouter } from 'vue-router';
import { useOnboardingStore } from '../../stores/onboardingStore';
import CmButton from '../../components/ui/CmButton.vue';

const router = useRouter();
const onboardingStore = useOnboardingStore();

const goToDashboard = () => {
  onboardingStore.completeStep('confirmation');
  router.push('/dashboard');
};
</script>

<template>
  <div class="premium-card bg-card p-8 text-center">
    <!-- Success Icon -->
    <div class="mb-8">
      <div class="flex h-20 w-20 items-center justify-center rounded-full bg-success/10 mx-auto mb-4">
        <svg class="h-10 w-10 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      
      <h2 class="text-headline mb-2">Your school is ready.</h2>
      <p class="text-text-secondary max-w-md mx-auto">
        Capstone has prepared your financial workspace. You can now begin configuring your academic sessions and fee structure.
      </p>
    </div>

    <CmButton
      @click="goToDashboard"
      variant="primary"
      class="w-full"
    >
      Go to Dashboard
    </CmButton>
  </div>
</template>