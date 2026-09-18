<script setup lang="ts">
import { computed, ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { GraduationCap } from '@lucide/vue';
import { useThemeStore } from '../stores/themeStore';
import { useAuthStore } from '../stores/authStore';
import { useSchoolStore } from '../stores/schoolStore';
import { usePermission } from '../shared/rbac/usePermission';
import { PERMISSIONS } from '../shared/rbac/permissions';
import CmStatusChip from '../components/ui/CmStatusChip.vue';

const router = useRouter();

const themeStore = useThemeStore();
const authStore = useAuthStore();
const schoolStore = useSchoolStore();
const { can } = usePermission();

const isDark = computed(() => themeStore.mode === 'dark');
const school = computed(() => schoolStore.school);
const schoolLoading = computed(() => schoolStore.loading && !schoolStore.initialized);

const canManageSettings = ref(false);
const canManageSchools = ref(false);

const schoolStatusChip = computed(() => {
  const status = school.value?.status ?? '';
  if (status === 'ACTIVE') return { status: 'success' as const, label: 'Active' };
  if (status === 'PENDING_SETUP') return { status: 'pending' as const, label: 'Pending setup' };
  if (status === 'SUSPENDED') return { status: 'warning' as const, label: 'Suspended' };
  if (status === 'ARCHIVED') return { status: 'error' as const, label: 'Archived' };
  return { status: 'neutral' as const, label: status || 'Unknown' };
});

const paymentStatusChip = computed(() => {
  const status = school.value?.paymentStatus ?? '';
  if (status === 'READY') return { status: 'success' as const, label: 'Ready' };
  if (status === 'PENDING_KYC' || status === 'UNDER_REVIEW') return { status: 'pending' as const, label: status };
  if (status === 'REJECTED' || status === 'SUSPENDED') return { status: 'error' as const, label: status };
  return { status: 'neutral' as const, label: status || 'Not ready' };
});

const setTheme = (mode: 'dark' | 'light') => {
  themeStore.setTheme(mode);
};

onMounted(async () => {
  if (authStore.isAuthenticated) {
    canManageSettings.value = await can(PERMISSIONS.SETTINGS.MANAGE);
    canManageSchools.value = await can(PERMISSIONS.SCHOOL.MANAGE);
  }
  if (!schoolStore.initialized) {
    await schoolStore.initialize();
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
      <div class="premium-card p-6">
        <div class="flex items-start justify-between gap-4">
          <div>
            <h2 class="text-title mb-1">Academic Structure</h2>
            <p class="text-sm text-text-secondary">
              Sessions, sections and academic levels. Levels drive student placement, movement and promotion.
            </p>
          </div>
          <GraduationCap class="h-5 w-5 shrink-0 text-brand" />
        </div>
        <button
          type="button"
          class="mt-4 inline-flex min-h-[44px] items-center rounded-button bg-surface px-4 py-2.5 text-sm font-medium text-text-secondary border border-border hover:bg-surface/80 focus-ring transition-colors"
          @click="router.push({ name: 'AcademicStructure' })"
        >
          Manage academic structure
        </button>
      </div>

      <div class="premium-card p-6">
        <h2 class="text-title mb-4">Appearance</h2>
        <div class="space-y-4">
          <div>
            <p class="text-sm font-medium text-text-primary mb-2">Theme</p>
            <div class="flex gap-3">
              <button
                @click="setTheme('light')"
                :class="isDark
                  ? 'bg-surface text-text-secondary hover:bg-surface/80'
                  : 'bg-brand/10 text-brand border border-brand/20'"
                class="flex-1 rounded-button px-4 py-3 text-sm font-medium transition-all"
              >
                Light Mode
              </button>
              <button
                @click="setTheme('dark')"
                :class="!isDark
                  ? 'bg-surface text-text-secondary hover:bg-surface/80'
                  : 'bg-brand/10 text-brand border border-brand/20'"
                class="flex-1 rounded-button px-4 py-3 text-sm font-medium transition-all"
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

      <div v-if="canManageSchools" class="premium-card p-6">
        <h2 class="text-title mb-4">School Information</h2>
        <div v-if="schoolLoading" class="space-y-3">
          <div class="skeleton h-6 rounded-xl w-1/2"></div>
          <div class="skeleton h-6 rounded-xl w-2/3"></div>
        </div>
        <div v-else-if="school" class="space-y-4">
          <div>
            <p class="text-sm font-medium text-text-primary mb-1">School Name</p>
            <p class="text-sm text-text-secondary">{{ school.name }}</p>
          </div>
          <div v-if="school.schoolType" class="flex items-center gap-2">
            <p class="text-sm font-medium text-text-primary">School Type</p>
            <p class="text-sm text-text-secondary">{{ school.schoolType }}</p>
          </div>
          <div class="flex flex-wrap items-center gap-4">
            <div>
              <p class="text-sm font-medium text-text-primary mb-1">Operational status</p>
              <CmStatusChip v-bind="schoolStatusChip" size="sm" />
            </div>
            <div>
              <p class="text-sm font-medium text-text-primary mb-1">Payment status</p>
              <CmStatusChip v-bind="paymentStatusChip" size="sm" />
            </div>
          </div>
          <div v-if="school.address || school.state || school.lga || school.country">
            <p class="text-sm font-medium text-text-primary mb-1">Address</p>
            <p class="text-sm text-text-secondary">
              {{ [school.address, school.state, school.lga, school.country].filter(Boolean).join(', ') }}
            </p>
          </div>
          <div>
            <p class="text-sm font-medium text-text-primary mb-1">Currency</p>
            <p class="text-sm text-text-secondary">₦ Naira (NGN)</p>
          </div>
        </div>
        <p v-else class="text-sm text-text-muted">No school profile available for this account.</p>
      </div>
    </div>
  </div>
</template>