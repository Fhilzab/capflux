<template>
  <div class="border-b border-divider bg-card px-6 pt-3">
    <nav class="flex gap-1" aria-label="Students area">
      <RouterLink
        v-for="tab in tabs"
        :key="tab.to"
        :to="tab.to"
        class="inline-flex items-center gap-2 border-b-2 px-3 pb-3 pt-1 text-sm font-medium transition-colors"
        :class="
          isActive(tab.to)
            ? 'border-brand text-brand'
            : 'border-transparent text-text-secondary hover:text-text-primary'
        "
      >
        <component :is="tab.icon" class="h-4 w-4" />
        {{ tab.label }}
      </RouterLink>
    </nav>
  </div>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router';
import { Users, GraduationCap } from '@lucide/vue';

const route = useRoute();

const tabs = [
  { to: '/students', label: 'Student Register', icon: Users },
  { to: '/students/academic-structure', label: 'Academic Structure', icon: GraduationCap },
];

function isActive(to: string): boolean {
  if (to === '/students') {
    return route.path === '/students' || /^\/students\/[^/]+$/.test(route.path);
  }
  return route.path.startsWith(to);
}
</script>
