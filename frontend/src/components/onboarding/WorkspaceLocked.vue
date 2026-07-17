<script setup lang="ts">
import { useRouter } from 'vue-router';
import CmButton from '../ui/CmButton.vue';

const router = useRouter();

const handleCompleteSetup = () => {
  router.push({ name: 'SchoolSetup' });
};

const handleGoToDashboard = () => {
  router.push({ name: 'Home' });
};
</script>

<template>
  <div class="min-h-[60vh] flex items-center justify-center">
    <div class="premium-card bg-card p-10 text-center max-w-lg">
      <!-- Lock Icon -->
      <div class="mb-8">
        <div class="flex h-20 w-20 items-center justify-center rounded-full bg-warning/10 mx-auto mb-4">
          <svg class="h-10 w-10 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 002 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        
        <h2 class="text-headline mb-2">Your workspace isn't ready yet</h2>
        <p class="text-text-secondary">Complete your school profile to unlock fee collection.</p>
      </div>

      <!-- Actions -->
      <div class="space-y-3">
        <CmButton
          @click="handleCompleteSetup"
          variant="primary"
          class="w-full"
        >
          Complete Setup
        </CmButton>
        
        <CmButton
          @click="handleGoToDashboard"
          variant="secondary"
          class="w-full"
        >
          Go to Dashboard
        </CmButton>
      </div>
    </div>
  </div>
</template>