<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useOnboardingStore } from '../../stores/onboardingStore';
import CmInput from '../../components/ui/CmInput.vue';
import CmButton from '../../components/ui/CmButton.vue';
import CmAlert from '../../components/ui/CmAlert.vue';

const router = useRouter();
const onboardingStore = useOnboardingStore();

const adminForm = ref({
  adminName: '',
  email: '',
  password: '',
  confirmPassword: '',
});

const errors = ref<Record<string, string>>({});
const loading = ref(false);
const showPassword = ref(false);
const isOffline = ref(!navigator.onLine);

// Password strength calculation
const passwordStrength = computed(() => {
  const pwd = adminForm.value.password;
  if (!pwd) return 0;
  
  let strength = 0;
  if (pwd.length >= 8) strength += 1;
  if (/[A-Z]/.test(pwd)) strength += 1;
  if (/[0-9]/.test(pwd)) strength += 1;
  if (/[^A-Za-z0-9]/.test(pwd)) strength += 1;
  
  return strength;
});

const strengthLabel = computed(() => {
  const labels = ['Weak', 'Fair', 'Good', 'Strong'];
  return labels[passwordStrength.value - 1] || '';
});

const strengthColor = computed(() => {
  const colors = ['border-danger', 'border-warning', 'border-info', 'border-success'];
  return colors[passwordStrength.value - 1] || 'border-border';
});

const validate = () => {
  errors.value = {};
  
  if (!adminForm.value.adminName) errors.value.adminName = 'Administrator name is required';
  if (!adminForm.value.email) errors.value.email = 'Email is required';
  else if (!adminForm.value.email.includes('@')) errors.value.email = 'Valid email required';
  if (!adminForm.value.password) errors.value.password = 'Password is required';
  else if (adminForm.value.password.length < 8) errors.value.password = 'Password must be at least 8 characters';
  if (!adminForm.value.confirmPassword) errors.value.confirmPassword = 'Please confirm your password';
  else if (adminForm.value.password !== adminForm.value.confirmPassword) {
    errors.value.confirmPassword = 'Passwords do not match';
  }
  
  return Object.keys(errors.value).length === 0;
};

const handleSubmit = async () => {
  if (!validate()) return;
  
  loading.value = true;
  errors.value = {};

  try {
    await onboardingStore.createAdminAccount({
      adminName: adminForm.value.adminName,
      email: adminForm.value.email,
      password: adminForm.value.password,
    });
    onboardingStore.setStage(3);
  } catch (e: any) {
    errors.value.submit = e.message || 'Failed to create administrator account';
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <div class="premium-card bg-card p-8">
    <h2 class="text-headline mb-2">Administrator Account</h2>
    <p class="text-text-secondary mb-6">Create the administrator account for your school</p>

    <!-- Offline Notice -->
    <CmAlert
      v-if="isOffline"
      variant="warning"
      title="Offline Mode"
      description="Internet access is required to create an administrator account."
      class="mb-6"
    />

    <form @submit.prevent="handleSubmit" class="space-y-6">
      <!-- Administrator Name -->
      <CmInput
        v-model="adminForm.adminName"
        label="Administrator Full Name"
        placeholder="Dr. Ade Johnson"
        required
        :error="errors.adminName"
      />

      <!-- Email -->
      <CmInput
        v-model="adminForm.email"
        label="Email Address"
        type="email"
        placeholder="admin@yourschool.edu.ng"
        required
        :error="errors.email"
      />

      <!-- Password -->
      <div class="space-y-2">
        <CmInput
          v-model="adminForm.password"
          :label="showPassword ? 'Password' : 'Password'"
          :type="showPassword ? 'text' : 'password'"
          placeholder="••••••••"
          required
          :error="errors.password"
          autocomplete="new-password"
        />
        <button
          type="button"
          @click="showPassword = !showPassword"
          class="text-sm font-medium text-primary hover:text-primary-hover transition-colors focus-ring"
          aria-label="Toggle password visibility"
        >
          {{ showPassword ? 'Hide' : 'Show' }} password
        </button>
      </div>

      <!-- Confirm Password -->
      <div class="space-y-2">
        <CmInput
          v-model="adminForm.confirmPassword"
          :label="showPassword ? 'Confirm Password' : 'Confirm Password'"
          :type="showPassword ? 'text' : 'password'"
          placeholder="••••••••"
          required
          :error="errors.confirmPassword"
          autocomplete="new-password"
        />
      </div>

      <!-- Password Strength Indicator -->
      <div v-if="adminForm.password" class="space-y-2">
        <div class="flex gap-1">
          <div 
            v-for="i in 4" 
            :key="i"
            class="flex-1 h-1 rounded-full transition-colors"
            :class="i <= passwordStrength ? strengthColor.replace('border-', 'bg-') : 'bg-border'"
          ></div>
        </div>
        <p class="text-xs text-text-muted">
          Password strength: <span class="font-medium">{{ strengthLabel }}</span>
        </p>
      </div>

      <!-- Submit Error -->
      <CmAlert
        v-if="errors.submit"
        variant="danger"
        :description="errors.submit"
      />

      <!-- Submit Button -->
      <CmButton
        type="submit"
        variant="primary"
        :loading="loading"
        :disabled="isOffline"
        class="w-full"
      >
        Continue to Confirmation
      </CmButton>
    </form>
  </div>
</template>