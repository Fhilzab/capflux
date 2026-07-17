<script setup lang="ts">
import { useRouter } from 'vue-router';
import CmButton from '../../components/ui/CmButton.vue';

const router = useRouter();

const handleCompleteSetup = () => {
  router.push({ name: 'SchoolSetup' });
};
</script>

<template>
  <div class="bg-primary/5 border-b border-primary/20">
    <div class="container mx-auto px-6 py-4">
      <div class="flex items-center justify-between">
        <div class="flex-1">
          <div class="flex items-center gap-3">
            <div class="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <svg class="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 class="text-sm font-medium text-primary">Welcome to Capstone</h3>
              <p class="text-sm text-text-secondary">Complete your school profile to activate fee collection.</p>
            </div>
          </div>
        </div>
        
        <CmButton
          @click="handleCompleteSetup"
          variant="primary"
          size="sm"
        >
          Complete Setup
        </CmButton>
      </div>
    </div>
  </div>
</template>