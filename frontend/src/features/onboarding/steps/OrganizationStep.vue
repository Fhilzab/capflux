<script setup lang="ts">
import { ref, computed } from 'vue';
import { useOnboardingStore } from '@/stores/onboardingStore';
import CmInput from '@/components/ui/CmInput.vue';
import CmSelect from '@/components/ui/CmSelect.vue';
import CmButton from '@/components/ui/CmButton.vue';
import CmAlert from '@/components/ui/CmAlert.vue';

const emit = defineEmits(['next-step', 'prev-step']);
const onboardingStore = useOnboardingStore();

const businessType = ref('PRIVATE');
const name = ref('');
const contactEmail = ref('');
const submitting = ref(false);
const alertError = ref('');

const businessTypeOptions = [
  { value: 'PRIVATE', label: 'Private Business' },
  { value: 'PUBLIC', label: 'Public Business' },
  { value: 'IS_GRADUATE', label: 'Graduate' },
];

const isFormValid = computed(() => {
  return !!name.value.trim();
});

async function handleSubmit() {
  if (!isFormValid.value) {
    alertError.value = 'Organization name is required';
    return;
  }
  alertError.value = '';
  submitting.value = true;
  try {
    await onboardingStore.createOrganization(name.value);
    emit('next-step');
  } catch {
    alertError.value = 'Failed to create organization. Please try again.';
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <section class="space-y-6">
    <div>
      <h2 class="text-2xl font-semibold text-text-primary">Create Your Organization</h2>
      <p class="text-sm text-text-muted mt-1">
        This is the parent organization for your school(s). The slug is
        generated automatically from the name.
      </p>
    </div>

    <CmAlert v-if="alertError" variant="danger">{{ alertError }}</CmAlert>

    <CmSelect
      v-model="businessType"
      label="Business Type"
      :options="businessTypeOptions"
      required
    />

    <CmInput
      v-model="name"
      label="Organization Name"
      placeholder="e.g. Greenfield Schools Ltd."
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
      <CmButton variant="primary" :loading="submitting" :disabled="!isFormValid" @click="handleSubmit">
        Save &amp; Continue
      </CmButton>
    </div>
  </section>
</template>
