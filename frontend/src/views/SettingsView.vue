<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useThemeStore } from '../stores/themeStore';
import { useAuthStore } from '../stores/authStore';
import { AuthorizationService } from '../services/AuthorizationService';

const themeStore = useThemeStore();
const authStore = useAuthStore();
const authz = new AuthorizationService();

const isDark = computed(() => themeStore.mode === 'dark');
const isOwner = computed(() => authStore.isOwner);

const setTheme = (mode: 'dark' | 'light') => {
  themeStore.setTheme(mode);
};

// Admin management
const admins = ref([]);
const newAdminEmail = ref('');
const loading = ref(false);
const error = ref('');
const success = ref('');

onMounted(async () => {
  if (isOwner.value && authStore.schoolId) {
    await fetchAdmins();
  }
});

const fetchAdmins = async () => {
  loading.value = true;
  error.value = '';
  try {
    admins.value = await authz.getAdmins(authStore.schoolId);
  } catch (e: any) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
};

const inviteAdmin = async () => {
  if (!newAdminEmail.value || !authStore.schoolId) return;
  
  loading.value = true;
  error.value = '';
  success.value = '';
  
  try {
    await authz.inviteAdmin(authStore.schoolId, newAdminEmail.value);
    success.value = `Invitation sent to ${newAdminEmail.value}`;
    newAdminEmail.value = '';
    await fetchAdmins();
  } catch (e: any) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
};

const suspendAdmin = async (adminId: string) => {
  if (!authStore.schoolId) return;
  
  loading.value = true;
  error.value = '';
  
  try {
    await authz.suspendAdmin(authStore.schoolId, adminId);
    await fetchAdmins();
  } catch (e: any) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
};

const reactivateAdmin = async (adminId: string) => {
  if (!authStore.schoolId) return;
  
  loading.value = true;
  error.value = '';
  
  try {
    await authz.reactivateAdmin(authStore.schoolId, adminId);
    await fetchAdmins();
  } catch (e: any) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
};

const removeAdmin = async (adminId: string) => {
  if (!authStore.schoolId) return;
  
  if (!confirm('Are you sure you want to remove this admin?')) return;
  
  loading.value = true;
  error.value = '';
  
  try {
    await authz.removeAdmin(authStore.schoolId, adminId);
    await fetchAdmins();
  } catch (e: any) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
};

const transferOwnership = async (adminId: string) => {
  if (!authStore.schoolId) return;
  
  if (!confirm('Are you sure you want to transfer ownership to this admin? You will become an admin afterward.')) return;
  
  loading.value = true;
  error.value = '';
  
  try {
    await authz.transferOwnership(authStore.schoolId, adminId);
    await fetchAdmins();
  } catch (e: any) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
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

      <!-- Administration (Owner Only) -->
      <div v-if="isOwner" class="premium-card p-6">
        <h2 class="text-title mb-4">Administration</h2>
        
        <!-- Invite Admin -->
        <div class="space-y-4">
          <div>
            <p class="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Invite New Admin</p>
            <div class="flex gap-2">
              <input
                v-model="newAdminEmail"
                type="email"
                placeholder="admin@school.edu.ng"
                class="flex-1 rounded-xl px-3 py-2 text-sm bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 focus-ring"
              />
              <button
                @click="inviteAdmin"
                :disabled="loading || !newAdminEmail"
                class="rounded-xl px-4 py-2 text-sm font-medium bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/20 transition-colors disabled:opacity-50"
              >
                Invite
              </button>
            </div>
            <p v-if="error" class="text-xs text-rose-600 dark:text-rose-400 mt-2">{{ error }}</p>
            <p v-if="success" class="text-xs text-emerald-600 dark:text-emerald-400 mt-2">{{ success }}</p>
          </div>

          <!-- Admins List -->
          <div>
            <p class="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Current Admins</p>
            <div v-if="loading && admins.length === 0" class="text-sm text-slate-500">Loading...</div>
            <div v-else class="space-y-2">
              <div v-for="admin in admins" :key="admin.id" class="flex items-center justify-between rounded-xl bg-slate-100/50 dark:bg-slate-800/50 p-3">
                <div>
                  <p class="font-medium text-slate-900 dark:text-white">{{ admin.email }}</p>
                  <p class="text-xs text-slate-500 dark:text-slate-400">{{ admin.full_name || admin.id }}</p>
                </div>
                <div class="flex items-center gap-2">
                  <span class="text-xs px-2 py-1 rounded" :class="admin.admin_status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'">
                    {{ admin.admin_status }}
                  </span>
                  <button
                    v-if="admin.admin_status === 'ACTIVE'"
                    @click="suspendAdmin(admin.id)"
                    class="text-xs px-2 py-1 rounded bg-amber-500/10 text-amber-600 hover:bg-amber-500/20"
                    :disabled="loading"
                  >
                    Suspend
                  </button>
                  <button
                    v-else
                    @click="reactivateAdmin(admin.id)"
                    class="text-xs px-2 py-1 rounded bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20"
                    :disabled="loading"
                  >
                    Reactivate
                  </button>
                  <button
                    @click="transferOwnership(admin.id)"
                    class="text-xs px-2 py-1 rounded bg-purple-500/10 text-purple-600 hover:bg-purple-500/20"
                    :disabled="loading"
                  >
                    Make Owner
                  </button>
                  <button
                    @click="removeAdmin(admin.id)"
                    class="text-xs px-2 py-1 rounded bg-rose-500/10 text-rose-600 hover:bg-rose-500/20"
                    :disabled="loading"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
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