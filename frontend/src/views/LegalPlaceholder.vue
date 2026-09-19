<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router';
import CmButton from '../components/ui/CmButton.vue';

const route = useRoute();
const router = useRouter();
const pageName = route.name === 'Terms' ? 'Terms of Service' : 'Privacy Policy';
</script>

<template>
  <div class="min-h-screen bg-background flex items-center justify-center p-4">
    <div class="text-center max-w-md">
      <div class="mx-auto h-16 w-16 rounded-full bg-brand/10 flex items-center justify-center mb-6">
        <svg class="h-8 w-8 text-brand" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
        </svg>
      </div>
      <h1 class="text-headline mb-2">{{ pageName }}</h1>
      <p class="text-text-secondary mb-6">
        This page is under development. {{ pageName }} details will be available soon.
      </p>
      <CmButton variant="primary" @click="router.push('/')">
        Back to Home
      </CmButton>
    </div>
  </div>
</template>
