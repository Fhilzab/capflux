<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useOnboardingStore } from '../../stores/onboardingStore';

const router = useRouter();
const onboardingStore = useOnboardingStore();

const loading = ref(false);
const error = ref('');

const checklist = computed(() => [
  { id: 1, label: 'School Created', complete: !!onboardingStore.schoolId },
  { id: 2, label: 'Business Verified', complete: onboardingStore.businessVerified },
  { id: 3, label: 'Settlement Account Verified', complete: onboardingStore.settlementVerified },
  { id: 4, label: 'Tuition Configured', complete: false },
  { id: 5, label: 'Billing Rules Configured', complete: false },
  { id: 6, label: 'Payment Service Ready', complete: onboardingStore.paymentServiceReady },
  { id: 7, label: 'Ready for Student Virtual Accounts', complete: onboardingStore.activated },
]);

const allRequirementsMet = computed(() => 
  onboardingStore.schoolId && 
  onboardingStore.businessVerified && 
  onboardingStore.settlementVerified
);

const handleActivate = async () => {
  loading.value = true;
  error.value = '';
  
  try {
    await onboardingStore.activateCollections();
    router.push('/onboarding/complete');
  } catch (e: any) {
    error.value = e.message || 'Failed to activate collections';
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <div class="premium-card p-8">
    <h2 class="text-headline mb-2">Activate Collections</h2>
    <p class="text-slate-500 mb-6">Review your readiness checklist before activating fee collection</p>

    <!-- Readiness Checklist -->
    <div class="space-y-4 mb-8">
      <div v-for="item in checklist" :key="item.id" class="flex items-center gap-3 p-4 rounded-xl bg-slate-100/50 dark:bg-slate-800/50">
        <div class="flex h-6 w-6 items-center justify-center rounded-full" :class="item.complete ? 'bg-emerald-500/10 text-emerald-600' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'">
          <svg v-if="item.complete" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
          <svg v-else class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <circle cx="12" cy="12" r="10" />
          </svg>
        </div>
        <span class="font-medium" :class="item.complete ? 'text-slate-900 dark:text-white' : 'text-slate-500'">
          {{ item.label }}
        </span>
      </div>
    </div>

    <!-- Payment Service Status (No provider selection) -->
    <div class="p-4 rounded-xl bg-slate-100/50 dark:bg-slate-800/50 mb-8">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm font-medium text-slate-700 dark:text-slate-300">Payment Service</p>
          <p class="text-xs text-slate-500 dark:text-slate-400">Managed by Capstone</p>
        </div>
        <span class="text-xs px-2 py-1 rounded bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
          Auto-configured
        </span>
      </div>
    </div>

    <p v-if="error" class="text-sm text-rose-600 mb-4">{{ error }}</p>

    <button
      @click="handleActivate"
      :disabled="!allRequirementsMet || loading"
      class="w-full rounded-xl px-4 py-3 bg-cyan-500 text-slate-950 font-medium hover:bg-cyan-400 transition-colors disabled:opacity-50 focus-ring"
    >
      {{ loading ? 'Activating...' : 'Activate Fee Collection' }}
    </button>
  </div>
</template>