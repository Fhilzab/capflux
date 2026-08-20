<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useFinancialActivationStore } from '@/stores/financialActivationStore';
import { useRouter } from 'vue-router';
import CmButton from '@/components/ui/CmButton.vue';
import CmBadge from '@/components/ui/CmBadge.vue';
import CmAlert from '@/components/ui/CmAlert.vue';

const emit = defineEmits<{
  (e: 'back-to-dashboard'): void;
  (e: 'back-to-review'): void;
}>();

const router = useRouter();
const activationStore = useFinancialActivationStore();

onMounted(() => {
  activationStore.loadKycStatus();
  activationStore.loadSettlementStatus();
});

// ── Normalized model reads (store handles snake_case → camelCase) ──
const kyc = computed(() => activationStore.kycStatus?.kyc);
const schoolStatus = computed(() => activationStore.kycStatus?.schoolStatus);
const paymentStatus = computed(() => activationStore.kycStatus?.paymentStatus);
const settlement = computed(() => activationStore.settlement);

function goToSection(section: string) {
  router.push({ name: 'KycSubmission', query: { section } });
}

function maskValue(value: string | null | undefined, visible = 4): string {
  if (!value) return '—';
  if (value.length <= visible) return '*'.repeat(value.length);
  return '*'.repeat(value.length - visible) + value.slice(-visible);
}

// ── Verification timeline ──────────────────────────────────────────

const timelineSteps = computed(() => {
  const steps: { label: string; status: string; variant: string }[] = [];

  // 1. Personal Information
  steps.push({
    label: 'Personal Information',
    status: kyc.value?.officialEmail ? 'Complete' : 'Not started',
    variant: kyc.value?.officialEmail ? 'success' : 'info',
  });

  // 2. Identity Verification
  const matchOverall = kyc.value?.identityMatchStates?.overall;
  const ninStatus = kyc.value?.ninVerificationStatus;
  let identityStatus = 'Not started';
  let identityVariant = 'info';
  if (ninStatus === 'VERIFIED' && matchOverall === 'MATCH') {
    identityStatus = 'Verified';
    identityVariant = 'success';
  } else if (ninStatus === 'FAILED' || matchOverall === 'FAILED') {
    identityStatus = 'Failed';
    identityVariant = 'danger';
  } else if (ninStatus === 'PENDING' || matchOverall === 'PENDING' || matchOverall === 'NOT_VERIFIED') {
    identityStatus = 'Pending';
    identityVariant = 'warning';
  } else if (matchOverall === 'MISMATCH') {
    identityStatus = 'Mismatch';
    identityVariant = 'danger';
  }
  steps.push({ label: 'Identity Verification', status: identityStatus, variant: identityVariant });

  // 3. Organisation
  steps.push({
    label: 'Organisation',
    status: kyc.value?.officialEmail ? 'Complete' : 'Not started',
    variant: kyc.value?.officialEmail ? 'success' : 'info',
  });

  // 4. Documents
  const hasDocs = !!kyc.value?.cacRegistrationNumber || !!kyc.value?.cacDocumentStatus;
  steps.push({
    label: 'Documents',
    status: hasDocs ? 'Submitted' : 'Pending',
    variant: hasDocs ? 'success' : 'info',
  });

  // 5. School Registration
  const hasSchool = schoolStatus.value === 'ACTIVE' || !!kyc.value;
  steps.push({
    label: 'School Registration',
    status: schoolStatus.value === 'ACTIVE' ? 'Complete' : hasSchool ? 'In progress' : 'Not started',
    variant: schoolStatus.value === 'ACTIVE' ? 'success' : hasSchool ? 'warning' : 'info',
  });

  // 6. Principal
  steps.push({
    label: 'Principal',
    status: kyc.value?.officialEmail ? 'Complete' : 'Not started',
    variant: kyc.value?.officialEmail ? 'success' : 'info',
  });

  // 7. Settlement Account
  const settleOverall = settlement.value?.ownershipMatchStatus;
  let settleStatus = 'Not submitted';
  let settleVariant = 'info';
  if (settleOverall === 'OWNERSHIP_MATCH') {
    settleStatus = 'Verified';
    settleVariant = 'success';
  } else if (settleOverall === 'PENDING' || settleOverall === 'NAME_NOT_VERIFIED') {
    settleStatus = 'Pending';
    settleVariant = 'warning';
  } else if (settleOverall === 'NAME_MISMATCH') {
    settleStatus = 'Mismatch';
    settleVariant = 'danger';
  } else if (settlement.value?.status === 'FAILED') {
    settleStatus = 'Failed';
    settleVariant = 'danger';
  }
  steps.push({ label: 'Settlement Account', status: settleStatus, variant: settleVariant });

  // 8. Final Review
  const isComplete = kyc.value?.status === 'VERIFIED' && (settlement.value?.ownershipMatchStatus === 'OWNERSHIP_MATCH' || !settlement.value);
  steps.push({
    label: 'Final Review',
    status: isComplete ? 'Submitted' : 'Pending',
    variant: isComplete ? 'success' : 'info',
  });

  return steps;
});

const overallVariant = computed(() => {
  if (kyc.value?.status === 'VERIFIED' && settlement.value?.ownershipMatchStatus === 'OWNERSHIP_MATCH') return 'success';
  if (kyc.value?.status === 'REJECTED' || kyc.value?.status === 'FAILED') return 'danger';
  if (kyc.value?.status === 'UNDER_REVIEW' || kyc.value?.status === 'PENDING_PROVIDER') return 'warning';
  return 'info';
});
</script>

<template>
  <section class="rounded-card bg-card p-6 md:p-8 shadow-card space-y-6">
    <div class="flex items-center justify-between">
      <h2 class="text-xl font-semibold text-text-primary">KYC &amp; Financial Readiness</h2>
      <CmButton variant="ghost" size="sm" @click="emit('back-to-dashboard')">
        Back to Dashboard
      </CmButton>
    </div>

    <p class="text-sm text-text-muted">
      Track your verification status. All sensitive values are masked. Click
      <strong>Edit</strong> on any section to return to the wizard.
    </p>

    <!-- Rejection alert -->
    <CmAlert v-if="kyc?.status === 'REJECTED'" variant="danger" title="KYC Rejected">
      Your KYC submission was rejected. {{ kyc?.rejectionReason || 'Please contact support or resubmit your documents.' }}
    </CmAlert>

    <!-- Verification timeline -->
    <div class="space-y-3">
      <div
        v-for="(step, i) in timelineSteps"
        :key="i"
        class="flex items-center justify-between py-3 border-b border-border"
      >
        <div class="flex items-center gap-3">
          <CmBadge :variant="step.variant" :label="String(i + 1)" />
          <span class="text-sm font-medium text-text-primary">{{ step.label }}</span>
        </div>
        <span class="text-sm text-text-secondary">{{ step.status }}</span>
      </div>
    </div>

    <!-- Masked sensitive identifiers -->
    <div v-if="kyc?.ninLast4 || kyc?.bvnLast4" class="grid gap-3 sm:grid-cols-2">
      <div v-if="kyc?.ninLast4" class="rounded-card bg-surface p-4">
        <h3 class="font-medium text-text-primary mb-1">NIN (masked)</h3>
        <p class="text-sm font-mono text-text-secondary">
          {{ maskValue(kyc.ninLast4, 4) }}
        </p>
      </div>
      <div v-if="kyc?.bvnLast4" class="rounded-card bg-surface p-4">
        <h3 class="font-medium text-text-primary mb-1">BVN (masked)</h3>
        <p class="text-sm font-mono text-text-secondary">
          {{ maskValue(kyc.bvnLast4, 4) }}
        </p>
      </div>
    </div>

    <!-- Identity match details -->
    <div v-if="kyc?.identityMatchStates" class="rounded-card bg-surface p-4 space-y-2">
      <h3 class="font-medium text-text-primary">Identity Match Details</h3>
      <div class="grid gap-2 sm:grid-cols-2 text-sm">
        <div v-for="(state, field) in kyc.identityMatchStates" :key="field" class="flex justify-between py-1">
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
    </div>

    <!-- Settlement details -->
    <div v-if="settlement" class="rounded-card bg-surface p-4 space-y-2">
      <h3 class="font-medium text-text-primary">Settlement Account</h3>
      <div class="grid gap-2 sm:grid-cols-2 text-sm">
        <div class="flex justify-between py-1">
          <span class="text-text-secondary">Account (masked)</span>
          <span class="font-mono text-text-primary">
            {{ maskValue(settlement.accountNumberLast4, 4) }}
          </span>
        </div>
        <div class="flex justify-between py-1">
          <span class="text-text-secondary">BVN (masked)</span>
          <span class="font-mono text-text-primary">
            {{ maskValue(settlement.bvnLast4, 4) }}
          </span>
        </div>
        <div class="flex justify-between py-1">
          <span class="text-text-secondary">Ownership</span>
          <CmBadge
            :variant="
              settlement.ownershipMatchStatus === 'OWNERSHIP_MATCH' ? 'success' :
              settlement.ownershipMatchStatus === 'NAME_MISMATCH' ? 'danger' :
              'warning'
            "
            :label="settlement.ownershipMatchStatus || 'PENDING'"
          />
        </div>
      </div>
    </div>

    <!-- Quick actions -->
    <div class="flex flex-wrap gap-3 pt-2">
      <CmButton variant="secondary" size="sm" @click="goToSection('identity')">
        Update Identity
      </CmButton>
      <CmButton variant="secondary" size="sm" @click="goToSection('settlement')">
        Update Settlement
      </CmButton>
      <CmButton variant="secondary" size="sm" @click="goToSection('review')">
        Back to Review
      </CmButton>
    </div>
  </section>
</template>
