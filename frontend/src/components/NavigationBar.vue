<script setup>
import { computed } from 'vue';
import { useAuthStore } from '../stores/authStore';
import { useRoute, useRouter } from 'vue-router';

const authStore = useAuthStore();
const route = useRoute();
const router = useRouter();

const activeClass = (name) => route.name === name ? 'text-white font-semibold' : 'text-slate-400';

const logout = async () => {
  await authStore.signOut();
  router.push({ name: 'Login' });
};
</script>

<template>
  <header class="flex flex-col gap-4 rounded-3xl bg-slate-900 p-6 shadow-xl md:flex-row md:items-center md:justify-between">
    <div>
      <p class="text-sm uppercase tracking-[0.24em] text-slate-500">Capstone</p>
      <p class="text-2xl font-semibold text-white">School Finance</p>
    </div>

    <div class="flex flex-wrap items-center gap-4">
      <button class="rounded-xl px-4 py-2 transition hover:bg-slate-800" :class="activeClass('Home')" @click="router.push({ name: 'Home' })">Dashboard</button>
      <button class="rounded-xl px-4 py-2 transition hover:bg-slate-800" :class="activeClass('Students')" @click="router.push({ name: 'Students' })">Students</button>
      <button class="rounded-xl px-4 py-2 transition hover:bg-slate-800" :class="activeClass('Billing')" @click="router.push({ name: 'Billing' })">Billing</button>
      <button class="rounded-xl bg-rose-500 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-400" @click="logout">Logout</button>
    </div>
  </header>
</template>
