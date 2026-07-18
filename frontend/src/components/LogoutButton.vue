<script setup>
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/authStore';

const authStore = useAuthStore();
const router = useRouter();

const logout = async () => {
  await authStore.signOut();
  router.push({ name: 'Auth' });
};
</script>

<template>
  <button
    @click="logout"
    class="rounded-button bg-danger px-4 py-2 text-sm font-medium text-background hover:bg-danger-hover transition-colors duration-150"
  >
    Logout
  </button>
</template>
