<script setup lang="ts">
import { computed, ref, onMounted } from 'vue';
import { useThemeStore } from '../stores/themeStore';
import { useAuthStore } from '../stores/authStore';
import { usePermission } from '../shared/rbac/usePermission';
import { PERMISSIONS } from '../shared/rbac/permissions';

const themeStore = useThemeStore();
const authStore = useAuthStore();
const { can } = usePermission();

const isDark = computed(() => themeStore.mode === 'dark');

const canManageSettings = ref(false);
const canManageSchools = ref(false);
const canSendNotifications = ref(false);

const setTheme = (mode: 'dark' | 'light') => {
  themeStore.setTheme(mode);
};

onMounted(async () => {
    if (authStore.isAuthenticated) {
      canManageSettings.value = await can(PERMISSIONS.SETTINGS.MANAGE);
      canManageSchools.value = await can(PERMISSIONS.SCHOOL.MANAGE);
      canSendNotifications.value = await can(PERMISSIONS.NOTIFICATION.SEND);
    }
});
</script>

<template>
  <div class="p-6 bg-background text-text-primary min-h-screen">
    <div class="mb-6">
      <h1 class="text-headline">Settings</h1>
      <p class="text-text-secondary">Manage your school's preferences</p>
    </div>

    <div class="max-w-2xl space-y-6">
      <!-- Appearance Settings -->
      <div class="premium-card p-6">
        <h2 class="text-title mb-4">Appearance</h2>
        <div class="space-y-4">
          <div>
            <p class="text-sm font-medium text-text-primary mb-2">Theme</p>
            <div class="flex gap-3">
              <button
                @click="setTheme('light')"
                class="flex-1 rounded-button px-4 py-3 text-sm font-medium transition-all"
                :class="isDark 
                  ? 'bg-surface text-text-secondary hover:bg-surface/80' 
                  : 'bg-brand/10 text-brand border border-brand/20'"
              >
                Light Mode
              </button>
              <button
                @click="setTheme('dark')"
                class="flex-1 rounded-button px-4 py-3 text-sm font-medium transition-all"
                :class="!isDark 
                  ? 'bg-surface text-text-secondary hover:bg-surface/80' 
                  : 'bg-brand/10 text-brand border border-brand/20'"
              >
                Dark Mode
              </button>
            </div>
            <p class="text-xs text-text-muted mt-2">
              Choose your preferred theme. System preference will be used if not set.
            </p>
          </div>
        </div>
      </div>

      <!-- School Settings -->
      <div v-if="canManageSchools" class="premium-card p-6">
        <h2 class="text-title mb-4">School Information</h2>
        <div class="space-y-4">
          <div>
            <p class="text-sm font-medium text-text-primary mb-2">School Name</p>
            <p class="text-sm text-text-secondary">CAPFLUX International School</p>
          </div>
          <div>
            <p class="text-sm font-medium text-text-primary mb-2">Currency</p>
            <p class="text-sm text-text-secondary">₦ Naira (NGN)</p>
          </div>
        </div>
      </div>

      <!-- Notification Settings -->
      <div v-if="canSendNotifications" class="premium-card p-6">
        <h2 class="text-title mb-4">Notifications</h2>
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <span class="text-sm font-medium text-text-primary">Payment Reminders</span>
            <span class="text-sm text-success">Enabled</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-sm font-medium text-text-primary">Collection Alerts</span>
            <span class="text-sm text-success">Enabled</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>