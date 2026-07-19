<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { validatePassword, isPasswordRecommended } from '../../../utils/validation';
import CmInput from '../../../components/ui/CmInput.vue';
import CmButton from '../../../components/ui/CmButton.vue';
import CmAlert from '../../../components/ui/CmAlert.vue';

interface Emits {
  (e: 'switch-state', state: 'login'): void;
}

defineEmits<Emits>();

const router = useRouter();

const newPassword = ref('');
const confirmPassword = ref('');
const showPassword = ref(false);
const isOffline = ref(typeof navigator !== 'undefined' ? !navigator.onLine : false);
const loading = ref(false);
const error = ref<string | null>(null);

const handleSubmit = async () => {
  if (isOffline.value) return;

  error.value = null;
  
  // Check password match
  if (newPassword.value !== confirmPassword.value) {
    error.value = 'Passwords do not match';
    return;
  }
  
  // Validate password with centralized validation
  const validation = validatePassword(newPassword.value);
  if (!validation.valid) {
    error.value = validation.error || 'Password does not meet requirements';
    return;
  }

  loading.value = true;

  // Get the reset token from URL if present
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token') || '';

  // Import AuthService dynamically
  const { AuthService } = await import('../../../shared/services/AuthService');
  
  if (token) {
    // Verify the token first (for password reset flow)
    const { error: verifyError } = await AuthService.verifyOtp(token, 'recovery');
    if (verifyError) {
      error.value = verifyError.message;
      loading.value = false;
      return;
    }
  }

  // Update password via Supabase
  const { error: updateError } = await AuthService.updatePassword(newPassword.value);
  
  loading.value = false;
  
  if (updateError) {
    error.value = updateError.message;
    return;
  }

  // Success - redirect to login
  router.push({ name: 'Auth', query: { mode: 'login' } });
};

// Handle offline/online status
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => isOffline.value = false);
  window.addEventListener('offline', () => isOffline.value = true);
}
</script>

<template>
  <div class="w-full">
    <!-- Form Header -->
    <div class="mb-8 text-center">
      <h2 class="text-headline mb-2">Set new password</h2>
      <p class="text-text-secondary">Enter your new password below</p>
    </div>

    <!-- Offline Notice -->
    <CmAlert
      v-if="isOffline"
      variant="warning"
      title="Offline"
      description="Internet access is required to reset your password."
      class="mb-6"
    />

    <!-- Error Alert -->
    <CmAlert
      v-if="error"
      variant="danger"
      title="Reset Failed"
      :description="error"
      class="mb-6"
    />

    <!-- Reset Form -->
    <form @submit.prevent="handleSubmit" class="space-y-6">
      <CmInput
        v-model="newPassword"
        label="New Password"
        :type="showPassword ? 'text' : 'password'"
        placeholder="••••••••"
        autocomplete="new-password"
        required
        :disabled="isOffline"
      />

      <CmInput
        v-model="confirmPassword"
        label="Confirm Password"
        :type="showPassword ? 'text' : 'password'"
        placeholder="••••••••"
        autocomplete="new-password"
        required
        :disabled="isOffline"
      />

      <!-- Password Policy Notice -->
      <p class="text-xs text-text-muted">
        Password must be 8-64 characters with uppercase, lowercase, and special character.
        <span v-if="isPasswordRecommended(newPassword)" class="text-success">(Recommended: 12+ characters)</span>
      </p>

      <CmButton
        type="submit"
        variant="primary"
        :loading="loading"
        :disabled="isOffline || !newPassword || !confirmPassword"
        class="w-full"
      >
        Reset Password
      </CmButton>
    </form>

    <!-- Back to Login -->
    <div class="mt-6 pt-6 border-t border-divider text-center">
      <CmButton
        variant="link"
        type="button"
        @click="$emit('switch-state', 'login')"
      >
        Back to Login
      </CmButton>
    </div>
  </div>
</template>