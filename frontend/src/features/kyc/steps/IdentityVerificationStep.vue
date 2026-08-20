<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useFinancialActivationStore } from '@/stores/financialActivationStore';
import CmInput from '@/components/ui/CmInput.vue';
import CmSelect from '@/components/ui/CmSelect.vue';
import CmButton from '@/components/ui/CmButton.vue';
import CmBadge from '@/components/ui/CmBadge.vue';
import CmAlert from '@/components/ui/CmAlert.vue';

const emit = defineEmits(['next-step', 'prev-step']);
const activationStore = useFinancialActivationStore();

// ── Form state ──────────────────────────────────────────────────

const form = ref({
  documentType: '',
  ninNumber: '',
  documentNumber: '',
  documentFile: null as File | null,
});

const submitting = ref(false);

// Document options — must match backend validators (ALLOWED_IDENTITY_DOCUMENT_TYPES)
const documentOptions = [
  { value: 'NIN_SLIP', label: 'NIN Slip' },
  { value: 'NIN_CARD', label: 'NIN Card' },
  { value: 'INTERNATIONAL_PASSPORT', label: 'International Passport' },
  { value: "VOTERS_CARD", label: "Voter's Card" },
];

const isNinType = computed(() =>
  form.value.documentType === 'NIN_SLIP' || form.value.documentType === 'NIN_CARD',
);

const isDocumentTypeWithNumber = computed(() => {
  return !!form.value.documentType && !isNinType.value;
});

// ── Existing KYC status ─────────────────────────────────────────

const kyc = computed(() => activationStore.kycStatus?.kyc);

const verificationStates = [
  { value: 'VERIFIED', label: 'Verified', variant: 'success' },
  { value: 'UNDER_REVIEW', label: 'Under Review', variant: 'warning' },
  { value: 'PENDING_PROVIDER', label: 'Pending Provider', variant: 'warning' },
  { value: 'REJECTED', label: 'Rejected', variant: 'danger' },
  { value: 'FAILED', label: 'Failed', variant: 'danger' },
];

function getVariant(status: string | null | undefined): string {
  return verificationStates.find((s) => s.value === status)?.variant || 'info';
}

function getStatusLabel(status: string | null | undefined): string {
  return verificationStates.find((s) => s.value === status)?.label || 'Not Started';
}

const matchStateLabels: Record<string, string> = {
  MATCH: 'Match',
  MISMATCH: 'Mismatch',
  NOT_PROVIDED: 'Not Provided',
  NOT_VERIFIED: 'Not Verified',
  PENDING: 'Pending',
  FAILED: 'Failed',
};

function getFieldVariant(state: string | null | undefined): string {
  if (state === 'MATCH') return 'success';
  if (state === 'MISMATCH' || state === 'FAILED') return 'danger';
  if (state === 'PENDING' || state === 'NOT_VERIFIED') return 'warning';
  if (state === 'NOT_PROVIDED') return 'info';
  return 'info';
}

// ── Save ─────────────────────────────────────────────────────────

const error = computed(() => activationStore.error);

// Restore draft state on mount so refresh preserves selections
onMounted(() => {
  const draft = activationStore.kycSubmissionDraft;
  if (draft) {
    if (draft.identityDocumentType) {
      form.value.documentType = draft.identityDocumentType;
    }
    if (draft.nin) {
      form.value.ninNumber = draft.nin;
    }
    if (draft.documentNumber) {
      form.value.documentNumber = draft.documentNumber;
    }
  }
});

// Watch documentType and update draft immediately for persistence
watch(() => form.value.documentType, (val) => {
  if (val) {
    activationStore.updateKycDraft({ identityDocumentType: val });
  }
});

function handleFileUpload(event: Event) {
  const input = event.target as HTMLInputElement;
  if (input.files && input.files.length > 0) {
    form.value.documentFile = input.files[0];
  }
}

function maskNin(nin: string | null | undefined): string {
  if (!nin) return '—';
  if (nin.length <= 4) return '*'.repeat(nin.length);
  return '*'.repeat(nin.length - 4) + nin.slice(-4);
}

function canSubmit(): boolean {
  if (!form.value.documentType) return false;
  if (isNinType.value && !form.value.ninNumber) return false;
  if (isDocumentTypeWithNumber.value && !form.value.documentNumber) return false;
  // Document file is uploaded separately (only for identity documents uploaded to storage)
  return true;
}

async function handleSubmit() {
  if (!form.value.documentType) {
    return;
  }

  submitting.value = true;
  activationStore.clearError();

  try {
    // Store NIN + document type in the transient submission draft.
    // The actual KYC submission (with encryption) happens at the
    // Review step via submitKyc(). The NIN is never stored plaintext
    // on the backend until the final submission.
    const draft: {
      nin?: string | null;
      identityDocumentType?: string;
      documentNumber?: string | null;
    } = {
      identityDocumentType: form.value.documentType,
      nin: null,
      documentNumber: null,
    };
    if (isNinType.value) {
      draft.nin = form.value.ninNumber;
    } else if (isDocumentTypeWithNumber.value) {
      draft.documentNumber = form.value.documentNumber;
    }
    activationStore.updateKycDraft(draft);

    // Upload identity document if a file was selected
    if (form.value.documentFile) {
      try {
        await activationStore.uploadIdentityDocument(form.value.documentFile);
      } catch {
        // Upload failure is surfaced via activationStore.error, but we still
        // save the draft so the user doesn't lose their selections.
      }
    }

    emit('next-step');
  } catch {
    // Error surfaced via activationStore.error
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <section class="space-y-6">
    <!-- Already-submitted KYC: show verification status -->
    <template v-if="kyc?.identityDocumentType">
      <div>
        <h2 class="text-2xl font-semibold text-text-primary">Identity Verification</h2>
        <p class="text-sm text-text-muted mt-1">
          Your identity documents have been submitted and are being reviewed.
        </p>
      </div>

      <div class="rounded-card bg-surface p-4 space-y-3">
        <div class="flex items-center justify-between">
          <h3 class="font-medium text-text-primary">Document Type</h3>
          <span class="text-sm text-text-secondary">{{ kyc.identityDocumentType }}</span>
        </div>

        <div class="flex items-center justify-between">
          <h3 class="font-medium text-text-primary">Verification Status</h3>
          <CmBadge :variant="getVariant(kyc.status)" :label="getStatusLabel(kyc.status)" />
        </div>

        <!-- Pending verification message -->
        <p
          v-if="['UNDER_REVIEW', 'PENDING'].includes(kyc?.status)"
          class="text-sm text-text-secondary"
        >
          Verifying your identity…
        </p>

        <!-- Identity match states (only if available) -->
        <div v-if="kyc.identityMatchStates" class="grid gap-2 sm:grid-cols-2 text-sm">
          <div
            v-for="(value, field) in kyc.identityMatchStates"
            :key="field"
            class="flex justify-between py-1"
          >
            <span class="text-text-secondary">{{ field }}</span>
            <CmBadge :variant="getFieldVariant(value as string)" :label="matchStateLabels[value as string] || value" />
          </div>
        </div>

        <div v-else class="text-sm text-text-secondary">
          Verification results will appear once processing is complete.
        </div>
      </div>

      <!-- Masked NIN (last-4 only) -->
      <div v-if="kyc.ninLast4" class="rounded-card bg-surface p-4">
        <h3 class="font-medium text-text-primary mb-1">NIN (masked)</h3>
        <p class="text-sm font-mono text-text-secondary">
          {{ maskNin(kyc.ninLast4) }}
        </p>
        <p class="text-xs text-text-muted mt-1">
          Your NIN is encrypted and never returned in plaintext.
        </p>
      </div>

      <CmAlert v-if="kyc.status === 'REJECTED'" variant="danger" title="KYC Rejected">
        {{ kyc.rejectionReason || 'Your KYC submission was rejected. Please review your details.' }}
      </CmAlert>

      <div class="flex justify-between pt-4">
        <CmButton variant="ghost" @click="emit('prev-step')">Back</CmButton>
        <CmButton variant="primary" @click="emit('next-step')">Continue</CmButton>
      </div>
    </template>

    <!-- Not yet submitted: show the form -->
    <template v-else>
      <div>
        <h2 class="text-2xl font-semibold text-text-primary">Identity Verification</h2>
        <p class="text-sm text-text-muted mt-1">
          Select your identification document and provide the required details.
          The NIN is encrypted and is not exposed after submission.
        </p>
      </div>

      <CmAlert variant="info" title="Important">
        Your identity document will be verified against the personal information you
        provided. Only fields actually returned by the verification provider will be
        compared.
      </CmAlert>

      <div class="space-y-2">
        <CmSelect
          v-model="form.documentType"
          label="Identity Document"
          :options="documentOptions"
          placeholder="Select document type"
          :required="true"
          :error="error && !form.documentType ? 'Please select a document type' : undefined"
        />
      </div>

      <!-- NIN number (only for NIN slip/card) -->
      <CmInput
        v-if="isNinType"
        v-model="form.ninNumber"
        label="NIN Number"
        placeholder="12345678901"
        type="text"
        :required="true"
        :error="error && !form.ninNumber ? 'NIN number is required' : undefined"
        helper-text="11-digit Nigerian Identification Number"
      />

      <!-- Document number (for non-NIN documents) -->
      <CmInput
        v-else-if="isDocumentTypeWithNumber"
        v-model="form.documentNumber"
        label="Document Number"
        placeholder="Enter document number"
        type="text"
        :required="true"
        :error="error && !form.documentNumber ? 'Document number is required' : undefined"
        helper-text="As appears on your document"
      />

      <!-- Document upload (image or PDF) -->
      <div class="space-y-2">
        <label class="block text-sm font-medium text-text-secondary">
          Upload Document <span class="text-danger">*</span>
        </label>
        <div
          class="border-2 border-dashed border-border rounded-card bg-surface p-6 text-center cursor-pointer hover:bg-surface/80 transition-colors"
        >
          <input
            type="file"
            accept=".jpg,.jpeg,.png,.pdf"
            @change="handleFileUpload"
            class="hidden"
            id="doc-upload"
          />
          <label for="doc-upload" class="cursor-pointer">
            <svg
              class="w-8 h-8 mx-auto text-text-muted mb-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M7 16a4 4 0 118 0M16 16l-4-4-4 4m8 0v2a2 2 0 01-2 2h-4a2 2 0 01-2-2v-2"
              />
            </svg>
            <p class="text-sm text-text-primary">
              {{ form.documentFile ? form.documentFile.name : 'Click to upload (JPG, PNG, PDF)' }}
            </p>
            <p class="text-xs text-text-muted mt-1">
              Maximum file size: 5MB
            </p>
          </label>
        </div>
        <p class="text-xs text-text-muted">
          The uploaded document is encrypted and stored securely. It is never exposed
          in plaintext to the frontend.
        </p>
      </div>

      <CmAlert v-if="error" variant="danger">{{ error }}</CmAlert>

      <div class="flex justify-between pt-4 gap-4">
        <CmButton variant="ghost" @click="emit('prev-step')">Back</CmButton>
        <CmButton
          variant="primary"
          :loading="submitting"
          :disabled="!canSubmit()"
          @click="handleSubmit"
        >
          Save &amp; Continue
        </CmButton>
      </div>
    </template>
  </section>
</template>
