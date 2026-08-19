<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import CmButton from '@/components/ui/CmButton.vue';

interface Props {
  /**
   * Verification gate type:
   * - 'setup'     — operational onboarding (Profile/Org/School/Owner) incomplete
   * - 'kyc'       — KYC / identity verification not yet completed
   * - 'settlement' — settlement account not yet verified
   * - 'payment'   — payment activation prerequisites not satisfied
   * - 'provider'  — payment provider not yet ready
   */
  variant?: 'setup' | 'kyc' | 'settlement' | 'payment' | 'provider';
  title?: string;
  message?: string;
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'setup',
});

const router = useRouter();

const config = computed(() => {
  switch (props.variant) {
    case 'kyc':
      return {
        title: props.title || 'KYC Verification Required',
        message:
          props.message ||
          'Your business identity verification must be completed before accessing financial features. This includes verifying representative identity (BVN/NIN) and, where applicable, your CAC registration.',
        ctaLabel: 'Complete KYC',
        ctaRoute: { name: 'KycSubmission', query: { section: 'identity' } },
      };

    case 'settlement':
      return {
        title: props.title || 'Settlement Verification Required',
        message:
          props.message ||
          'Your settlement account must be verified before settlement information can be accessed. This ensures funds are directed to the correct business account.',
        ctaLabel: 'Verify Settlement',
        ctaRoute: { name: 'KycSubmission', query: { section: 'settlement' } },
      };

    case 'payment':
      return {
        title: props.title || 'Payments Locked',
        message:
          props.message ||
          'Complete your school’s KYC, settlement verification, and payment activation to unlock fee collection. Student dedicated virtual accounts, automatic payment verification, and settlement will become available after CAPFLUX verifies your school.',
        ctaLabel: 'Complete Verification',
        ctaRoute: { name: 'KycSubmission', query: { section: 'settlement' } },
      };

    case 'provider':
      return {
        title: props.title || 'Payment Provider Not Ready',
        message:
          props.message ||
          'Payment collection is not yet activated for your school. Your payment provider is being configured. You will receive an email once it is ready.',
        ctaLabel: 'View Status',
        ctaRoute: { name: 'KycStatus' },
      };

    default:
      return {
        title: props.title || 'Setup Required',
        message:
          props.message ||
          'Complete your school setup first. Finish your setup to unlock operational features.',
        ctaLabel: 'Continue Setup',
        ctaRoute: { name: 'KycSubmission' },
      };
  }
});

function handleAction() {
  router.push(config.value.ctaRoute);
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
      <div class="flex justify-center">
        <CmButton variant="primary" @click="handleAction">
          {{ config.ctaLabel }}
        </CmButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
.backdrop-blur-sm {
  backdrop-filter: blur(4px);
}
</style>
