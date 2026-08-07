<script setup lang="ts">
import { ref, computed } from 'vue';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { useAuthStore } from '@/stores/authStore';
import CmInput from '@/components/ui/CmInput.vue';
import CmButton from '@/components/ui/CmButton.vue';
import CmAlert from '@/components/ui/CmAlert.vue';

const onboardingStore = useOnboardingStore();
const authStore = useAuthStore();

const form = ref({
  phone: '',
  designation: '',
  alternateContact: '',
});
const submitting = ref(false);
const alertError = ref('');

// Auto-fill phone from auth profile if available
const userPhone = computed(() => {
  const profile = authStore.profile || authStore.user?.user_metadata;
  return profile?.phone || '';
});

async function handleSubmit() {
  if (!form.value.phone.trim()) {
    alertError.value = 'Phone number is required';
    return;
  }
  alertError.value = '';
  submitting.value = true;
  try {
    await onboardingStore.saveOwnerInfo({
      phone: form.value.phone,
      designation: form.value.designation,
      alternateContact: form.value.alternateContact,
    });
    onboardingStore.goToNextStep();
  } catch {
    alertError.value = 'Failed to save owner information. Please try again.';
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h2 class="text-2xl font-semibold text-text-primary">Owner Information</h2>
      <p class="text-sm text-text-muted mt-1">
        Collect operational contact details. Name and email are already
        captured during authentication and are not duplicated here.
      </p>
    </div>

    <CmAlert v-if="alertError" variant="error">{{ alertError }}</CmAlert>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <CmInput
        v-model="form.phone"
        label="Phone"
        type="tel"
        placeholder="+234XXXXXXXXX"
        :required="true"
        :helper-text="'Auto-filled from your profile when available'"
      />
      <CmInput v-model="form.designation" label="Designation" placeholder="e.g. School Owner, Headmaster" />
      <CmInput v-model="form.alternateContact" label="Alternate Contact" type="tel" placeholder="Alternate phone number" />
    </div>

    <div class="flex justify-end pt-4">
      <CmButton variant="primary" :loading="submitting" @click="handleSubmit">
        Save Owner Information
      </CmButton>
    </div>
  </div>
</template>
