<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useOnboardingStore } from '../../../stores/onboardingStore';
import { useSchoolStore } from '../../../stores/schoolStore';
import { runtimeEnvironment } from '../../../shared/environment/runtimeEnvironment';
import CmButton from '../../../components/ui/CmButton.vue';

const onboardingStore = useOnboardingStore();
const schoolStore = useSchoolStore();
const router = useRouter();

/**
 * Banner is visible only when setup genuinely requires action.
 * Uses authoritative onboarding/school state — not the legacy authStore
 * field which was never hydrated. While stores are still loading we
 * hide the banner to avoid flash-of-banner for the seeded sandbox
 * where school is ACTIVE / payment READY.
 */
const visible = computed(() => {
  if (runtimeEnvironment.isSandbox) return false;
  // Still loading initial state — do not flash banner.
  if (!onboardingStore.statusLoaded && !schoolStore.initialized) return false;
  // Explicit pending-setup status from either canonical source
  if (onboardingStore.requiresSetup || schoolStore.requiresSetup) return true;
  // No school at all (fresh user) — needs setup
  if (!onboardingStore.hasSchool && !schoolStore.school) return true;
  return false;
});

const handleCompleteSetup = () => {
  router.push({ name: 'KycSubmission' });
};
</script>

<template>
  <div
    v-if="visible"
    class="bg-brand/10 border border-brand/20 rounded-card p-4 mb-6 flex items-center justify-between gap-4 premium-card transition-all duration-300 hover:shadow-elevated"
  >
    <div class="flex-1">
      <p class="text-sm font-medium text-text-primary">
        Welcome to CAPFLUX. Complete your school profile to activate fee collection.
      </p>
    </div>
    <CmButton
      @click="handleCompleteSetup"
      variant="primary"
      size="sm"
    >
      Activate
    </CmButton>
  </div>
</template>