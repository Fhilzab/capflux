<script setup lang="ts">
import { computed } from 'vue';
import { useThemeStore } from '../stores/themeStore';

const themeStore = useThemeStore();

const isDark = computed(() => themeStore.mode === 'dark');

const setTheme = (mode: 'dark' | 'light') => {
  themeStore.setTheme(mode);
};
</script>

<template>
  <div class="p-6 bg-slate-50 dark:bg-slate-950 min-h-screen">
    <div class="mb-6">
      <h1 class="text-headline">Settings</h1>
      <p class="text-slate-500 dark:text-slate-400">Manage your school's preferences</p>
    </div>

    <div class="max-w-2xl space-y-6">
      <!-- Appearance Settings -->
      <div class="premium-card p-6">
        <h2 class="text-title mb-4">Appearance</h2>
        <div class="space-y-4">
          <div>
            <p class="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Theme</p>
            <div class="flex gap-3">
              <button
                @click="setTheme('light')"
                class="flex-1 rounded-xl px-4 py-3 text-sm font-medium transition-all"
                :class="isDark 
                  ? 'bg-slate-800/50 text-slate-300 hover:bg-slate-800' 
                  : 'bg-cyan-500/10 text-cyan-600 border border-cyan-500/30'"
              >
                Light Mode
              </button>
              <button
                @click="setTheme('dark')"
                class="flex-1 rounded-xl px-4 py-3 text-sm font-medium transition-all"
                :class="!isDark 
                  ? 'bg-slate-800/50 text-slate-300 hover:bg-slate-800' 
                  : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'"
              >
                Dark Mode
              </button>
            </div>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-2">
              Choose your preferred theme. System preference will be used if not set.
            </p>
          </div>
        </div>
      </div>

      <!-- School Settings -->
      <div class="premium-card p-6">
        <h2 class="text-title mb-4">School Information</h2>
        <div class="space-y-4">
          <div>
            <p class="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">School Name</p>
            <p class="text-sm text-slate-500 dark:text-slate-400">Capstone International School</p>
          </div>
          <div>
            <p class="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Currency</p>
            <p class="text-sm text-slate-500 dark:text-slate-400">₦ Naira (NGN)</p>
          </div>
        </div>
      </div>

      <!-- Notification Settings -->
      <div class="premium-card p-6">
        <h2 class="text-title mb-4">Notifications</h2>
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <span class="text-sm font-medium text-slate-700 dark:text-slate-300">Payment Reminders</span>
            <span class="text-sm text-emerald-600 dark:text-emerald-400">Enabled</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-sm font-medium text-slate-700 dark:text-slate-300">Collection Alerts</span>
            <span class="text-sm text-emerald-600 dark:text-emerald-400">Enabled</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>