<script setup lang="ts">
import { ref, computed } from 'vue';
import { useOnboardingStore } from '@/stores/onboardingStore';
import CmInput from '@/components/ui/CmInput.vue';
import CmSelect from '@/components/ui/CmSelect.vue';
import CmCheckbox from '@/components/ui/CmCheckbox.vue';
import CmButton from '@/components/ui/CmButton.vue';
import CmAlert from '@/components/ui/CmAlert.vue';

const emit = defineEmits(['next-step', 'prev-step']);
const onboardingStore = useOnboardingStore();

const form = ref({
  name: '',
  address: '',
  state: '',
  lga: '',
  country: 'Nigeria',
  schoolType: 'PUBLIC',
  schoolCategory: '',
  gender: 'MIXED',
  levels: [] as string[],
});
const submitting = ref(false);
const alertError = ref('');

const countryOptions = [
  { value: 'Nigeria', label: 'Nigeria' },
  { value: 'Ghana', label: 'Ghana' },
  { value: 'Kenya', label: 'Kenya' },
];

const schoolTypeOptions = [
  { value: 'PUBLIC', label: 'Public' },
  { value: 'PRIVATE', label: 'Private' },
  { value: 'IS_GRADUATE', label: 'Graduate' },
];

const genderOptions = [
  { value: 'MIXED', label: 'Mixed' },
  { value: 'BOYS', label: 'Boys' },
  { value: 'GIRLS', label: 'Girls' },
];

const levelOptions = [
  { value: 'NURSERY', label: 'Nursery' },
  { value: 'PRIMARY', label: 'Primary' },
  { value: 'SECONDARY', label: 'Secondary' },
];

const isFormValid = computed(() => {
  return !!form.value.name.trim() && form.value.levels.length > 0;
});

function toggleLevel(level: string) {
  if (form.value.levels.includes(level)) {
    form.value.levels = form.value.levels.filter((l) => l !== level);
  } else {
    form.value.levels.push(level);
  }
}

async function handleSubmit() {
  if (!isFormValid.value) {
    alertError.value = 'School name and at least one level are required.';
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
      schoolCategory: form.value.schoolCategory,
      gender: form.value.gender,
      schoolLevels: form.value.levels,
      academicCalendar: {
        startDate: new Date().getFullYear().toString(),
        terms: ['FIRST', 'SECOND', 'THIRD'],
      },
    });
    emit('next-step');
  } catch {
    alertError.value = 'Failed to create school. Please try again.';
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <section class="space-y-6">
    <div>
      <h2 class="text-2xl font-semibold text-text-primary">Register Your School</h2>
      <p class="text-sm text-text-muted mt-1">
        Enter your school details. The slug is generated automatically.
      </p>
    </div>

    <CmAlert v-if="alertError" variant="danger">{{ alertError }}</CmAlert>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <CmInput v-model="form.name" label="School Name" placeholder="e.g. Greenfield Secondary School" required />
      <CmInput v-model="form.address" label="Address" placeholder="School address" />
      <CmInput v-model="form.state" label="State" placeholder="e.g. Lagos" />
      <CmInput v-model="form.lga" label="LGA" placeholder="Local Government Area" />
      <CmSelect v-model="form.country" label="Country" :options="countryOptions" />
      <CmSelect v-model="form.schoolType" label="School Type" :options="schoolTypeOptions" />
      <CmInput v-model="form.schoolCategory" label="School Category" placeholder="e.g. Primary, Secondary, Mixed" />
      <CmSelect v-model="form.gender" label="Gender" :options="genderOptions" />
    </div>

    <div class="space-y-2">
      <label class="block text-sm font-medium text-text-primary">School Levels</label>
      <p class="text-xs text-text-muted mb-2">Select all that apply</p>
      <div class="flex flex-wrap gap-3">
        <div v-for="level in levelOptions" :key="level.value" class="flex items-center">
          <CmCheckbox
            :model-value="form.levels.includes(level.value)"
            :label="level.label"
            @update:model-value="toggleLevel(level.value)"
          />
        </div>
      </div>
    </div>

    <div class="flex justify-between pt-4 gap-4">
      <CmButton variant="ghost" @click="emit('prev-step')">Back</CmButton>
      <CmButton variant="primary" :loading="submitting" :disabled="!isFormValid" @click="handleSubmit">
        Save &amp; Continue
      </CmButton>
    </div>
  </section>
</template>
