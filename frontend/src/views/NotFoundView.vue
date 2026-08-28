<script setup lang="ts">
import CmButton from '../components/ui/CmButton.vue';
import { runtimeEnvironment } from '../shared/environment/runtimeEnvironment';

const goHome = () => {
  if (runtimeEnvironment.isSandbox) {
    window.location.href = 'https://capflux.vercel.app';
  } else {
    window.location.href = '/';
  }
};
</script>

<template>
  <div class="flex min-h-screen flex-col items-center justify-center bg-background px-4">
    <div class="text-center">
      <h1 class="text-7xl font-bold text-brand mb-4">404</h1>
      <h2 class="text-2xl font-semibold text-text-primary mb-2">Page Not Found</h2>
      <p class="text-text-secondary mb-8 max-w-md">
        The page you're looking for doesn't exist or has been moved.
      </p>
      
      <CmButton
        @click="goHome"
        variant="primary"
      >
        Go to Homepage
      </CmButton>
    </div>
  </div>
</template>