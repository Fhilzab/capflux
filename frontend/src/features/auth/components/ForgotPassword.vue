<script setup lang="ts">
import { ref, computed } from 'vue';
import { useAuthStore } from '../../../stores/authStore';
import CmButton from '../../../components/ui/CmButton.vue';
import CmInput from '../../../components/ui/CmInput.vue';
import CmAlert from '../../../components/ui/CmAlert.vue';
import type { AuthState } from '../useAuthState';

interface Emits {
  (e: 'switch-state', state: AuthState): void;
}

const emit = defineEmits<Emits>();
const authStore = useAuthStore();

const email = ref('');
const submitted = ref(false);
const isSubmitted = ref(false);

const isEmailValid = computed(() => {
  const e = email.value.trim();
  return e.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
});

const canSubmit = computed(() => isEmailValid.value);

const handleReset = async () => {
  if (!canSubmit.value || authStore.loading) return;

  submitted.value = true;
  const { error } = await authStore.forgotPassword(email.value.trim());

  if (!error) {
    isSubmitted.value = true;
  }
};

const switchToLogin = () => {
  emit('switch-state', 'login');
};
</script>

<template>
  <div class="w-full text-center space-y-6">
    <div v-if="!isSubmitted">
      <h2 class="text-headline mb-1">Reset your password</h2>
      <p class="text-subheadline text-text-secondary">
        Enter your email and we'll send you a link to reset your password.
      </p>
    </div>

    <div v-else class="space-y-4">
      <CmAlert
        variant="success"
        title="Check your email"
        :description="`If an account exists for ${email}, a password reset link has been sent.`"
      />
    </div>

    <CmAlert
      v-if="authStore.error && !isSubmitted"
      variant="danger"
      title="Error"
      :description="authStore.error"
    />

    <form v-if="!isSubmitted" @submit.prevent="handleReset" class="space-y-4">
      <div>
        <label for="forgot-email" class="block text-sm font-medium text-text-primary mb-1">
          Email address
        </label>
        <CmInput
          id="forgot-email"
          type="email"
          v-model="email"
          :error="submitted && !isEmailValid ? 'Enter a valid email address' : undefined"
          placeholder="you@school.edu.ng"
          autocomplete="email"
        />
      </div>

      <CmButton
        type="submit"
        variant="primary"
        :loading="authStore.loading"
        :disabled="!canSubmit || authStore.loading"
        class="w-full"
      >
        Send Reset Link
      </CmButton>
    </form>

    <CmButton
      v-if="!isSubmitted"
      type="button"
      variant="link"
      @click="switchToLogin"
    >
      Back to sign in
    </CmButton>
  </div>
</template>
