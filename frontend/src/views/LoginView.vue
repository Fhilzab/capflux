<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/authStore';

const router = useRouter();
const authStore = useAuthStore();

const email = ref('');
const password = ref('');
const error = ref(null);
const signupError = ref(null);
const signupSuccess = ref(null);

const signIn = async () => {
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
</script>

<template>
  <main class="min-h-screen bg-slate-950 text-white flex items-center justify-center px-4">
    <section class="w-full max-w-md rounded-2xl bg-slate-900 p-8 shadow-xl">
      <h1 class="text-3xl font-semibold mb-6">Sign in to Capstone</h1>

      <div class="space-y-4">
        <label class="block">
          <span class="text-sm text-slate-400">Email</span>
          <input
            v-model="email"
            type="email"
            class="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white focus:border-cyan-400 focus:outline-none"
            autocomplete="username"
          />
        </label>

        <label class="block">
          <span class="text-sm text-slate-400">Password</span>
          <input
            v-model="password"
            type="password"
            class="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white focus:border-cyan-400 focus:outline-none"
            autocomplete="current-password"
          />
        </label>

        <button
          @click="signIn"
          class="w-full rounded-2xl bg-cyan-500 py-3 text-base font-semibold text-slate-950 transition hover:bg-cyan-400"
        >
          Sign in
        </button>

        <button
          @click="signUp"
          type="button"
          class="mt-3 w-full rounded-2xl bg-slate-800 py-3 text-base font-semibold text-white transition hover:bg-slate-700"
        >
          Create account
        </button>

        <button
          type="button"
          @click="router.push({ name: 'Landing' })"
          class="mt-3 w-full rounded-2xl border border-slate-700 bg-slate-900 py-3 text-base font-semibold text-white transition hover:border-cyan-400 hover:text-cyan-300"
        >
          Back to landing page
        </button>

        <p v-if="signupSuccess" class="text-sm text-emerald-400">{{ signupSuccess }}</p>
        <p v-if="signupError" class="text-sm text-rose-400">{{ signupError }}</p>
        <p v-if="error" class="text-sm text-rose-400">{{ error }}</p>
      </div>
    </section>
  </main>
</template>
