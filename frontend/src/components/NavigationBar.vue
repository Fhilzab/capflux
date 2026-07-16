<script setup>
import { computed } from 'vue';
import { useAuthStore } from '../stores/authStore';
import { useRoute, useRouter } from 'vue-router';

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
      <p class="text-sm uppercase tracking-[0.24em] text-text-muted">Capstone</p>
      <p class="text-2xl font-semibold text-text-primary">School Finance</p>
    </div>

    <div class="flex flex-wrap items-center gap-4">
      <button class="rounded-button px-4 py-2 transition hover:bg-sidebar" :class="activeClass('Home')" @click="router.push({ name: 'Home' })">Dashboard</button>
      <button class="rounded-button px-4 py-2 transition hover:bg-sidebar" :class="activeClass('Students')" @click="router.push({ name: 'Students' })">Students</button>
      <button class="rounded-button px-4 py-2 transition hover:bg-sidebar" :class="activeClass('Billing')" @click="router.push({ name: 'Billing' })">Billing</button>
      <button class="rounded-button px-4 py-2 transition hover:bg-sidebar" :class="activeClass('Payments')" @click="router.push({ name: 'Payments' })">Payments</button>
      <button class="rounded-button px-4 py-2 transition hover:bg-sidebar" :class="activeClass('Notifications')" @click="router.push({ name: 'Notifications' })">Notifications</button>
      <button class="rounded-button px-4 py-2 transition hover:bg-sidebar" :class="activeClass('Reports')" @click="router.push({ name: 'Reports' })">Reports</button>
      <button class="rounded-button px-4 py-2 transition hover:bg-sidebar" :class="activeClass('Sync')" @click="router.push({ name: 'Sync' })">Sync</button>
      <button class="rounded-button bg-danger px-4 py-2 text-sm font-medium text-background hover:bg-danger-hover transition-colors duration-150" @click="logout">Logout</button>
    </div>
  </header>
</template>