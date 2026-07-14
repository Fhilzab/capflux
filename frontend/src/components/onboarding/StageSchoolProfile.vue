<script setup lang="ts">
import { ref, computed } from 'vue';
import { useOnboardingStore } from '../../stores/onboardingStore';

const onboardingStore = useOnboardingStore();

const form = ref({
  schoolName: '',
  proprietorName: '',
  email: '',
  phone: '',
  address: '',
  schoolType: 'MIXED',
  academicSession: '2024/2025',
  currentTerm: 'FIRST',
});

const errors = ref<Record<string, string>>({});
const loading = ref(false);

const schoolTypes = [
  { value: 'NURSERY', label: 'Nursery Only' },
  { value: 'PRIMARY', label: 'Primary Only' },
  { value: 'SECONDARY', label: 'Secondary Only' },
  { value: 'MIXED', label: 'Mixed' },
];

const validate = () => {
  errors.value = {};
  
  if (!form.value.schoolName) errors.value.schoolName = 'School name is required';
  if (!form.value.proprietorName) errors.value.proprietorName = 'Proprietor name is required';
  if (!form.value.email) errors.value.email = 'Email is required';
  else if (!form.value.email.includes('@')) errors.value.email = 'Valid email required';
  if (!form.value.phone) errors.value.phone = 'Phone number is required';
  
  return Object.keys(errors.value).length === 0;
};

const handleSubmit = async () => {
  if (!validate()) return;
  
  loading.value = true;
  
  try {
    const result = await onboardingStore.createSchool({
      ...form.value,
    });
    
    if (result.success) {
      await onboardingStore.completeStep('school_profile');
      onboardingStore.setStage(2);
    }
  } catch (e: any) {
    errors.value.submit = e.message || 'Failed to create school';
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <div class="premium-card p-8">
    <h2 class="text-headline mb-2">School Profile</h2>
    <p class="text-slate-500 mb-6">Let's start with your school's basic information</p>

    <form @submit.prevent="handleSubmit" class="space-y-6">
      <!-- School Name -->
      <div>
        <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          School Name
        </label>
        <input
          v-model="form.schoolName"
          type="text"
          placeholder="Capstone International School"
          class="w-full rounded-xl px-4 py-3 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 focus-ring"
          :class="{ 'border-rose-500': errors.schoolName }"
        />
        <p v-if="errors.schoolName" class="text-xs text-rose-600 mt-1">{{ errors.schoolName }}</p>
      </div>

      <!-- Proprietor Name -->
      <div>
        <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          Proprietor Full Name
        </label>
        <input
          v-model="form.proprietorName"
          type="text"
          placeholder="Dr. Ade Johnson"
          class="w-full rounded-xl px-4 py-3 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 focus-ring"
          :class="{ 'border-rose-500': errors.proprietorName }"
        />
        <p v-if="errors.proprietorName" class="text-xs text-rose-600 mt-1">{{ errors.proprietorName }}</p>
      </div>

      <!-- Email & Phone -->
      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Email Address
          </label>
          <input
            v-model="form.email"
            type="email"
            placeholder="proprietor@school.edu.ng"
            class="w-full rounded-xl px-4 py-3 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 focus-ring"
            :class="{ 'border-rose-500': errors.email }"
          />
          <p v-if="errors.email" class="text-xs text-rose-600 mt-1">{{ errors.email }}</p>
        </div>
        <div>
          <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Phone Number
          </label>
          <input
            v-model="form.phone"
            type="tel"
            placeholder="08012345678"
            class="w-full rounded-xl px-4 py-3 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 focus-ring"
            :class="{ 'border-rose-500': errors.phone }"
          />
          <p v-if="errors.phone" class="text-xs text-rose-600 mt-1">{{ errors.phone }}</p>
        </div>
      </div>

      <!-- Address -->
      <div>
        <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          School Address
        </label>
        <textarea
          v-model="form.address"
          placeholder="123 Education Avenue, Lagos"
          class="w-full rounded-xl px-4 py-3 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 focus-ring"
          rows="2"
        ></textarea>
      </div>

      <!-- School Type -->
      <div>
        <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          School Type
        </label>
        <select
          v-model="form.schoolType"
          class="w-full rounded-xl px-4 py-3 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 focus-ring"
        >
          <option v-for="type in schoolTypes" :key="type.value" :value="type.value">
            {{ type.label }}
          </option>
        </select>
      </div>

      <!-- Academic Session & Term -->
      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Academic Session
          </label>
          <input
            v-model="form.academicSession"
            type="text"
            placeholder="2024/2025"
            class="w-full rounded-xl px-4 py-3 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 focus-ring"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Current Term
          </label>
          <select
            v-model="form.currentTerm"
            class="w-full rounded-xl px-4 py-3 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 focus-ring"
          >
            <option value="FIRST">First Term</option>
            <option value="SECOND">Second Term</option>
            <option value="THIRD">Third Term</option>
          </select>
        </div>
      </div>

      <p v-if="errors.submit" class="text-sm text-rose-600">{{ errors.submit }}</p>

      <button
        type="submit"
        :disabled="loading"
        class="w-full rounded-xl px-4 py-3 bg-cyan-500 text-slate-950 font-medium hover:bg-cyan-400 transition-colors disabled:opacity-50 focus-ring"
      >
        {{ loading ? 'Creating...' : 'Continue to Financial Setup' }}
      </button>
    </form>
  </div>
</template>