<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { useAuthStore } from '@/stores/authStore';
import CmInput from '@/components/ui/CmInput.vue';
import CmButton from '@/components/ui/CmButton.vue';
import CmAlert from '@/components/ui/CmAlert.vue';

const emit = defineEmits(['next-step', 'prev-step']);
const onboardingStore = useOnboardingStore();
const authStore = useAuthStore();

const form = ref({
  fullName: '',
  phone: '',
  firstName: '',
  lastName: '',
  middleName: '',
  dateOfBirth: '',
  country: 'Nigeria',
  state: '',
  lga: '',
  residentialAddress: '',
});
const submitting = ref(false);
const alertError = ref('');

const userFullName = computed(() => {
  const u = authStore.user;
  return u?.user_metadata?.full_name || u?.user_metadata?.name || u?.user_metadata?.full_name || '';
});

const userPhone = computed(() => {
  const u = authStore.user;
  return u?.user_metadata?.phone || u?.phone || authStore.profile?.phone || '';
});

onMounted(() => {
  form.value.fullName = userFullName.value;
  form.value.phone = userPhone.value;
});

const isFormValid = computed(() => {
  return !!form.value.fullName.trim() && !!form.value.phone.trim();
});

async function handleSubmit() {
  if (!isFormValid.value) {
    alertError.value = 'Please fill in all required fields.';
    return;
  }
  alertError.value = '';
  submitting.value = true;
  try {
    await onboardingStore.saveProfile({
      fullName: form.value.fullName,
      phone: form.value.phone,
      firstName: form.value.firstName,
      lastName: form.value.lastName,
      middleName: form.value.middleName,
      dateOfBirth: form.value.dateOfBirth,
      country: form.value.country,
      state: form.value.state,
      lga: form.value.lga,
      residentialAddress: form.value.residentialAddress,
    });
    emit('next-step');
  } catch {
    alertError.value = 'Failed to save profile. Please try again.';
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <section class="space-y-6">
    <div>
      <h2 class="text-2xl font-semibold text-text-primary">Personal Information</h2>
      <p class="text-sm text-text-muted mt-1">
        Pre-filled from your CAPFLUX account. Add your phone and remaining details.
      </p>
    </div>

    <CmAlert v-if="alertError" variant="danger">{{ alertError }}</CmAlert>

    <!-- Read-only email -->
    <div class="rounded-card bg-surface p-4">
      <label class="block text-sm font-medium text-text-secondary">Email Address</label>
      <p class="mt-1.5 text-sm text-text-primary break-all">
        {{ authStore.user?.email || 'Not available' }}
      </p>
      <p class="mt-1 text-xs text-text-muted">
        This email is used for your CAPFLUX account authentication and cannot be changed here.
      </p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <CmInput v-model="form.fullName" label="Full Name" :required="true" :value="userFullName" helper-text="From your account" />
      <CmInput v-model="form.phone" label="Phone Number" type="tel" :required="true" helper-text="Used for school communications" />
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <CmInput v-model="form.firstName" label="First Name" />
      <CmInput v-model="form.middleName" label="Middle Name" helper-text="If applicable" />
      <CmInput v-model="form.lastName" label="Last Name" />
      <CmInput v-model="form.dateOfBirth" label="Date of Birth" type="date" />
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <CmInput v-model="form.country" label="Country of Origin" />
      <CmInput v-model="form.state" label="State of Origin" />
      <CmInput v-model="form.lga" label="Local Government Area" />
    </div>

    <CmInput v-model="form.residentialAddress" label="Residential Address" />

    <div class="flex justify-between pt-4 gap-4">
      <CmButton variant="ghost" @click="emit('prev-step')">Back</CmButton>
      <CmButton variant="primary" :loading="submitting" :disabled="!isFormValid" @click="handleSubmit">
        Save & Continue
      </CmButton>
    </div>
  </section>
</template>
