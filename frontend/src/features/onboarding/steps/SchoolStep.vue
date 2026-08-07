<script setup lang="ts">
import { ref } from 'vue';
import { useOnboardingStore } from '@/stores/onboardingStore';
import CmInput from '@/components/ui/CmInput.vue';
import CmSelect from '@/components/ui/CmSelect.vue';
import CmButton from '@/components/ui/CmButton.vue';
import CmAlert from '@/components/ui/CmAlert.vue';

const onboardingStore = useOnboardingStore();

const form = ref({
  name: '',
  address: '',
  state: '',
  lga: '',
  country: 'Nigeria',
  schoolType: 'MIXED',
});
const submitting = ref(false);
const alertError = ref('');

const countryOptions = [
  { value: 'Nigeria', label: 'Nigeria' },
  { value: 'Ghana', label: 'Ghana' },
  { value: 'Kenya', label: 'Kenya' },
];

const schoolTypeOptions = [
  { value: 'MIXED', label: 'Mixed' },
  { value: 'BOYS', label: 'Boys Only' },
  { value: 'GIRLS', label: 'Girls Only' },
];

async function handleSubmit() {
  if (!form.value.name.trim()) {
    alertError.value = 'School name is required';
    return;
  }
  alertError.value = '';
  submitting.value = true;
  try {
    await onboardingStore.createSchool({
      name: form.value.name,
      address: form.value.address,
      state: form.value.state,
      lga: form.value.lga,
      country: form.value.country,
      schoolType: form.value.schoolType,
      academicCalendar: {
        startDate: new Date().getFullYear().toString(),
        terms: ['FIRST', 'SECOND', 'THIRD'],
      },
    });
    onboardingStore.goToNextStep();
  } catch {
    alertError.value = 'Failed to create school. Please try again.';
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h2 class="text-2xl font-semibold text-text-primary">Register Your School</h2>
      <p class="text-sm text-text-muted mt-1">
        Enter your school details. The slug is generated automatically.
      </p>
    </div>

    <CmAlert v-if="alertError" variant="error">{{ alertError }}</CmAlert>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <CmInput v-model="form.name" label="School Name" placeholder="e.g. Greenfield Secondary School" required />
      <CmInput v-model="form.address" label="Address" placeholder="School address" />
      <CmInput v-model="form.state" label="State" placeholder="e.g. Lagos" />
      <CmInput v-model="form.lga" label="LGA" placeholder="Local Government Area" />
      <CmSelect v-model="form.country" label="Country" :options="countryOptions" />
      <CmSelect v-model="form.schoolType" label="School Type" :options="schoolTypeOptions" />
    </div>

    <div class="pt-4">
      <CmButton variant="primary" :loading="submitting" @click="handleSubmit">
        Create School
      </CmButton>
    </div>
  </div>
</template>
