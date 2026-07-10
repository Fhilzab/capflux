<script setup>
import { useAuthStore } from '../stores/authStore';

const authStore = useAuthStore();

const logout = async () => {
  await authStore.signOut();
};
</script>

<template>
  <button
    @click="logout"
    class="rounded-xl bg-rose-500 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-400"
  >
    Logout
  </button>
</template>
