<script setup>
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../stores/authStore';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const isActive = (name) => route.name === name;

const navItems = [
  { name: 'Home', label: 'Dashboard', icon: 'dashboard' },
  { name: 'Students', label: 'Students', icon: 'students' },
  { name: 'Billing', label: 'Billing', icon: 'billing' },
  { name: 'Payments', label: 'Payments', icon: 'payments' },
  { name: 'Notifications', label: 'Notifications', icon: 'notifications' },
  { name: 'Reports', label: 'Reports', icon: 'reports' },
  { name: 'Sync', label: 'Sync Center', icon: 'sync' },
  { name: 'SchoolProfile', label: 'School Settings', icon: 'settings' },
];

const navigate = (name) => {
  router.push({ name });
};

const logout = async () => {
  await authStore.signOut();
  router.push({ name: 'Login' });
};
</script>

<template>
  <aside class="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col bg-slate-900 border-r border-slate-800">
    <!-- School branding -->
    <div class="flex items-center gap-3 px-6 py-6 border-b border-slate-800">
      <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500 text-slate-950 font-bold text-lg">
        C
      </div>
      <div>
        <p class="text-sm font-semibold text-white">Capstone</p>
        <p class="text-xs text-slate-400">School Finance</p>
      </div>
    </div>

    <!-- Navigation -->
    <nav class="flex-1 overflow-y-auto px-3 py-4 space-y-1">
      <button
        v-for="item in navItems"
        :key="item.name"
        @click="navigate(item.name)"
        class="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors"
        :class="isActive(item.name)
          ? 'bg-cyan-500/10 text-cyan-400'
          : 'text-slate-400 hover:bg-slate-800 hover:text-white'"
      >
        <!-- SVG icons inline -->
        <svg v-if="item.icon === 'dashboard'" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>
        <svg v-else-if="item.icon === 'students'" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"/></svg>
        <svg v-else-if="item.icon === 'billing'" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z"/></svg>
        <svg v-else-if="item.icon === 'payments'" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
        <svg v-else-if="item.icon === 'notifications'" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
        <svg v-else-if="item.icon === 'reports'" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
        <svg v-else-if="item.icon === 'sync'" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
        <svg v-else-if="item.icon === 'settings'" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
        <span>{{ item.label }}</span>
      </button>
    </nav>

    <!-- Logout -->
    <div class="border-t border-slate-800 px-3 py-4">
      <button
        @click="logout"
        class="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-rose-400 hover:bg-rose-500/10 transition-colors"
      >
        <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
        </svg>
        <span>Logout</span>
      </button>
    </div>
  </aside>
</template>