<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useFinancialActivationStore } from '@/stores/financialActivationStore';
import { useOnboardingStore } from '@/stores/onboardingStore';
import CmInput from '@/components/ui/CmInput.vue';
import CmSelect from '@/components/ui/CmSelect.vue';
import CmButton from '@/components/ui/CmButton.vue';
import CmAlert from '@/components/ui/CmAlert.vue';
import CmBadge from '@/components/ui/CmBadge.vue';
import CmTooltip from '@/components/CmTooltip.vue';
import {
  BUSINESS_TYPE_OPTIONS,
  getBusinessTypeConfig,
  getDocumentsForBusinessType,
  getIncompatibleDocuments,
  normalizeLegacyBusinessType,
  DOCUMENT_DEFINITIONS,
  type BusinessType,
} from '@/shared/businessTypes';

const emit = defineEmits(['next-step', 'prev-step', 'switch-business-type']);
const activationStore = useFinancialActivationStore();
const onboardingStore = useOnboardingStore();

const cacFile = ref<File | null>(null);
const cacDocument = computed(() => activationStore.cacDocument);
const uploading = ref(false);
const alertError = ref('');
const alertSuccess = ref('');
const discardWarning = ref('');

const form = ref({
  // Prefill synchronously from already-loaded KYC status so the field is
  // correct at first render (no post-mount flash / stale props).
  cacRegistrationNumber:
    (activationStore.kycStatus?.kyc?.cacRegistrationNumber as string | undefined) || '',
});

// Business type: local copy for the CmSelect, initialized from the store
const selectedBusinessType = ref<BusinessType | null>(
  normalizeLegacyBusinessType(onboardingStore.businessType),
);

const businessTypeConfig = computed(() =>
  selectedBusinessType.value
    ? getBusinessTypeConfig(selectedBusinessType.value)
    : null,
);

// Registration number field label changes per business type
const registrationNumberLabel = computed(() => {
  return businessTypeConfig.value?.registrationNumberLabel ?? 'CAC Registration Number';
});

const documentChecklist = computed(() => {
  const docs = getDocumentsForBusinessType(selectedBusinessType.value);
  return {
    required: docs.required
      .map((code) => DOCUMENT_DEFINITIONS[code])
      .filter(Boolean),
    optional: docs.optional
      .map((code) => DOCUMENT_DEFINITIONS[code])
      .filter(Boolean),
  };
});

// The CAC certificate upload covers CAC_REGISTRATION_EVIDENCE for all entity types
const hasDocument = computed(() => !!activationStore.cacDocument);
const documentStatus = computed(() => activationStore.cacDocument?.status || null);

const statusVariant = computed(() => {
  if (!documentStatus.value) return 'info';
  if (documentStatus.value === 'VERIFIED') return 'success';
  if (documentStatus.value === 'REJECTED') return 'danger';
  return 'warning';
});

// Warn when switching business types and incompatible documents exist
watch(
  selectedBusinessType,
  (newType, oldType) => {
    if (newType !== oldType) {
      const incompatible = getIncompatibleDocuments(oldType, newType);
      if (incompatible.length > 0) {
        discardWarning.value = `Switching from "${getBusinessTypeConfig(oldType ?? '')?.label ?? 'previous type'}" to "${getBusinessTypeConfig(newType ?? '')?.label ?? 'new type'}" means the following incompatible documents may no longer apply: ${incompatible.map((d) => d.label).join(', ')}.`;
        emit('switch-business-type', newType);
      } else {
        discardWarning.value = '';
        emit('switch-business-type', newType);
      }
    }
  },
);

const canProceed = computed(() => {
  return !!form.value.cacRegistrationNumber && !!selectedBusinessType.value;
});
// Exposed under the same name; defineExpose unwraps refs, so tests and parent
// components read `vm.canProceed` as a plain boolean.
const canProceedComputed = canProceed;

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  cacFile.value = input.files?.[0] || null;
}

async function uploadCac() {
  if (!cacFile.value) return;
  uploading.value = true;
  alertError.value = '';
  try {
    await activationStore.uploadCacDocument(cacFile.value);
    alertSuccess.value = 'CAC certificate uploaded successfully.';
    cacFile.value = null;
  } catch (e) {
    alertError.value = (e as Error)?.message || 'Failed to upload CAC certificate';
  } finally {
    uploading.value = false;
  }
}

function removeFile() {
  cacFile.value = null;
}

onMounted(() => {
  activationStore.loadKycDocuments();
});

defineExpose({ selectedBusinessType, form, canProceed: canProceedComputed, saveAndContinue });

async function saveAndContinue() {
  if (!canProceed.value) return;
  await activationStore.updateKycDraft({
    cacRegistrationNumber: form.value.cacRegistrationNumber,
    businessType: selectedBusinessType.value,
  });
  emit('switch-business-type', selectedBusinessType.value);
  emit('next-step');
}
</script>

<template>
  <section class="rounded-card bg-card p-8 shadow-card space-y-6">
    <h2 class="text-xl font-semibold text-text-primary">Organisation Documents</h2>
    <p class="text-sm text-text-muted">
      Provide your registration details and upload required documents.
      Documents are stored in private storage and never exposed publicly.
    </p>

    <CmAlert v-if="alertError" variant="danger">{{ alertError }}</CmAlert>
    <CmAlert v-if="alertSuccess" variant="success">{{ alertSuccess }}</CmAlert>
    <CmAlert v-if="discardWarning" variant="warning">{{ discardWarning }}</CmAlert>

    <!-- Business type selector -->
    <CmSelect
      v-model="selectedBusinessType"
      :options="BUSINESS_TYPE_OPTIONS"
      label="Business Type"
      placeholder="Select a business type"
      helper-text="Your selection determines the business documents CAPFLUX will request during verification."
    />

    <!-- Contextual registration number (RC for companies, BN for business names, etc.) -->
    <CmInput
      v-model="form.cacRegistrationNumber"
      :label="registrationNumberLabel"
      :placeholder="registrationNumberPlaceholder"
      helper-text="As it appears on your CAC certificate"
    />

    <!-- CAC Registration Evidence (required for all entity types) -->
    <div>
      <div class="flex items-center gap-2 mb-2">
        <label class="block text-sm font-medium text-text-primary">
          CAC Certificate
        </label>
        <CmBadge variant="info" label="Required" />
      </div>
      <input
        v-if="!hasDocument"
        type="file"
        accept="application/pdf,image/jpeg,image/png"
        class="block w-full text-sm text-text-secondary file:mr-4 file:rounded-button file:border-0 file:bg-surface file:px-4 file:py-2.5 file:text-sm file:font-medium file:text-text-primary hover:file:bg-surface/80"
        @change="onFileChange"
      />
      <div v-else class="flex items-center justify-between rounded-card border border-border bg-surface p-4">
        <div>
          <p class="text-sm font-medium text-text-primary">Certificate on file</p>
          <p class="text-xs text-text-secondary">
            Uploaded: {{ cacDocument?.uploaded_at || '—' }}
          </p>
        </div>
        <CmBadge :variant="statusVariant" :label="documentStatus || 'Pending'" />
      </div>

      <div v-if="cacFile" class="mt-2 flex items-center justify-between text-sm">
        <span class="text-text-secondary">{{ cacFile.name }} ({{ (cacFile.size / 1024).toFixed(1) }} KB)</span>
        <button @click="removeFile" class="text-danger hover:text-danger/80 transition-colors">Remove</button>
      </div>

      <p class="mt-1 text-xs text-text-muted">PDF, JPG, or PNG up to 10MB.</p>
    </div>

    <CmButton v-if="cacFile" variant="secondary" size="sm" :loading="uploading" @click="uploadCac">
      {{ hasDocument ? 'Replace Certificate' : 'Upload Certificate' }}
    </CmButton>

    <!-- Dynamic document checklist based on business type -->
    <div v-if="businessTypeConfig" class="border-t border-border pt-6 space-y-4">
      <h3 class="text-sm font-medium text-text-primary">
        Documents for: {{ businessTypeConfig.label }}
      </h3>

      <!-- Required documents -->
      <div v-if="documentChecklist.required.length" class="space-y-3">
        <div
          v-for="doc in documentChecklist.required"
          :key="doc.id"
          class="flex items-start justify-between rounded-card border border-border p-4"
        >
          <div class="space-y-1">
            <div class="flex items-center gap-2">
              <span class="text-sm font-medium text-text-primary">{{ doc.label }}</span>
              <CmBadge variant="danger" label="Required" />
              <CmTooltip :content="doc.description">
                <svg class="h-4 w-4 text-text-muted cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" stroke-width="2" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
              </CmTooltip>
            </div>
            <p class="text-xs text-text-secondary">{{ doc.description }}</p>
          </div>
          <span v-if="doc.id === 'CAC_REGISTRATION_EVIDENCE' && hasDocument" class="text-xs text-success">
            Uploaded
          </span>
          <span v-else class="text-xs text-text-muted">
            See above
          </span>
        </div>
      </div>

      <!-- Optional documents -->
      <div v-if="documentChecklist.optional.length" class="space-y-3">
        <div
          v-for="doc in documentChecklist.optional"
          :key="doc.id"
          class="flex items-start justify-between rounded-card border border-border p-4 opacity-75"
        >
          <div class="space-y-1">
            <div class="flex items-center gap-2">
              <span class="text-sm font-medium text-text-primary">{{ doc.label }}</span>
              <CmBadge variant="info" label="Optional" />
              <CmTooltip :content="doc.description">
                <svg class="h-4 w-4 text-text-muted cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" stroke-width="2" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
              </CmTooltip>
            </div>
            <p class="text-xs text-text-secondary">{{ doc.description }}</p>
          </div>
          <span class="text-xs text-text-muted">Conditional</span>
        </div>
      </div>

      <p class="text-xs text-text-muted pt-2">
        Your selection determines the business documents CAPFLUX will request during verification.
      </p>
    </div>

    <div class="flex justify-between pt-4 gap-4">
      <CmButton variant="ghost" @click="emit('prev-step')">Back</CmButton>
      <CmButton variant="primary" :disabled="!canProceed" @click="saveAndContinue">
        Save &amp; Continue
      </CmButton>
    </div>
  </section>
</template>
