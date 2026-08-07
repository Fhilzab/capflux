<script setup lang="ts">
import { useModuleLock } from '../composables/useModuleLock';
import ModuleLockOverlay from '../features/onboarding/ModuleLockOverlay.vue';
import VirtualAccountHealth from '../features/dashboard/components/VirtualAccountHealth.vue';

const { paymentsLocked, loading } = useModuleLock();
</script>

<template>
  <div class="p-6">
    <ModuleLockOverlay v-if="paymentsLocked && !loading" variant="payment" />
    <template v-else>
      <div class="mb-6">
        <h1 class="text-headline">Virtual Accounts</h1>
        <p class="text-slate-500">Student payment accounts become available after financial activation.</p>
      </div>
      <VirtualAccountHealth />
    </template>
  </div>
</template>
