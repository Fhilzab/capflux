<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useFinancialActivationStore } from '@/stores/financialActivationStore';
import { useRouter } from 'vue-router';
import CmButton from '@/components/ui/CmButton.vue';
import CmBadge from '@/components/ui/CmBadge.vue';
import CmAlert from '@/components/ui/CmAlert.vue';

const router = useRouter();
const activationStore = useFinancialActivationStore();

onMounted(() => {
  activationStore.loadKycStatus();
  activationStore.loadSettlementStatus();
});

const kyc = computed(() => activationStore.kycStatus?.kyc);
const schoolStatus = computed(() => activationStore.kycStatus?.schoolStatus);
const paymentStatus = computed(() => activationStore.kycStatus?.paymentStatus);
const settlement = computed(() => activationStore.settlement);

const kycStatusVariant = computed(() => {
  const s = kyc.value?.status;
  if (s === 'VERIFIED') return 'success';
  if (s === 'REJECTED' || s === 'FAILED') return 'danger';
  if (s === 'PENDING' || s === 'UNDER_REVIEW') return 'warning';
  return 'info';
});

const identityOverall = computed(() => {
  const states = kyc.value?.identity_match_states || {};
  return states.overall || kyc.value?.verification_status || 'NOT_STARTED';
});

const identityVariant = computed(() => {
  const s = identityOverall.value;
  if (s === 'MATCH') return 'success';
  if (s === 'MISMATCH') return 'danger';
  if (s === 'PENDING') return 'warning';
  if (s === 'FAILED') return 'danger';
  return 'info';
});

const settlementStatusVariant = computed(() => {
  const s = settlement.value?.status;
  if (s === 'VERIFIED') return 'success';
  if (s === 'REJECTED') return 'danger';
  if (s === 'PENDING_VERIFICATION' || s === 'PENDING') return 'warning';
  return 'info';
});

const ownershipVariant = computed(() => {
  const s = settlement.value?.ownership_match_status;
  if (s === 'OWNERSHIP_MATCH') return 'success';
  if (s === 'NAME_MISMATCH') return 'danger';
  return 'warning';
});

const financialReadiness = computed(() => {
  const steps: { label: string; complete: boolean }[] = [];

  steps.push({ label: 'School activated', complete: schoolStatus.value === 'ACTIVE' });
  steps.push({ label: 'KYC verified', complete: kyc.value?.status === 'VERIFIED' });
  steps.push({ label: 'Settlement account verified', complete: settlement.value?.status === 'VERIFIED' });
  steps.push({ label: 'Ownership confirmed', complete: settlement.value?.ownership_match_status === 'OWNERSHIP_MATCH' });

  return steps;
});

function goToSection(section: string) {
  router.push({ name: 'KycSubmission', query: { section } });
}

function maskValue(value: string | null | undefined, visible = 4): string {
  if (!value) return '—';
  if (value.length <= visible) return '*'.repeat(value.length);
  return '*'.repeat(value.length - visible) + value.slice(-visible);
}
</script>

<template>
  <section class="rounded-card bg-card p-8 shadow-card space-y-6">
    <h2 class="text-xl font-semibold text-text-primary">KYC &amp; Financial Readiness</h2>
    <p class="text-sm text-text-muted">
      Track your verification status and financial readiness. All sensitive
      values are masked. Click an Edit button to update any section.
    </p>

    <CmAlert v-if="kyc.value?.status === 'REJECTED'" variant="danger" title="KYC Rejected">
      Your KYC submission was rejected. Contact support or resubmit your documents.
    </CmAlert>

    <!-- School status -->
    <div class="rounded-card border border-divider bg-surface p-4">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="font-medium text-text-primary">School Status</h3>
          <p class="text-sm text-text-secondary">
            {{ schoolStatus.value || 'Not yet activated' }}
          </p>
        </div>
        <CmBadge :variant="schoolStatus.value === 'ACTIVE' ? 'success' : 'info'" :label="schoolStatus.value || 'PENDING' />
      </div>
    </div>

    <!-- KYC verification -->
    <div class="rounded-card border border-divider bg-surface p-4">
      <div class="flex items-center justify-between mb-2">
        <h3 class="font-medium text-text-primary">Identity Verification</h3>
        <div class="flex gap-2">
          <CmBadge :variant="kycStatusVariant" :label="kyc.value?.status || 'NOT_STARTED'" />
          <CmButton variant="ghost" size="sm" @click="goToSection('identity')">Edit</CmButton>
        </div>
      </div>
      <div v-if="kyc.value?.identity_match_states" class="grid gap-2 sm:grid-cols-2 text-sm">
        <div v-for="(state, field) in kyc.value.identity_match_states" :key="field" class="flex justify-between py-1 border-b border-divider">
          <span class="text-text-secondary">{{ field }}</span>
          <CmBadge
            :variant="
              state === 'MATCH' ? 'success' :
              state === 'MISMATCH' ? 'danger' :
              state === 'NOT_PROVIDED' ? 'info' :
              state === 'NOT_VERIFIED' ? 'warning' :
              'info'
            "
            :label="state"
          />
        </div>
      </div>
      <div v-else class="text-sm text-text-secondary">No verification data yet.</div>
    </div>

    <!-- NIN masked -->
    <div v-if="kyc.value?.nin_last4" class="rounded-card border border-divider bg-surface p-4">
      <h3 class="font-medium text-text-primary mb-2">NIN (masked)</h3>
      <p class="text-sm font-mono text-text-secondary">{{ '******' + kyc.value.nin_last4 }}</p>
    </div>

    <!-- BVN masked -->
    <div v-if="kyc.value?.bvn_last4" class="rounded-card border border-divider bg-surface p-4">
      <h3 class="font-medium text-text-primary mb-2">BVN (masked)</h3>
      <p class="text-sm font-mono text-text-secondary">{{ '******' + kyc.value.bvn_last4 }}</p>
    </div>

    <!-- Settlement -->
    <div class="rounded-card border border-divider bg-surface p-4">
      <div class="flex items-center justify-between mb-2">
        <h3 class="font-medium text-text-primary">Settlement Account</h3>
        <div class="flex gap-2">
          <CmBadge :variant="settlementStatusVariant" :label="settlement.value?.status || 'NOT_SUBMITTED'" />
          <CmButton variant="ghost" size="sm" @click="goToSection('settlement')">Edit</CmButton>
        </div>
      </div>
      <div v-if="settlement.value" class="grid gap-2 sm:grid-cols-2 text-sm">
        <div class="flex justify-between py-1 border-b border-divider">
          <span class="text-text-secondary">Account (masked)</span>
          <span class="font-mono text-text-primary">{{ maskValue(settlement.value?.account_number_last4, 4) || '******' + settlement.value?.account_number_last4 }}</span>
        </div>
        <div class="flex justify-between py-1 border-b border-divider">
          <span class="text-text-secondary">BVN (masked)</span>
          <span class="font-mono text-text-primary">{{ maskValue(settlement.value?.bvn_last4, 4) || '******' + settlement.value?.bvn_last4 }}</span>
        </div>
        <div class="flex justify-between py-1 border-b border-divider">
          <span class="text-text-secondary">Ownership</span>
          <CmBadge :variant="ownershipVariant" :label="settlement.value?.ownership_match_status || 'PENDING'" />
        </div>
      </div>
      <div v-else class="text-sm text-text-secondary">No settlement account submitted.</div>
    </div>

    <!-- Financial readiness -->
    <div class="rounded-card border border-divider bg-surface p-4">
      <h3 class="font-medium text-text-primary mb-3">Financial Readiness</h3>
      <div class="space-y-2">
        <div v-for="(step, i) in financialReadiness" :key="i" class="flex items-center gap-3">
          <CmBadge :variant="step.complete ? 'success' : 'info'" :label="step.complete ? '✓' : '—'" />
          <span class="text-sm" :class="step.complete ? 'text-text-primary' : 'text-text-secondary'">{{ step.label }}</span>
        </div>
      </div>
    </div>

    <!-- Payment status -->
    <div v-if="paymentStatus" class="rounded-card border border-divider bg-surface p-4">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="font-medium text-text-primary">Payment Status</h3>
          <p class="text-sm text-text-secondary">{{ paymentStatus }}</p>
        </div>
        <CmBadge :variant="paymentStatus === 'READY' ? 'success' : paymentStatus === 'PENDING_KYC' ? 'warning' : 'info'" :label="paymentStatus" />
      </div>
    </div>

    <!-- Action buttons -->
    <div class="flex gap-3 pt-2">
      <CmButton variant="secondary" @click="goToSection('identity')">
        Update Identity
      </CmButton>
      <CmButton variant="secondary" @click="goToSection('settlement')">
        Update Settlement
      </CmButton>
      <CmButton variant="ghost" @click="router.push('/dashboard')">
        Back to Dashboard
      </CmButton>
    </div>
  </section>
</template>
