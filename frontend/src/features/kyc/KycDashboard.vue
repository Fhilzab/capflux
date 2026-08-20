<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useFinancialActivationStore } from '@/stores/financialActivationStore';
import { useOnboardingStore } from '@/stores/onboardingStore';
import CmButton from '@/components/ui/CmButton.vue';
import CmAlert from '@/components/ui/CmAlert.vue';
import CmBadge from '@/components/ui/CmBadge.vue';

const router = useRouter();
const activationStore = useFinancialActivationStore();
const onboardingStore = useOnboardingStore();

const kycState = computed(() => activationStore.kycState);
const kycRejected = computed(() => activationStore.kycRejected);
const kycVerified = computed(() => activationStore.kycVerified);
const kycUnderReview = computed(() => activationStore.kycUnderReview);
const rejectionReason = computed(() => activationStore.rejectionReason);
const settlementState = computed(() => activationStore.settlementState);
const settlementVerified = computed(() => activationStore.settlementVerified);
const gatewayProvider = computed(() => activationStore.gatewayProvider);
const gatewayAssigned = computed(() => activationStore.gatewayAssigned);
const isReady = computed(() => activationStore.isReady);
const loading = computed(() => activationStore.loading);

const kycStatusLabel = computed(() => {
  if (kycRejected.value) return 'Action Required';
  if (kycUnderReview.value) return 'Under Review';
  if (kycVerified.value) return 'Identity Verified';
  return 'KYC Required';
});

const settlementStatusLabel = computed(() => {
  if (settlementState.value === 'VERIFIED') return 'Verified';
  if (settlementState.value === 'REJECTED') return 'Action Required';
  if (settlementState.value === 'PENDING_VERIFICATION') return 'Pending Verification';
  return 'Not Submitted';
});

onMounted(async () => {
  await Promise.allSettled([activationStore.loadAll(), onboardingStore.loadStatus()]);
});

function goToKycSubmission() {
  router.push({ name: 'KycSubmission', query: { section: 'identity' } });
}

function goToSettlement() {
  router.push({ name: 'KycSubmission', query: { section: 'settlement' } });
}
</script>

<template>
  <section class="rounded-card bg-card p-8 shadow-card">
    <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <h2 class="text-2xl font-semibold text-text-primary">Financial Activation</h2>
        <p class="text-sm text-text-muted mt-1">
          Complete your school's identity verification and settlement account
          to activate fee collection. CAPFLUX assigns your payment gateway
          after verification.
        </p>
      </div>

      <CmButton
        v-if="kycState === 'NONE' || kycRejected"
        variant="primary"
        :loading="loading"
        @click="goToKycSubmission"
      >
        {{ kycRejected ? 'Resubmit KYC' : 'Complete KYC' }}
      </CmButton>
      <CmButton
        v-else-if="kycVerified && !settlementVerified"
        variant="primary"
        @click="goToSettlement"
      >
        Submit Settlement Account
      </CmButton>
    </div>

    <div class="mt-6 grid gap-4 lg:grid-cols-3">
      <!-- KYC status -->
      <div class="rounded-card border border-divider bg-surface p-4">
        <p class="text-xs uppercase tracking-wider text-text-muted">KYC Verification</p>
        <CmBadge class="mt-2" :variant="kycRejected ? 'danger' : kycVerified ? 'success' : 'info'" :label="kycStatusLabel" />
        <p v-if="kycRejected && rejectionReason" class="mt-2 text-xs text-danger">
          {{ rejectionReason }}
        </p>
        <p v-else-if="kycState === 'NONE'" class="mt-2 text-xs text-text-muted">
          Identity verification is required before fee collection.
        </p>
      </div>

      <!-- Settlement status -->
      <div class="rounded-card border border-divider bg-surface p-4">
        <p class="text-xs uppercase tracking-wider text-text-muted">Settlement Account</p>
        <CmBadge
          class="mt-2"
          :variant="settlementVerified ? 'success' : settlementState === 'REJECTED' ? 'danger' : 'info'"
          :label="settlementStatusLabel"
        />
        <p v-if="!kycVerified && kycState !== 'NONE'" class="mt-2 text-xs text-text-muted">
          Available after KYC is verified.
        </p>
      </div>

      <!-- Gateway + readiness -->
      <div class="rounded-card border border-divider bg-surface p-4">
        <p class="text-xs uppercase tracking-wider text-text-muted">Payment Infrastructure</p>
        <CmBadge class="mt-2" :variant="isReady ? 'success' : 'info'" :label="isReady ? 'Active' : 'Awaiting Activation'" />
        <p v-if="gatewayAssigned" class="mt-2 text-xs text-text-secondary">
          Gateway: {{ gatewayProvider?.toUpperCase() }} · Assigned by CAPFLUX
        </p>
        <p v-else class="mt-2 text-xs text-text-muted">
          CAPFLUX assigns your gateway automatically after verification.
        </p>
      </div>
    </div>

    <div v-if="isReady" class="mt-6">
      <CmAlert variant="success" title="Payments Activated">
        Your school can now collect fees. Dedicated virtual accounts and
        payment verification are available.
      </CmAlert>
    </div>
  </section>
</template>
