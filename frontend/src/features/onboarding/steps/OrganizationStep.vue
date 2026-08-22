<script setup lang="ts">
import { ref, computed } from 'vue';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { useFinancialActivationStore } from '@/stores/financialActivationStore';
import CmInput from '@/components/ui/CmInput.vue';
import CmSelect from '@/components/ui/CmSelect.vue';
import CmButton from '@/components/ui/CmButton.vue';
import CmAlert from '@/components/ui/CmAlert.vue';
import { CheckCircle, AlertCircle } from '@lucide/vue';
import {
  BUSINESS_TYPE_OPTIONS,
  getBusinessTypeConfig,
  normalizeLegacyBusinessType,
  type BusinessType,
} from '@/shared/businessTypes';

const emit = defineEmits(['next-step', 'prev-step']);
const onboardingStore = useOnboardingStore();
const activationStore = useFinancialActivationStore();

// Determine which flow we're in:
// - Onboarding flow (school not yet created): createOrganization
// - KYC flow (school already exists): saveBusinessType
const isKycFlow = computed(() => onboardingStore.hasSchool);

// Pre-fill from the store synchronously (loaded from the API or draft) so the
// form renders in its final state — no empty-select flash after mount.
const businessType = ref<BusinessType>(
  (normalizeLegacyBusinessType(onboardingStore.businessType) ?? '') as BusinessType,
);
const name = ref(onboardingStore.organizationName || '');
const contactEmail = ref('');
const submitting = ref(false);
const alertError = ref('');

const selectedBusinessTypeConfig = computed(() => {
  if (!businessType.value) return null;
  const normalized = normalizeLegacyBusinessType(businessType.value);
  return normalized ? getBusinessTypeConfig(normalized) : null;
});

const isFormValid = computed(() => {
  const hasValidBusinessType = normalizeLegacyBusinessType(businessType.value) !== null;
  return !!name.value.trim() && hasValidBusinessType;
});

async function handleSubmit() {
  if (!isFormValid.value) {
    alertError.value = 'Organization name and a valid business type are required';
    return;
  }
  alertError.value = '';
  submitting.value = true;
  try {
    if (isKycFlow.value) {
       // KYC flow: school already exists — update business_type on the school
      await onboardingStore.saveBusinessType(businessType.value);
    } else {
      // Onboarding flow: create the organization with the business type
      await onboardingStore.createOrganization(name.value, businessType.value || undefined);
    }
    // Sync to the KYC submission draft so completion calculations and
    // KYC submission payloads always carry the business type.
    activationStore.updateKycDraft({ businessType: businessType.value || null });
    emit('next-step');
  } catch (err) {
    const e = err as { status?: number; message?: string; userMessage?: string };
    if (e.status === 409) {
      // Organization already exists (e.g. returning to KYC after onboarding).
      // Save the business type directly.
      try {
        await onboardingStore.saveBusinessType(businessType.value!);
        emit('next-step');
      } catch {
        alertError.value = 'Failed to save business type. Please try again.';
      }
    } else {
      alertError.value =
        e.userMessage || e.message || 'Failed to save organization. Please try again.';
    }
  } finally {
    submitting.value = false;
  }
}

defineExpose({ handleSubmit, isFormValid, businessType });

</script>

<template>
  <section class="space-y-6">
    <div>
      <h2 class="text-2xl font-semibold text-text-primary">
        {{ isKycFlow ? 'Business Information' : 'Create Your Organization' }}
      </h2>
      <p class="text-sm text-text-muted mt-1">
        {{ isKycFlow
          ? 'Review and update your business type below.'
          : 'This is the parent organization for your school(s). The slug is generated automatically from the name.' }}
      </p>
    </div>

    <CmAlert v-if="alertError" variant="danger">{{ alertError }}</CmAlert>

    <CmSelect
      v-model="businessType"
      label="Business Type"
      :options="BUSINESS_TYPE_OPTIONS"
      placeholder="Select a business type"
      required
      helper-text="Select the legal structure under which your organisation is registered."
    />

    <p
      v-if="selectedBusinessTypeConfig"
      class="text-xs text-text-muted"
    >
      {{ selectedBusinessTypeConfig.description }}
    </p>

    <CmInput
      v-model="name"
      label="Organization Name"
      placeholder="e.g. Greenfield Schools Ltd."
      :disabled="isKycFlow"
      required
      :error="alertError || undefined"
    />

    <CmInput
      v-model="contactEmail"
      label="Organisation Contact Email"
      type="email"
      placeholder="contact@greenfieldschools.com"
    />

    <p class="text-xs text-text-muted">
      Slug will be auto-generated (e.g. greenfield-schools-ltd-abcd12)
    </p>

    <div class="flex justify-between pt-4 gap-4">
      <CmButton variant="ghost" @click="emit('prev-step')">Back</CmButton>
      <CmButton
        variant="primary"
        :loading="submitting"
        :disabled="!isFormValid"
        @click="handleSubmit"
      >
        Save &amp; Continue
      </CmButton>
    </div>
  </section>
</template>
