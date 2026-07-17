<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/authStore';
import CmInput from '../components/ui/CmInput.vue';
import CmButton from '../components/ui/CmButton.vue';
import CmAlert from '../components/ui/CmAlert.vue';

const router = useRouter();
const authStore = useAuthStore();

const email = ref('');
const password = ref('');
const showPassword = ref(false);
const error = ref(null);
const signupError = ref(null);
const signupSuccess = ref(null);
const isOffline = ref(!navigator.onLine);

const signIn = async () => {
  if (isOffline.value) {
    error.value = "You're currently offline. Internet access is required to sign in.";
    return;
  }
  
  error.value = null;
  signupError.value = null;
  signupSuccess.value = null;

  const success = await authStore.signIn({
    email: email.value,
    password: password.value,
  });

  if (success) {
    router.push({ name: 'Home' });
  } else {
    error.value = authStore.error;
  }
};

const signUp = async () => {
  if (isOffline.value) {
    signupError.value = "You're currently offline. Internet access is required to sign up.";
    return;
  }
  
  error.value = null;
  signupError.value = null;
  signupSuccess.value = null;

  const response = await authStore.signUp({
    email: email.value,
    password: password.value,
  });

  if (response?.error) {
    signupError.value = response.error.message;
    return;
  }

  signupSuccess.value = 'Account created. Please confirm your email if required, then sign in.';
};

// Handle offline/online status changes
window.addEventListener('online', () => isOffline.value = false);
window.addEventListener('offline', () => isOffline.value = true);
</script>

<template>
  <main class="min-h-screen bg-background flex items-center justify-center p-4">
    <!-- Split Screen Layout -->
    <div class="w-full max-w-6xl grid lg:grid-cols-2 gap-8">
      <!-- Left Panel - Brand Statement -->
      <div class="hidden lg:flex flex-col justify-center pr-8">
        <div class="space-y-6">
          <h1 class="text-display sm:text-6xl text-primary">
            Every Naira Accounted For.
          </h1>
          <p class="text-xl text-text-secondary max-w-md">
            Welcome back to Capstone — the Financial Operating System built for African private schools.
          </p>
          
          <!-- Subtle Financial Network Animation -->
          <div class="mt-12 opacity-40">
            <svg class="w-full max-w-sm" viewBox="0 0 300 200" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="150" cy="100" r="2" class="fill-primary animate-pulse"/>
              <circle cx="80" cy="60" r="2" class="fill-primary/40"/>
              <circle cx="220" cy="60" r="2" class="fill-primary/40"/>
              <circle cx="80" cy="140" r="2" class="fill-primary/40"/>
              <circle cx="220" cy="140" r="2" class="fill-primary/40"/>
              <path d="M150 100 L80 60 M150 100 L220 60 M150 100 L80 140 M150 100 L220 140" 
                    stroke="currentColor" stroke-width="1" class="stroke-primary/20"/>
              <circle cx="80" cy="60" r="3" class="fill-primary/10"/>
              <circle cx="220" cy="60" r="3" class="fill-primary/10"/>
              <circle cx="80" cy="140" r="3" class="fill-primary/10"/>
              <circle cx="220" cy="140" r="3" class="fill-primary/10"/>
            </svg>
          </div>
        </div>
      </div>

      <!-- Right Panel - Login Card -->
      <div class="w-full max-w-md mx-auto">
        <div class="premium-card bg-card p-8 lg:p-10">
          <!-- Mobile Brand Statement -->
          <div class="lg:hidden text-center mb-8">
            <h2 class="text-headline sm:text-2xl mb-2">Every Naira Accounted For.</h2>
            <p class="text-sm text-text-secondary">Welcome back to Capstone</p>
          </div>

          <!-- Desktop Card Title -->
          <div class="hidden lg:block text-center mb-8">
            <h2 class="text-headline mb-2">Sign in to your account</h2>
            <p class="text-text-secondary">Access your financial workspace</p>
          </div>

          <!-- Offline Notice -->
          <CmAlert
            v-if="isOffline"
            variant="warning"
            title="Offline"
            description="You're currently offline. Internet access is required to sign in."
          />

          <!-- Error/Success Alerts -->
          <CmAlert
            v-if="error"
            variant="danger"
            title="Sign In Failed"
            :description="error"
          />

          <CmAlert
            v-if="signupSuccess"
            variant="success"
            title="Account Created"
            :description="signupSuccess"
          />

          <CmAlert
            v-if="signupError"
            variant="danger"
            title="Sign Up Failed"
            :description="signupError"
          />

          <form @submit.prevent="signIn" class="space-y-6">
            <!-- Email Field -->
            <CmInput
              v-model="email"
              label="Email Address"
              type="email"
              placeholder="proprietor@school.edu.ng"
              autocomplete="username"
              required
              autofocus
              :error="error && !email ? error : ''"
            />

            <!-- Password Field with Toggle -->
            <div class="space-y-2">
              <CmInput
                v-model="password"
                :label="showPassword ? 'Password' : 'Password'"
                :type="showPassword ? 'text' : 'password'"
                placeholder="Enter your password"
                autocomplete="current-password"
                required
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

            <!-- Remember Me & Forgot Password -->
            <div class="flex items-center justify-between">
              <label class="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  class="w-4 h-4 rounded border-border text-primary focus:ring-primary focus-ring"
                />
                <span class="text-sm text-text-secondary">Remember me</span>
              </label>
              <button
                type="button"
                @click="router.push({ name: 'Support' })"
                class="text-sm font-medium text-primary hover:text-primary-hover transition-colors focus-ring"
              >
                Forgot password?
              </button>
            </div>

            <!-- Sign In Button -->
            <CmButton
              type="submit"
              variant="primary"
              :loading="authStore.loading"
              :disabled="isOffline || !email || !password"
              class="w-full"
            >
              Sign In
            </CmButton>
          </form>

          <div class="mt-6 pt-6 border-t border-divider">
            <div class="text-center">
              <span class="text-text-secondary">Need help?</span>
              <button
                type="button"
                @click="router.push({ name: 'Support' })"
                class="ml-2 text-sm font-medium text-primary hover:text-primary-hover transition-colors focus-ring"
              >
                Contact Support
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>