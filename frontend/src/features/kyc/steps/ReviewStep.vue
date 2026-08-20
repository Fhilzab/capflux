<script setup lang="ts">
import { computed } from 'vue';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { useFinancialActivationStore } from '@/stores/financialActivationStore';
import CmButton from '@/components/ui/CmButton.vue';
import CmBadge from '@/components/ui/CmBadge.vue';

const emit = defineEmits<{
  (e: 'edit-section', section: string): void;
  (e: 'prev-step'): void;
  (e: 'submit-all'): void;
}>();

const onboardingStore = useOnboardingStore();
const activationStore = useFinancialActivationStore();

function maskValue(value: string | null | unknown, visible = 4): string {
  if (!value) return '—';
  const str = String(value);
  if (str.length <= visible) return '*'.repeat(str.length);
  return '*'.repeat(str.length - visible) + str.slice(-visible);
}

const personalInfo = computed(() => {
  const p = onboardingStore.personalInfo;
  if (!p) {
    return {
      fullName: '—',
      phone: '—',
      email: '—',
    };
  }
  const fullName = [p.firstName, p.middleName, p.lastName].filter(Boolean).join(' ') || '—';
  return {
    fullName,
    phone: p.phone || '—',
    email: p.email || '—',
  };
});

const organization = computed(() => {
  const org = onboardingStore.status?.organization;
  return {
    name: org?.name || '—',
    slug: org?.slug || '—',
    businessType: org?.business_type || org?.type || '—',
  };
});

const school = computed(() => {
  const s = onboardingStore.status?.school;
  return {
    name: s?.name || '—',
    type: s?.school_type || s?.type || '—',
    gender: s?.gender || '—',
  };
});

const identity = computed(() => {
  const kyc = activationStore.kycStatus?.kyc;
  return {
    documentType: kyc?.identityDocumentType || '—',
    ninLast4: kyc?.ninLast4 || '—',
    bvnLast4: kyc?.bvnLast4 || '—',
    ninVerificationStatus: kyc?.ninVerificationStatus || 'NOT_VERIFIED',
    bvnVerificationStatus: kyc?.bvnVerificationStatus || 'NOT_VERIFIED',
    matchStates: kyc?.identityMatchStates,
  };
});

const settlement = computed(() => {
  const s = activationStore.settlement;
  return {
    accountLast4: s?.accountNumberLast4 || '—',
    bvnLast4: s?.bvnLast4 || '—',
    ownershipStatus: s?.ownershipMatchStatus || 'NOT_VERIFIED',
    status: s?.status || 'Not submitted',
    bankName: s?.bankName || '—',
  };
});

const sections = [
  { id: 'personal', label: 'Personal Information', icon: '👤' },
  { id: 'identity', label: 'Identity Verification', icon: '🆔' },
  { id: 'organisation', label: 'Organisation Information', icon: '🏢' },
  { id: 'documents', label: 'Organisation Documents', icon: '📄' },
  { id: 'shareholders', label: 'Shareholders', icon: '👥' },
  { id: 'school', label: 'School Information', icon: '🏫' },
  { id: 'principal', label: 'Principal Information', icon: '👨‍🏫' },
  { id: 'settlement', label: 'Settlement Account', icon: '🏦' },
];

function getVerificationBadgeVariant(status: string): string {
  if (status === 'VERIFIED' || status === 'MATCH' || status === 'OWNERSHIP_MATCH') return 'success';
  if (status === 'FAILED' || status === 'MISMATCH' || status === 'NAME_MISMATCH' || status === 'REJECTED') return 'danger';
  return 'warning';
}

function canSubmit(): boolean {
  return activationStore.kycReadyForSubmission;
}
</script>

<template>
  <section class="space-y-6">
    <h2 class="text-2xl font-semibold text-text-primary">Review &amp; Confirmation</h2>
    <p class="text-sm text-text-muted">
      Review all information before final submission. Sensitive data is shown
      masked. Click Edit on any section to make changes.
    </p>

    <!-- Quick-edit list -->
    <div class="space-y-2">
      <div
        v-for="section in sections"
        :key="section.id"
        class="flex items-center justify-between rounded-card border border-border bg-surface p-3"
      >
        <div class="flex items-center gap-3">
          <span class="text-xl">{{ section.icon }}</span>
          <h3 class="font-medium text-text-primary">{{ section.label }}</h3>
        </div>
        <CmButton variant="ghost" size="sm" @click="emit('edit-section', section.id)">
          Edit
        </CmButton>
      </div>
    </div>

    <!-- Detailed masked review -->
    <div class="grid gap-6 sm:grid-cols-2">
      <!-- Personal Information -->
      <div class="rounded-card border border-border bg-surface p-4">
        <h3 class="text-sm font-medium text-text-primary mb-2">Personal Information</h3>
        <div class="space-y-1 text-sm">
          <div class="flex justify-between">
            <span class="text-text-secondary">Name</span>
            <span class="text-text-primary">{{ personalInfo.fullName }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-text-secondary">Phone</span>
            <span class="text-text-primary">{{ personalInfo.phone }}</span>
          </div>
        </div>
      </div>

      <!-- Identity Verification -->
      <div class="rounded-card border border-border bg-surface p-4">
        <h3 class="text-sm font-medium text-text-primary mb-2">Identity Verification</h3>
        <div class="space-y-1 text-sm">
          <div class="flex justify-between">
            <span class="text-text-secondary">Document Type</span>
            <span class="text-text-primary">{{ identity.documentType }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-text-secondary">NIN (last 4)</span>
            <span class="text-text-primary font-mono">{{ maskValue(identity.ninLast4, 4) }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-text-secondary">BVN (last 4)</span>
            <span class="text-text-primary font-mono">{{ maskValue(identity.bvnLast4, 4) }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-text-secondary">Verification</span>
            <CmBadge
              :variant="getVerificationBadgeVariant(identity.ninVerificationStatus)"
              :label="identity.ninVerificationStatus"
            />
          </div>
        </div>
      </div>

      <!-- Organisation -->
      <div class="rounded-card border border-border bg-surface p-4">
        <h3 class="text-sm font-medium text-text-primary mb-2">Organisation</h3>
        <div class="space-y-1 text-sm">
          <div class="flex justify-between">
            <span class="text-text-secondary">Name</span>
            <span class="text-text-primary">{{ organization.name }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-text-secondary">Slug</span>
            <span class="text-text-secondary">{{ organization.slug }}</span>
          </div>
        </div>
      </div>

      <!-- Settlement -->
      <div class="rounded-card border border-border bg-surface p-4">
        <h3 class="text-sm font-medium text-text-primary mb-2">Settlement Account</h3>
        <div class="space-y-1 text-sm">
          <div class="flex justify-between">
            <span class="text-text-secondary">Account (last 4)</span>
            <span class="text-text-primary font-mono">{{ maskValue(settlement.accountLast4, 4) }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-text-secondary">BVN (last 4)</span>
            <span class="text-text-primary font-mono">{{ maskValue(settlement.bvnLast4, 4) }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-text-secondary">Ownership</span>
            <CmBadge
              :variant="getVerificationBadgeVariant(settlement.ownershipStatus)"
              :label="settlement.ownershipStatus"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- School summary -->
    <div class="rounded-card border border-border bg-surface p-4">
      <h3 class="text-sm font-medium text-text-primary mb-2">School</h3>
      <div class="grid gap-2 sm:grid-cols-3 text-sm">
        <div class="flex justify-between">
          <span class="text-text-secondary">Name</span>
          <span class="text-text-primary">{{ school.name }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-text-secondary">Type</span>
          <span class="text-text-primary">{{ school.type }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-text-secondary">Gender</span>
          <span class="text-text-primary">{{ school.gender }}</span>
        </div>
      </div>
    </div>

    <!-- Shareholders note -->
    <div class="rounded-card border border-border bg-surface p-4">
      <h3 class="text-sm font-medium text-text-primary mb-2">Shareholders / Beneficial Owners</h3>
      <p class="text-sm text-text-secondary">
        Beneficial owner identity documents are encrypted and only last-four
        digits are exposed to clients.
      </p>
    </div>

    <div class="flex justify-between pt-4 gap-4">
      <CmButton variant="ghost" @click="emit('prev-step')">Back</CmButton>
      <CmButton variant="primary" :disabled="!canSubmit()" @click="emit('submit-all')">
        Confirm &amp; Submit
      </CmButton>
    </div>
  </section>
</template>
