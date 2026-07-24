<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../../stores/authStore';
import { useSchoolStore } from '../../stores/schoolStore';
import CmInput from '../../components/ui/CmInput.vue';
import CmSelect from '../../components/ui/CmSelect.vue';
import CmButton from '../../components/ui/CmButton.vue';
import CmAlert from '../../components/ui/CmAlert.vue';

const router = useRouter();
const authStore = useAuthStore();
const schoolStore = useSchoolStore();

const form = ref({
  schoolName: '',
  schoolType: 'MIXED',
  phone: '',
  email: '',
  address: '',
  academicSession: '2024/2025',
  currentTerm: 'FIRST',
  adminName: '',
  adminEmail: '',
  adminPhone: '',
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
  if (!form.value.email) {
    errors.value.email = 'Email is required';
  } else if (!form.value.email.includes('@')) {
    errors.value.email = 'Valid email required';
  }
  if (!form.value.adminName) errors.value.adminName = 'Administrator name is required';

  return Object.keys(errors.value).length === 0;
};

const handleSubmit = async () => {
  if (!validate()) return;

  loading.value = true;
  errors.value = {};

  try {
    const created = await schoolStore.createSchool({
      schoolName: form.value.schoolName,
      proprietorName: form.value.adminName,
      email: form.value.email,
      phone: form.value.phone,
      address: form.value.address || undefined,
      schoolType: form.value.schoolType,
      academicSession: form.value.academicSession || undefined,
      currentTerm: form.value.currentTerm || undefined,
    });

    if (!created) {
      errors.value.submit = schoolStore.error || 'Failed to save school information';
      return;
    }

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
            placeholder="CAPFLUX International School"
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

          <!-- Administrator Details -->
          <div class="pt-4 border-t border-divider">
            <h2 class="text-lg font-semibold text-text-primary mb-4">Administrator Details</h2>

            <div class="grid gap-4 sm:grid-cols-2">
              <CmInput
                v-model="form.adminName"
                label="Full Name"
                placeholder="John Doe"
                required
                :error="errors.adminName"
              />
              <CmInput
                v-model="form.adminEmail"
                label="Email"
                type="email"
                placeholder="admin@yourschool.edu.ng"
              />
            </div>

            <CmInput
              v-model="form.adminPhone"
              label="Phone"
              type="tel"
              placeholder="08012345678"
              class="mt-4"
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