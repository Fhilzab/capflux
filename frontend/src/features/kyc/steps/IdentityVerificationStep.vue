<script setup lang="ts">
import { ref, computed } from 'vue';
import { useFinancialActivationStore } from '@/stores/financialActivationStore';
import { useOnboardingStore } from '@/stores/onboardingStore';
import CmInput from '@/components/ui/CmInput.vue';
import CmSelect from '@/components/ui/CmSelect.vue';
import CmButton from '@/components/ui/CmButton.vue';
import CmAlert from '@/components/ui/CmAlert.vue';
import CmBadge from '@/components/ui/CmBadge.vue';
import type { OnboardingStatus } from '@/shared/school/types';

const activationStore = useFinancialActivationStore();
const onboardingStore = useOnboardingStore();

const form = ref({
  documentType: '',
  ninNumber: '',
});

const documentFile = ref<File | null>(null);
const uploading = ref(false);
const alertError = ref('');
const alertSuccess = ref('');

// Read-only personal info from backend
const principalName = computed(() => onboardingStore.status?.school?.name || 'your school');

const identityDocumentTypeOptions = [
  { value: 'NIN_SLIP', label: 'NIN Slip' },
  { value: 'NIN_CARD', label: 'NIN Card' },
  { value: 'INTERNATIONAL_PASSPORT', label: 'International Passport' },
  { value: 'VOTERS_CARD', label: "Voter's Card" },
];

const ninError = computed(() => {
  if (!form.value.ninNumber) return '';
  if (form.value.ninNumber.length !== 11) return 'NIN must be exactly 11 digits';
  return '';
});

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  documentFile.value = input.files?.[0] || null;
}

const isFormValid = computed(() => {
  return (
    !!form.value.documentType &&
    !!form.value.ninNumber &&
    form.value.ninNumber.length === 11 &&
    !!documentFile.value
  );
});

const matchStates = computed(() => {
  // Capability-aware identity match states from KYC status
  return activationStore.kycStatus?.kyc?.identity_match_states || {};
});

const verificationOverall = computed(() => {
  const states = matchStates.value;
  if (states.overall === 'MATCH') return { label: 'Match', variant: 'success' };
  if (states.overall === 'MISMATCH') return { label: 'Mismatch', variant: 'danger' };
  if (states.overall === 'NOT_PROVIDED') return { label: 'Not Provided', variant: 'info' };
  if (states.overall === 'NOT_VERIFIED') return { label: 'Not Verified', variant: 'warning' };
  if (states.overall === 'PENDING') return { label: 'Pending', variant: 'info' };
  if (states.overall === 'FAILED') return { label: 'Failed', variant: 'danger' };
  return { label: 'Not Started', variant: 'info' };
});

function maskValue(value: string | null | undefined, visibleDigits = 4): string {
  if (!value) return '—';
  if (value.length <= visibleDigits) return '*'.repeat(value.length);
  return '*'.repeat(value.length - visibleDigits) + value.slice(-visibleDigits);
}

async function saveAndContinue() {
  if (!isFormValid.value) return;

  alertError.value = '';
  alertSuccess.value = '';
  uploading.value = true;

  try {
    // Upload identity document via the CAC document endpoint (reused abstraction)
    if (documentFile.value) {
      await activationStore.uploadCacDocument(documentFile.value);
      alertSuccess.value = 'Identity document uploaded successfully.';
    }

    // Submit KYC with identity document type — the backend calls
    // IdentityVerificationService and capability-aware matching.
    await activationStore.submitKyc({
      principalName: principalName.value,
      principalPhone: onboardingStore.status?.school?.payment_status || '',
      bvn: '',
      nin: form.value.ninNumber,
    });

    setTimeout(() => {
      alertSuccess.value = '';
      // Emit next-step to advance the wizard
      // The match states will be loaded on next section render
    }, 1500);
  } catch (e) {
    alertError.value = (e as Error)?.message || 'Failed to submit identity verification';
  } finally {
    uploading.value = false;
  }
}

function canRetry(): boolean {
  return verificationOverall.value.label === 'Not Started' || verificationOverall.value.label === 'Pending';
}
</script>

<template>
  <section class="rounded-card bg-card p-8 shadow-card space-y-6">
    <h2 class="text-xl font-semibold text-text-primary">Identity Document</h2>
    <p class="text-sm text-text-muted">
      Select your identity document type and enter your NIN. Your NIN is encrypted
      at the application layer and verified through the provider abstraction.
      Only masked values are displayed after submission.
    </p>

    <CmAlert v-if="alertError" variant="danger">{{ alertError }}</CmAlert>
    <CmAlert v-if="alertSuccess" variant="success">{{ alertSuccess }}</CmAlert>

    <!-- Current verification state (capability-aware) -->
    <div v-if="verificationOverall.variant !== 'info' || verificationOverall.label !== 'Not Started'" class="rounded-card border border-divider bg-surface p-4">
      <p class="text-xs uppercase tracking-wider text-text-muted mb-2">Identity Verification</p>
      <CmBadge :variant="verificationOverall.variant as 'success' | 'danger' | 'warning' | 'info' | 'brand'" :label="verificationOverall.label" />
      <p class="mt-2 text-xs text-text-secondary">
        Provider evidence is authoritative. CAPFLUX compares only fields the provider returned.
      </p>
    </div>

    <div class="grid gap-4 sm:grid-cols-2">
      <CmSelect
        v-model="form.documentType"
        label="Identity Document Type"
        :options="identityDocumentTypeOptions"
        placeholder="Select document type"
        required
      />
      <CmInput
        v-model="form.ninNumber"
        label="NIN Number"
        type="text"
        :error="ninError"
        helper-text="11-digit National Identification Number"
        maxlength="11"
      />
    </div>

    <div>
      <label class="block text-sm font-medium text-text-primary mb-1">
        Upload Identity Document <span class="text-danger">*</span>
      </label>
      <input
        type="file"
        accept="application/pdf,image/jpeg,image/png"
        class="block w-full text-sm text-text-secondary file:mr-4 file:rounded-button file:border-0 file:bg-surface file:px-4 file:py-2.5 file:text-sm file:font-medium file:text-text-primary hover:file:bg-surface/80"
        @change="onFileChange"
      />
      <p class="mt-1 text-xs text-text-muted">PDF, JPG, or PNG up to 10MB.</p>
    </div>

    <!-- Per-field match states (capability-aware) -->
    <div v-if="matchStates.name || matchStates.dateOfBirth || matchStates.phone || matchStates.identityNumber" class="grid gap-2 sm:grid-cols-2">
      <div v-for="(value, field) in matchStates" :key="field" class="flex justify-between py-2 border-b border-divider">
        <span class="text-sm text-text-secondary">{{ field }}</span>
        <CmBadge
          :variant="
            value === 'MATCH' ? 'success' :
            value === 'MISMATCH' ? 'danger' :
            value === 'NOT_PROVIDED' ? 'info' :
            value === 'NOT_VERIFIED' ? 'warning' :
            value === 'PENDING' ? 'info' : 'danger'
          "
          :label="value"
        />
      </div>
    </div>

    <!-- Masked sensitive data display -->
    <div v-if="activationStore.kycStatus?.kyc?.nin_last4" class="rounded-card border border-divider bg-surface p-4">
      <p class="text-xs uppercase tracking-wider text-text-muted">NIN (masked)</p>
      <p class="text-sm font-mono text-text-secondary">{{ maskValue(activationStore.kycStatus.kyc.nin_last4, 4) }}</p>
    </div>

    <div v-if="activationStore.kycStatus?.kyc?.bvn_last4" class="rounded-card border border-divider bg-surface p-4">
      <p class="text-xs uppercase tracking-wider text-text-muted">BVN (masked)</p>
      <p class="text-sm font-mono text-text-secondary">{{ maskValue(activationStore.kycStatus.kyc.bvn_last4, 4) }}</p>
    </div>

    <CmAlert v-if="!canRetry() && verificationOverall.label === 'Mismatch'" variant="warning" title="Identity Mismatch">
      Your identity information did not match the provider record. Please contact support or
      <a href="/kyc/status" class="text-brand underline">review your KYC status</a>.
    </CmAlert>

    <div class="flex justify-between pt-4 gap-4">
      <CmButton variant="ghost" @click="$emit('prev-step')">Back</CmButton>
      <CmButton variant="primary" :loading="uploading" :disabled="!isFormValid" @click="saveAndContinue">
        Save & Continue
      </CmButton>
    </div>
  </section>
</template>
