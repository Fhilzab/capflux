<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useOnboardingStore } from '@/stores/onboardingStore';
import CmButton from '@/components/ui/CmButton.vue';
import CmAlert from '@/components/ui/CmAlert.vue';

const router = useRouter();
const onboardingStore = useOnboardingStore();

const kycInfo = ref(null);

const paymentStatus = computed(() => onboardingStore.paymentStatus);
const requiresKYC = computed(() => onboardingStore.requiresKYC);
const isUnderReview = computed(() => onboardingStore.isUnderReview);

const statusLabel = computed(() => {
  if (isUnderReview.value) return 'Under Review';
  if (requiresKYC.value) return 'Pending KYC';
  return 'Not Started';
});

async function loadKyc() {
  try {
    kycInfo.value = await onboardingStore.getKycStatus();
  } catch (e) {
    console.error('Failed to load KYC status:', e);
  }
}

onMounted(() => {
  if (onboardingStore.status === null) {
    onboardingStore.loadStatus();
  } else {
    loadKyc();
  }
});

function goToKycSubmission() {
  router.push({ name: 'KycSubmission' });
}
</script>

<template>
  <section class="rounded-card bg-card p-8 shadow-card">
    <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <h2 class="text-2xl font-semibold text-text-primary">Activate Payments</h2>
        <p class="text-sm text-text-muted mt-1">
          Complete your school's KYC to activate fee collection.
          Dedicated Virtual Accounts and payment verification become
          available after CAPFLUX verifies your school.
        </p>
      </div>
      <div v-if="requiresKYC || !kycInfo" class="flex flex-col items-end gap-2">
        <span class="text-sm font-medium text-text-secondary">
          Estimated activation: 1–2 business days
        </span>
        <CmButton variant="primary" @click="goToKycSubmission">
          Complete KYC
        </CmButton>
      </div>
    </div>

    <div v-if="requiresKYC" class="mt-4">
      <CmAlert variant="info">
        Status: {{ statusLabel }}
      </CmAlert>
    </div>

    <div v-else-if="paymentStatus === 'READY'" class="mt-4">
      <CmAlert variant="success">
        Your payments are fully activated. You can now collect fees.
      </CmAlert>
    </div>
  </section>
</template>
