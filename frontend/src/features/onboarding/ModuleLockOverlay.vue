<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import CmButton from '@/components/ui/CmButton.vue';

interface Props {
  /** 'setup' = operational onboarding incomplete; 'payment' = KYC incomplete */
  variant?: 'setup' | 'payment';
  title?: string;
  message?: string;
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'setup',
});

const router = useRouter();

const config = computed(() => {
  if (props.variant === 'payment') {
    return {
      title: props.title || 'Payments Locked',
      message:
        props.message ||
        'Complete your school\'s KYC to activate fee collection. Student dedicated virtual accounts, automatic payment verification, and settlement will become available after CAPFLUX verifies your school.',
      ctaLabel: 'Complete KYC',
      ctaRoute: 'KycSubmission',
    };
  }
  return {
    title: props.title || 'Setup Required',
    message:
      props.message ||
      'Complete your school setup first. Finish your setup to unlock operational features.',
    ctaLabel: 'Complete Setup',
    ctaRoute: 'SchoolSetup',
  };
});

function handleAction() {
  router.push({ name: config.value.ctaRoute });
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
    <div class="rounded-card bg-card p-8 shadow-elevated max-w-md w-full mx-4 text-center">
      <div class="w-16 h-16 rounded-full bg-warning/10 flex items-center justify-center mx-auto mb-4">
        <span class="text-3xl">🔒</span>
      </div>
      <h3 class="text-xl font-semibold text-text-primary mb-3">{{ config.title }}</h3>
      <p class="text-sm text-text-secondary mb-6">{{ config.message }}</p>
      <CmButton variant="primary" @click="handleAction">
        {{ config.ctaLabel }}
      </CmButton>
    </div>
  </div>
</template>

<style scoped>
.backdrop-blur-sm {
  backdrop-filter: blur(4px);
}
</style>
