<script setup lang="ts">
import { computed } from 'vue';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { useFinancialActivationStore } from '@/stores/financialActivationStore';
import CmButton from '@/components/ui/CmButton.vue';
import CmBadge from '@/components/ui/CmBadge.vue';

const onboardingStore = useOnboardingStore();
const activationStore = useFinancialActivationStore();

function maskValue(value: string | null | undefined, visible = 4): string {
  if (!value) return '—';
  if (value.length <= visible) return '*'.repeat(value.length);
  return '*'.repeat(value.length - visible) + value.slice(-visible);
}

const personalInfo = computed(() => {
  const s = onboardingStore.status;
  return {
    fullName: s?.organization?.name || '—',
    phone: s?.school?.owner_user_id || s?.school?.slug || '—',
  };
});

const organization = computed(() => ({
  name: onboardingStore.status?.organization?.name || '—',
  slug: onboardingStore.status?.organization?.slug || '—',
}));

const school = computed(() => {
  const s = onboardingStore.status?.school;
  return {
    name: s?.name || '—',
    type: s?.status || '—',
    paymentStatus: s?.paymentStatus || '—',
  };
});

const identity = computed(() => ({
  documentType: activationStore.kycStatus?.kyc?.identity_document_type || '—',
  verificationStatus: activationStore.kycStatus?.kyc?.verification_status || 'Pending',
  ninLast4: maskValue(activationStore.kycStatus?.kyc?.nin_last4, 4),
  bvnLast4: maskValue(activationStore.kycStatus?.kyc?.bvn_last4, 4),
}));

const settlement = computed(() => ({
  accountLast4: maskValue(activationStore.settlement?.accountNumberLast4, 4),
  bvnLast4: maskValue(activationStore.settlement?.bvnLast4, 4),
  ownershipStatus: activationStore.settlement?.ownershipMatchStatus || 'Pending',
  status: activationStore.settlement?.status || 'Not submitted',
}));

const shareholderCount = computed(() => 0); // Would come from backend in full impl

const sections = [
  { id: 'personal', label: 'Personal Information', icon: '👤' },
  { id: 'identity', label: 'Identity Verification', icon: '🆔' },
  { id: 'organization', label: 'Organisation Information', icon: '🏢' },
  { id: 'documents', label: 'Organisation Documents', icon: '📄' },
  { id: 'shareholders', label: 'Shareholders', icon: '👥' },
  { id: 'school', label: 'School Information', icon: '🏫' },
  { id: 'principal', label: 'Principal Information', icon: '👨‍🏫' },
  { id: 'settlement', label: 'Settlement Account', icon: '🏦' },
];

// Emit events for navigation to sections
defineEmits<{
  (e: 'edit-section', section: string): void;
  (e: 'prev-step'): void;
  (e: 'submit-all'): void;
}>();
</script>

<template>
  <section class="rounded-card bg-card p-8 shadow-card space-y-6">
    <h2 class="text-xl font-semibold text-text-primary">Review &amp; Confirmation</h2>
    <p class="text-sm text-text-muted">
      Review all information before final submission. Sensitive data is shown
      masked. Click Edit on any section to make changes.
    </p>

    <div class="space-y-3">
      <div v-for="section in sections" :key="section.id" class="rounded-card border border-divider bg-surface p-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <span class="text-xl">{{ section.icon }}</span>
            <h3 class="font-medium text-text-primary">{{ section.label }}</h3>
          </div>
          <CmButton variant="ghost" size="sm" @click="$emit('edit-section', section.id)">
            Edit
          </CmButton>
        </div>
      </div>
    </div>

    <!-- Detailed masked review -->
    <div class="grid gap-6 sm:grid-cols-2">
      <!-- Personal Information -->
      <div class="rounded-card border border-divider bg-surface p-4">
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
      <div class="rounded-card border border-divider bg-surface p-4">
        <h3 class="text-sm font-medium text-text-primary mb-2">Identity Verification</h3>
        <div class="space-y-1 text-sm">
          <div class="flex justify-between">
            <span class="text-text-secondary">Document Type</span>
            <span class="text-text-primary">{{ identity.documentType }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-text-secondary">NIN (masked)</span>
            <span class="text-text-primary font-mono">{{ identity.ninLast4 }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-text-secondary">BVN (masked)</span>
            <span class="text-text-primary font-mono">{{ identity.bvnLast4 }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-text-secondary">Status</span>
            <CmBadge :variant="identity.verificationStatus === 'VERIFIED' ? 'success' : 'info'" :label="identity.verificationStatus" />
          </div>
        </div>
      </div>

      <!-- Organisation -->
      <div class="rounded-card border border-divider bg-surface p-4">
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
      <div class="rounded-card border border-divider bg-surface p-4">
        <h3 class="text-sm font-medium text-text-primary mb-2">Settlement Account</h3>
        <div class="space-y-1 text-sm">
          <div class="flex justify-between">
            <span class="text-text-secondary">Account (masked)</span>
            <span class="text-text-primary font-mono">{{ settlement.accountLast4 }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-text-secondary">BVN (masked)</span>
            <span class="text-text-primary font-mono">{{ settlement.bvnLast4 }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-text-secondary">Ownership</span>
            <CmBadge
              :variant="
                settlement.ownershipStatus === 'OWNERSHIP_MATCH' ? 'success' :
                settlement.ownershipStatus === 'NAME_MISMATCH' ? 'danger' : 'warning'
              "
              :label="settlement.ownershipStatus"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- School summary -->
    <div class="rounded-card border border-divider bg-surface p-4">
      <h3 class="text-sm font-medium text-text-primary mb-2">School</h3>
      <div class="grid gap-2 sm:grid-cols-3 text-sm">
        <div class="flex justify-between">
          <span class="text-text-secondary">Name</span>
          <span class="text-text-primary">{{ school.name }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-text-secondary">Status</span>
          <span class="text-text-primary">{{ school.type }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-text-secondary">Payment</span>
          <span class="text-text-primary">{{ school.paymentStatus }}</span>
        </div>
      </div>
    </div>

    <!-- Shareholders note -->
    <div class="rounded-card border border-divider bg-surface p-4">
      <h3 class="text-sm font-medium text-text-primary mb-2">Shareholders / Beneficial Owners</h3>
      <p class="text-sm text-text-secondary">
        {{ shareholderCount }} shareholder(s) recorded. Identity documents are
        encrypted and only last-four digits are exposed to clients.
      </p>
    </div>

    <div class="flex justify-between pt-4 gap-4">
      <CmButton variant="ghost" @click="$emit('prev-step')">Back</CmButton>
      <CmButton variant="primary" @click="$emit('submit-all')">
        Confirm &amp; Submit
      </CmButton>
    </div>
  </section>
</template>
