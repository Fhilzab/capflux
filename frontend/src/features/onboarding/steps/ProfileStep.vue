<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { useAuthStore } from '@/stores/authStore';
import CmInput from '@/components/ui/CmInput.vue';
import CmButton from '@/components/ui/CmButton.vue';
import CmAlert from '@/components/ui/CmAlert.vue';

const onboardingStore = useOnboardingStore();
const authStore = useAuthStore();

const fullName = ref('');
const phone = ref('');
const submitting = ref(false);
const alertError = ref('');

const userFullName = computed(() => {
  return authStore.user?.user_metadata?.full_name ||
         authStore.user?.user_metadata?.name ||
         authStore.profile?.full_name || '';
});

const userPhone = computed(() => {
  return authStore.user?.user_metadata?.phone ||
         authStore.user?.phone ||
         authStore.profile?.phone || '';
});

onMounted(() => {
  fullName.value = userFullName.value;
  phone.value = userPhone.value;
});

async function handleSubmit() {
  if (!fullName.value.trim()) {
    alertError.value = 'Full name is required';
    return;
  }
  alertError.value = '';
  submitting.value = true;
  try {
    await onboardingStore.saveProfile(fullName.value, phone.value || undefined);
    onboardingStore.goToNextStep();
  } catch {
    alertError.value = 'Failed to save profile. Please try again.';
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h2 class="text-2xl font-semibold text-text-primary">Complete Your Profile</h2>
      <p class="text-sm text-text-muted mt-1">
        Your name and email are pre-filled from your WorkOS account.
        Please confirm and add your phone number.
      </p>
    </div>

    <CmAlert v-if="alertError" variant="error">{{ alertError }}</CmAlert>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <CmInput v-model="fullName" label="Full Name" :required="true" :helper-text="'From your account'" />
      <CmInput v-model="phone" label="Phone Number" type="tel" :helper-text="'Used for school communications'" />
    </div>

    <div class="flex justify-end pt-4">
      <CmButton variant="primary" :loading="submitting" @click="handleSubmit">
        Save & Continue
      </CmButton>
    </div>
  </div>
</template>
