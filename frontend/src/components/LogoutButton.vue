<script setup>
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/authStore';
import CmButton from '../components/ui/CmButton.vue';

const authStore = useAuthStore();
const router = useRouter();

const logout = async () => {
  await authStore.signOut();
  router.push({ name: 'Auth' });
};
</script>

<template>
  <CmButton @click="logout" variant="danger">
    Logout
  </CmButton>
</template>
