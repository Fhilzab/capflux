<script setup lang="ts">
import { watch, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../../stores/authStore';
import { AuthService } from '../../shared/services/AuthService';
import { useAuthState } from './useAuthState';
import { supabase, hasSupabaseConfig } from '../../shared/services/api/supabase';
import AuthLayout from './components/AuthLayout.vue';
import AuthIllustration from './components/AuthIllustration.vue';
import LoginForm from './components/LoginForm.vue';
import RegisterForm from './components/RegisterForm.vue';
import EmailVerification from './components/EmailVerification.vue';
import ForgotPassword from './components/ForgotPassword.vue';
import ResetPassword from './components/ResetPassword.vue';

interface Props {
  initialMode?: string;
  provider?: string | null;
}

const props = defineProps<Props>();
const route = useRoute();
const router = useRouter();

const { state, transition } = useAuthState();
const authStore = useAuthStore();

// Helper to normalize query param (can be string or string[])
const getQueryParam = (param: string | string[] | undefined): string => {
  if (Array.isArray(param)) return param[0] || '';
  return param || '';
};

// Handle email verification callback on mount
// Supports both PKCE (code) and legacy (token_hash) flows
onMounted(async () => {
  const code = getQueryParam(route.query.code);
  const tokenHash = getQueryParam(route.query.token_hash);

  // Flow 1: PKCE code exchange
  if (code && hasSupabaseConfig) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error && data?.session) {
      // Update auth store with the session
      authStore.session = data.session;
      authStore.user = data.session.user;
      
      // Check email verification status
      const userEmailConfirmed = !!data.session.user?.email_confirmed_at;
      authStore.emailVerified = userEmailConfirmed;
      
      // Clean URL and redirect to dashboard
      router.replace({ name: 'Home' });
      return;
    }
    
    // Log error but don't block - user can retry login
    console.error('[AUTH DEBUG] code exchange failed:', error);
  }

  // Flow 2: Legacy token_hash
  if (tokenHash && hasSupabaseConfig && !code) {
    const { error } = await AuthService.verifyOtp(tokenHash, 'email');
    
    if (!error) {
      // Refresh auth state after verification
      await authStore.initialize();
      
      if (authStore.isAuthenticated) {
        // Clean URL and redirect to dashboard
        router.replace({ name: 'Home' });
        return;
      }
    }
    
    console.error('[AUTH DEBUG] token_hash verification failed:', error);
  }
});

// Set initial state from URL query params on mount
watch(() => route.query, (query) => {
  const mode = getQueryParam(query.mode) as string;
  if (mode && ['login', 'signup', 'verify-email', 'forgot-password', 'reset-password'].includes(mode)) {
    transition(mode as any);
  }
}, { immediate: true });

// Handle Google OAuth redirect from URL query
if (props.provider === 'google') {
  // Will trigger Google OAuth on next tick
  setTimeout(() => {
    const googleButton = document.querySelector('[data-google-auth]');
    if (googleButton) {
      (googleButton as HTMLElement).click();
    }
  }, 100);
}
</script>

<template>
  <AuthLayout>
    <!-- Left Panel - Illustration (Desktop) -->
    <template #illustration>
      <AuthIllustration />
    </template>

    <!-- Mobile Illustration -->
    <template #illustration-mobile>
      <AuthIllustration />
    </template>

    <!-- Right Panel - Forms -->
    <template #form>
      <div>
        <LoginForm
          v-if="state === 'login'"
          @switch-state="transition"
          :key="'login'"
        />

        <RegisterForm
          v-else-if="state === 'signup'"
          @switch-state="transition"
          :key="'signup'"
        />

        <EmailVerification
          v-else-if="state === 'verify-email'"
          @switch-state="transition"
          :key="'verify-email'"
        />

        <ForgotPassword
          v-else-if="state === 'forgot-password'"
          @switch-state="transition"
          :key="'forgot-password'"
        />

        <ResetPassword
          v-else-if="state === 'reset-password'"
          @switch-state="transition"
          :key="'reset-password'"
        />
      </div>
    </template>

    <!-- Footer -->
    <template #footer>
      <div class="mt-6 text-center text-xs text-text-muted">
        <p>&copy; 2024 Capstone Software Solutions Ltd. All rights reserved.</p>
      </div>
    </template>
  </AuthLayout>
</template>

<style>
/* Auth transition - fade + slide + scale */
.auth-enter-active,
.auth-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.auth-enter-from {
  opacity: 0;
  transform: translateY(10px) scale(0.98);
}

.auth-leave-to {
  opacity: 0;
  transform: translateY(-10px) scale(0.98);
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .auth-enter-active,
  .auth-leave-active {
    transition: none;
  }

  .auth-enter-from,
  .auth-leave-to {
    opacity: 1;
    transform: none;
  }
}
</style>