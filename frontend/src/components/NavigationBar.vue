<script setup lang="ts">
import { computed } from 'vue';
import { useAuthStore } from '../stores/authStore';
import { useRoute, useRouter } from 'vue-router';
import CmButton from '../components/ui/CmButton.vue';

const authStore = useAuthStore();
const route = useRoute();
const router = useRouter();

const activeClass = (name) => route.name === name ? 'text-text-primary font-semibold' : 'text-text-muted';

const logout = async () => {
  await authStore.signOut();
  router.push({ name: 'Login' });
};
</script>

<template>
  <header class="flex flex-col gap-4 rounded-card bg-card p-6 shadow-card md:flex-row md:items-center md:justify-between transition-colors duration-200">
    <div>
      <p class="text-sm uppercase tracking-[0.24em] text-text-muted">CAPFLUX</p>
      <p class="text-2xl font-semibold text-text-primary">School Finance</p>
    </div>

    <div class="flex flex-wrap items-center gap-4">
      <CmButton :class="activeClass('Home')" @click="router.push({ name: 'Home' })" variant="link">
        Dashboard
      </CmButton>
      <CmButton :class="activeClass('Students')" @click="router.push({ name: 'Students' })" variant="link">
        Students
      </CmButton>
      <CmButton :class="activeClass('Billing')" @click="router.push({ name: 'Billing' })" variant="link">
        Billing
      </CmButton>
      <CmButton :class="activeClass('Payments')" @click="router.push({ name: 'Payments' })" variant="link">
        Payments
      </CmButton>
      <CmButton :class="activeClass('Notifications')" @click="router.push({ name: 'Notifications' })" variant="link">
        Notifications
      </CmButton>
      <CmButton :class="activeClass('Reports')" @click="router.push({ name: 'Reports' })" variant="link">
        Reports
      </CmButton>
      <CmButton :class="activeClass('Sync')" @click="router.push({ name: 'Sync' })" variant="link">
        Sync
      </CmButton>
      <CmButton @click="logout" variant="danger">
        Logout
      </CmButton>
    </div>
  </header>
</template>