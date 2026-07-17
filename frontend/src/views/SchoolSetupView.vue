<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/authStore';
import { useOnboardingStore } from '../stores/onboardingStore';
import CmInput from '../components/ui/CmInput.vue';
import CmSelect from '../components/ui/CmSelect.vue';
import CmButton from '../components/ui/CmButton.vue';
import CmAlert from '../components/ui/CmAlert.vue';

const router = useRouter();
const authStore = useAuthStore();
const onboardingStore = useOnboardingStore();

const form = ref({
  schoolName: '',
  schoolType: 'MIXED',
  phone: '',
  email: '',
  address: '',
  academicSession: '2024/2025',
  currentTerm: 'FIRST',
});

const errors = ref<Record<string, string>>({});
const loading = ref(false);
const isOffline = ref(!navigator.onLine);

const schoolTypes = [
  { value: 'NURSERY', label: 'Nursery Only' },
  { value: 'PRIMARY', label: 'Primary Only' },
  { value: 'SECONDARY', label: 'Secondary Only' },
  { value: 'MIXED', label: 'Mixed' },
];

const terms = [
  { value: 'FIRST', label: 'First Term' },
  { value: 'SECOND', label: 'Second Term' },
  { value: 'THIRD', label: 'Third Term' },
];

const validate = () => {
  errors.value = {};
  
  if (!form.value.schoolName) errors.value.schoolName = 'School name is required';
  if (!form.value.phone) errors.value.phone = 'Phone number is required';
  if (!form.value.email) errors.value.email = 'Email is required';
  else if (!form.value.email.includes('@')) errors.value.email = 'Valid email required';
  
  return Object.keys(errors.value).length === 0;
};

const handleSubmit = async () => {
  if (!validate()) return;
  
  loading.value = true;
  errors.value = {};

  try {
    await onboardingStore.createSchool({
      schoolName: form.value.schoolName,
      proprietorName: authStore.user?.email?.split('@')[0] || 'School Admin',
      email: form.value.email,
      phone: form.value.phone,
      address: form.value.address,
      schoolType: form.value.schoolType,
      academicSession: form.value.academicSession,
      currentTerm: form.value.currentTerm,
    });
    
    // Mark onboarding as complete in auth store
    authStore.onboardingComplete = true;
    router.push({ name: 'Home' });
  } catch (e: any) {
    errors.value.submit = e.message || 'Failed to save school information';
  } finally {
    loading.value = false;
  }
};

// Handle offline/online status
window.addEventListener('online', () => isOffline.value = false);
window.addEventListener('offline', () => isOffline.value = true);
</script>

<template>
  <main class="min-h-screen bg-background flex items-center justify-center p-4">
    <div class="w-full max-w-2xl">
      <div class="premium-card bg-card p-8">
        <div class="mb-8">
          <h1 class="text-headline mb-2">Complete School Setup</h1>
          <p class="text-text-secondary">Set up your school's profile to activate fee collection</p>
        </div>

        <CmAlert
          v-if="isOffline"
          variant="warning"
          title="Offline"
          description="Internet access is required to complete school setup."
          class="mb-6"
        />

        <form @submit.prevent="handleSubmit" class="space-y-6">
          <!-- School Name -->
          <CmInput
            v-model="form.schoolName"
            label="School Name"
            placeholder="Capstone International School"
            required
            autofocus
            :error="errors.schoolName"
          />

          <!-- School Type -->
          <CmSelect
            v-model="form.schoolType"
            label="School Type"
            :options="schoolTypes"
            placeholder="Select school type"
          />

          <!-- Phone & Email -->
          <div class="grid gap-4 sm:grid-cols-2">
            <CmInput
              v-model="form.phone"
              label="Phone Number"
              type="tel"
              placeholder="08012345678"
              required
              :error="errors.phone"
            />
            <CmInput
              v-model="form.email"
              label="School Email"
              type="email"
              placeholder="info@yourschool.edu.ng"
              required
              :error="errors.email"
            />
          </div>

          <!-- Address -->
          <CmInput
            v-model="form.address"
            label="School Address"
            placeholder="123 Education Avenue, Lagos"
          />

          <!-- Academic Structure -->
          <div class="grid gap-4 sm:grid-cols-2">
            <CmInput
              v-model="form.academicSession"
              label="Academic Session"
              placeholder="2024/2025"
            />
            <CmSelect
              v-model="form.currentTerm"
              label="Current Term"
              :options="terms"
            />
          </div>

          <!-- Submit Error -->
          <CmAlert
            v-if="errors.submit"
            variant="danger"
            :description="errors.submit"
          />

          <!-- Save Button -->
          <CmButton
            type="submit"
            variant="primary"
            :loading="loading"
            :disabled="isOffline"
            class="w-full"
          >
            Complete Setup
          </CmButton>
        </form>
      </div>
    </div>
  </main>
</template>