<script setup lang="ts">
import { ref } from 'vue';
import { useOnboardingStore } from '@/stores/onboardingStore';
import CmInput from '@/components/ui/CmInput.vue';
import CmButton from '@/components/ui/CmButton.vue';
import CmAlert from '@/components/ui/CmAlert.vue';

const onboardingStore = useOnboardingStore();

const name = ref('');
const submitting = ref(false);
const alertError = ref('');

async function handleSubmit() {
  if (!name.value.trim()) {
    alertError.value = 'Organization name is required';
    return;
  }
  alertError.value = '';
  submitting.value = true;
  try {
    await onboardingStore.createOrganization(name.value);
    onboardingStore.goToNextStep();
  } catch {
    alertError.value = 'Failed to create organization. Please try again.';
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h2 class="text-2xl font-semibold text-text-primary">Create Your Organization</h2>
      <p class="text-sm text-text-muted mt-1">
        This is the parent organization for your school(s). The slug is
        generated automatically from the name.
      </p>
    </div>

    <CmAlert v-if="alertError" variant="error">{{ alertError }}</CmAlert>

    <CmInput
      v-model="name"
      label="Organization Name"
      placeholder="e.g. Greenfield Schools Ltd."
      required
      :error="alertError || undefined"
    />

    <p class="text-xs text-text-muted">
      Slug will be auto-generated (e.g. greenfield-schools-ltd-abcd12)
    </p>

    <div class="flex justify-end pt-4">
      <CmButton variant="primary" :loading="submitting" @click="handleSubmit">
        Create Organization
      </CmButton>
    </div>
  </div>
</template>
