<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '../../../stores/authStore';
import CmButton from '../../../components/ui/CmButton.vue';
import CmInput from '../../../components/ui/CmInput.vue';
import CmAlert from '../../../components/ui/CmAlert.vue';
import type { AuthState } from '../useAuthState';

interface Emits {
  (e: 'switch-state', state: AuthState): void;
}

const emit = defineEmits<Emits>();
const route = useRoute();
const authStore = useAuthStore();

const token = ref('');
const newPassword = ref('');
const confirmPassword = ref(false);
const submitted = ref(false);
const isReset = ref(false);

onMounted(() => {
  const t = route.query.token;
  if (typeof t === 'string' && t) {
    token.value = t;
  }
});

const isPasswordValid = computed(() => newPassword.value.length >= 8);

const passwordsMatch = computed(() => {
  return confirmPassword.value && newPassword.value.length > 0 &&
    confirmPassword.value === newPassword.value;
});

const canSubmit = computed(() => {
  return token.value.length > 0 && isPasswordValid.value && passwordsMatch.value;
});

const handleReset = async () => {
  if (!canSubmit.value || authStore.loading) return;
  submitted.value = true;

  const { error } = await authStore.resetPassword(token.value, newPassword.value);

  if (!error) {
    isReset.value = true;
  }
};

const switchToLogin = () => {
  emit('switch-state', 'login');
};
</script>

<template>
  <div class="w-full text-center space-y-6">
    <div v-if="!isReset">
      <h2 class="text-headline mb-1">Set your new password</h2>
      <p class="text-subheadline text-text-secondary">
        Enter a new password to continue.
      </p>
    </div>

    <CmAlert
      v-if="isReset"
      variant="success"
      title="Password updated"
      description="Your password has been reset successfully. You can now sign in."
    />

    <CmAlert
      v-if="authStore.error && !isReset"
      variant="danger"
      title="Reset error"
      :description="authStore.error"
    />

    <form v-if="!isReset" @submit.prevent="handleReset" class="space-y-4">
      <input type="hidden" v-model="token" />

      <div>
        <label for="reset-password" class="block text-sm font-medium text-text-primary mb-1">
          New password
        </label>
        <CmInput
          id="reset-password"
          type="password"
          v-model="newPassword"
          :error="submitted && !isPasswordValid ? 'Password must be at least 8 characters' : undefined"
          placeholder="••••••••"
          autocomplete="new-password"
        />
      </div>

      <div>
        <label for="reset-confirm" class="block text-sm font-medium text-text-primary mb-1">
          Confirm password
        </label>
        <CmInput
          id="reset-confirm"
          type="password"
          v-model="confirmPassword"
          :error="submitted && !passwordsMatch ? 'Passwords do not match' : undefined"
          placeholder="••••••••"
          autocomplete="new-password"
        />
      </div>

      <CmButton
        type="submit"
        variant="primary"
        :loading="authStore.loading"
        :disabled="!canSubmit || authStore.loading"
        class="w-full"
      >
        Reset Password
      </CmButton>
    </form>

    <CmButton
      v-if="!isReset"
      type="button"
      variant="link"
      @click="switchToLogin"
    >
      Back to sign in
    </CmButton>
  </div>
</template>
