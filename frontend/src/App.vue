<template>
  <AppShell v-if="isDashboardRoute">
    <router-view />
  </AppShell>
  <router-view v-else />
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useThemeStore } from './stores/themeStore';
import AppShell from './components/AppShell.vue';

const route = useRoute();
const themeStore = useThemeStore();

onMounted(() => {
  themeStore.initTheme();
});

const isDashboardRoute = computed(() => {
  return !!route.meta?.requiresAuth && !route.meta?.onboarding;
});
</script>
