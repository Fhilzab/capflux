<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../../../stores/authStore';
import CmInput from '../../../components/ui/CmInput.vue';
import CmButton from '../../../components/ui/CmButton.vue';
import CmAlert from '../../../components/ui/CmAlert.vue';

interface Emits {
  (e: 'switch-state', state: 'login' | 'verify-email'): void;
}

const emit = defineEmits<Emits>();

const authStore = useAuthStore();
const router = useRouter();

const fullName = ref('');
const email = ref('');
const password = ref('');
const showPassword = ref(false);
const agreeToTerms = ref(false);
const isOffline = ref(!navigator.onLine);

// Password strength calculation
const passwordStrength = computed(() => {
  const pwd = password.value;
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
  const colors = ['bg-danger', 'bg-warning', 'bg-info', 'bg-success'];
  return colors[passwordStrength.value - 1] || 'bg-border';
});

// Validation
const error = ref<string | null>(null);

const validate = (): boolean => {
  if (!fullName.value) {
    error.value = 'Full name is required';
    return false;
  }
  if (!email.value) {
    error.value = 'Email is required';
    return false;
  }
  if (!email.value.includes('@')) {
    error.value = 'Please enter a valid email address';
    return false;
  }
  if (!password.value) {
    error.value = 'Password is required';
    return false;
  }
  if (password.value.length < 8) {
    error.value = 'Password must be at least 8 characters';
    return false;
  }
  if (!agreeToTerms.value) {
    error.value = 'Please accept the Terms of Service and Privacy Policy';
    return false;
  }
  error.value = null;
  return true;
};

const handleSignUp = async () => {
  if (!validate()) return;

  if (isOffline.value) return;

  const response = await authStore.signUp({
    email: email.value,
    password: password.value,
  });

  if (response?.error) {
    error.value = response.error.message || 'Failed to create account';
    return;
  }

  // After successful signup, transition to verify-email state
  emit('switch-state', 'verify-email');
};

const handleGoogleSignIn = () => {
  // Placeholder for Google OAuth integration
};

// Handle offline/online status
window.addEventListener('online', () => isOffline.value = false);
window.addEventListener('offline', () => isOffline.value = true);
</script>

<template>
  <div class="w-full">
    <!-- Form Header -->
    <div class="mb-8 text-center">
      <h2 class="text-headline mb-2">Create your account</h2>
      <p class="text-text-secondary">Start managing your school's finances today</p>
    </div>

    <!-- Offline Notice -->
    <CmAlert
      v-if="isOffline"
      variant="warning"
      title="Offline"
      description="Internet access is required to create an account."
      class="mb-6"
    />

    <!-- Error Alert -->
    <CmAlert
      v-if="error"
      variant="danger"
      title="Sign Up Failed"
      :description="error"
      class="mb-6"
    />

    <!-- Register Form -->
    <form @submit.prevent="handleSignUp" class="space-y-6">
      <!-- Full Name -->
      <CmInput
        v-model="fullName"
        label="Full Name"
        placeholder="John Doe"
        autocomplete="name"
        required
        :disabled="isOffline"
      />

      <!-- Email -->
      <CmInput
        v-model="email"
        label="Email Address"
        type="email"
        placeholder="you@yourschool.edu.ng"
        autocomplete="email"
        required
        :disabled="isOffline"
      />

      <!-- Password -->
      <div class="space-y-2">
        <CmInput
          v-model="password"
          label="Password"
          :type="showPassword ? 'text' : 'password'"
          placeholder="••••••••"
          autocomplete="new-password"
          required
          :disabled="isOffline"
        />
        <CmButton
          variant="link"
          type="button"
          @click="showPassword = !showPassword"
          :disabled="isOffline"
          aria-label="Toggle password visibility"
        >
          {{ showPassword ? 'Hide' : 'Show' }} password
        </CmButton>
      </div>

      <!-- Password Strength -->
      <div v-if="password" class="space-y-1">
        <div class="flex gap-1">
          <div
            v-for="i in 4"
            :key="i"
            class="flex-1 h-1 rounded-full transition-colors"
            :class="i <= passwordStrength ? strengthColor : 'bg-border'"
          ></div>
        </div>
        <p class="text-xs text-text-muted">
          Password strength: <span class="font-medium">{{ strengthLabel }}</span>
        </p>
      </div>

      <!-- Terms & Privacy -->
      <label class="flex items-start gap-2 cursor-pointer">
        <input
          v-model="agreeToTerms"
          type="checkbox"
          class="mt-0.5 w-4 h-4 rounded border-border text-brand focus:ring-brand focus-ring"
          :disabled="isOffline"
        />
        <span class="text-sm text-text-secondary">
          I agree to the
          <a href="#" class="font-medium text-brand hover:text-brand/80 transition-colors">Terms of Service</a>
          and
          <a href="#" class="font-medium text-brand hover:text-brand/80 transition-colors">Privacy Policy</a>
        </span>
      </label>

      <!-- Sign Up Button -->
      <CmButton
        type="submit"
        variant="primary"
        :loading="authStore.loading"
        :disabled="isOffline || !fullName || !email || !password || !agreeToTerms"
        class="w-full"
      >
        Create Free Account
      </CmButton>
    </form>

    <!-- Divider -->
    <div class="my-6 flex items-center">
      <div class="flex-1 border-t border-divider"></div>
      <span class="px-4 text-sm text-text-muted">OR</span>
      <div class="flex-1 border-t border-divider"></div>
    </div>

    <!-- Google Sign In -->
    <CmButton
      @click="handleGoogleSignIn"
      variant="secondary"
      :disabled="isOffline"
      class="w-full"
      data-google-auth
    >
      Continue with Google
    </CmButton>
  </div>

  <!-- Footer Links -->
  <div class="mt-6 pt-6 border-t border-divider text-center">
    <span class="text-text-secondary">Already have an account?</span>
    <CmButton
      variant="link"
      type="button"
      @click="$emit('switch-state', 'login')"
    >
      Log In
    </CmButton>
  </div>
</template>