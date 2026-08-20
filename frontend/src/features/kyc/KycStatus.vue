<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { useFinancialActivationStore } from '@/stores/financialActivationStore';
import CmButton from '@/components/ui/CmButton.vue';
import CmAlert from '@/components/ui/CmAlert.vue';

const router = useRouter();
const onboardingStore = useOnboardingStore();
const activationStore = useFinancialActivationStore();

const status = computed(() => activationStore.kycState || 'PENDING');
const paymentStatus = computed(() => onboardingStore.paymentStatus);

const statusSteps = [
  { key: 'PENDING', label: 'Submitted', icon: 'circle' },
  { key: 'UNDER_REVIEW', label: 'Under Review', icon: 'search' },
  { key: 'VERIFIED', label: 'Verified', icon: 'check' },
  { key: 'REJECTED', label: 'Rejected', icon: 'x' },
];

function isActive(step: string): boolean {
  const order = ['PENDING', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED'];
  const currentIdx = order.indexOf(status.value);
  const stepIdx = order.indexOf(step);
  return stepIdx < currentIdx || (stepIdx === currentIdx);
}

const kyc = computed(() => activationStore.kycStatus?.kyc);

async function loadKyc() {
  try {
    await activationStore.loadKycStatus();
  } catch (e) {
    console.error('Failed to load KYC status:', e);
  }
}

onMounted(() => {
  if (onboardingStore.status === null) {
    onboardingStore.loadStatus();
  }
  activationStore.loadKycStatus();
});

function handleResubmit() {
  router.push({ name: 'KycSubmission', query: { section: 'identity' } });
}
</script>

<template>
  <main class="min-h-screen bg-background text-text-primary p-8">
    <div class="max-w-4xl mx-auto space-y-6">
      <h1 class="text-4xl font-semibold mb-2">KYC Verification Status</h1>

      <CmAlert v-if="status === 'REJECTED'" variant="danger">
        Your KYC was rejected. Reason: {{ kyc?.rejectionReason || 'Not specified' }}
      </CmAlert>

      <section class="rounded-card bg-card p-8 shadow-card">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-xl font-semibold">Verification Timeline</h2>
          <span class="text-sm font-medium" :class="{
            'text-success': status === 'VERIFIED',
            'text-warning': status === 'PENDING' || status === 'UNDER_REVIEW',
            'text-danger': status === 'REJECTED',
          }">
            Current: {{ status }}
          </span>
        </div>

        <div class="space-y-4">
          <div
            v-for="step in statusSteps"
            :key="step.key"
            class="flex items-center gap-4"
            :class="isActive(step.key) ? 'opacity-100' : 'opacity-40'"
          >
            <div class="flex h-8 w-8 items-center justify-center rounded-full border-2"
              :class="isActive(step.key) ? 'border-success bg-success/10 text-success' : 'border-border text-text-muted'">
              <span v-if="step.icon === 'check'" class="font-bold">✓</span>
              <span v-else-if="step.icon === 'x'" class="font-bold">✕</span>
              <span v-else class="w-2 h-2 rounded-full bg-current" />
            </div>
            <span class="font-medium">{{ step.label }}</span>
          </div>
        </div>
      </section>

      <section v-if="kyc" class="rounded-card bg-card p-8 shadow-card">
        <h2 class="text-xl font-semibold mb-4">Identity Summary</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p class="text-sm text-text-muted">BVN</p>
            <p class="font-medium">{{ kyc.bvnMasked || '•••• ••••' }}</p>
          </div>
          <div>
            <p class="text-sm text-text-muted">NIN</p>
            <p class="font-medium">{{ kyc.ninMasked || '••••••• ••••' }}</p>
          </div>
          <div>
            <p class="text-sm text-text-muted">Verification Provider</p>
            <p class="font-medium">{{ kyc.verificationProvider || 'Not yet assigned' }}</p>
          </div>
          <div>
            <p class="text-sm text-text-muted">Submitted</p>
            <p class="font-medium">{{ kyc.submittedAt || 'N/A' }}</p>
          </div>
        </div>
      </section>

      <div class="flex gap-4 pt-4">
        <CmButton v-if="status === 'REJECTED'" variant="primary" @click="handleResubmit">
          Resubmit KYC
        </CmButton>
        <CmButton variant="ghost" @click="router.push({ name: 'KycDashboard' })">
          Back to Dashboard
        </CmButton>
      </div>
    </div>
  </main>
</template>
