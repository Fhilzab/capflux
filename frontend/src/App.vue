<template>
  <div v-if="isAuthenticatedRoute" class="flex min-h-screen bg-slate-950">
    <Sidebar />
    <div class="flex-1 ml-64">
      <TopNav />
      <main class="p-0">
        <router-view />
      </main>
    </div>
  </div>
  <router-view v-else />
</template>

<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import Sidebar from './components/Sidebar.vue';
import TopNav from './components/TopNav.vue';

const route = useRoute();

const authRequiredRoutes = [
  'Home', 'Students', 'StudentDetail', 'Billing', 'Payments',
  'Notifications', 'Reports', 'Sync', 'SchoolProfile',
];

const isAuthenticatedRoute = computed(() => {
  return route.meta?.requiresAuth || authRequiredRoutes.includes(route.name);
});
</script>