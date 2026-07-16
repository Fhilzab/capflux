<script setup lang="ts">
import GuardianInsights from '../features/dashboard/components/GuardianInsights.vue';
</script>

<template>
  <div class="p-6 transition-colors duration-200">
    <div class="mb-6">
      <h1 class="text-headline">Guardians</h1>
      <p class="text-text-muted">Manage parent/guardian accounts</p>
    </div>
    
    <GuardianInsights />
  </div>
</template>