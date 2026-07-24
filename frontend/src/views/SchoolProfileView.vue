<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useSchoolStore } from '../stores/schoolStore';
import CmButton from '../components/ui/CmButton.vue';
import CmSelect from '../components/ui/CmSelect.vue';
import CmInput from '../components/ui/CmInput.vue';

const schoolStore = useSchoolStore();

const DEFAULT_SCHOOL_NAME = 'Capstone Demo School';

const settings = ref({
  currency: 'NGN',
  timezone: 'Africa/Lagos',
  invoice_prefix: 'CAP',
  term_technology_levy: 1000,
});
const loading = ref(true);
const saving = ref(false);
const message = ref('');

onMounted(async () => {
  await schoolStore.initialize();
  loading.value = false;
});

const school = ref(null);

const saveSettings = async () => {
  saving.value = true;
  message.value = '';
  try {
    // Placeholder: settings persistence belongs to a later milestone
    message.value = 'Settings saved locally.';
  } catch (err) {
    message.value = `Error saving settings: ${err instanceof Error ? err.message : String(err)}`;
  } finally {
    saving.value = false;
  }
};
</script>

<template>
  <main class="min-h-screen bg-background text-text-primary p-8">
    <div class="max-w-4xl mx-auto space-y-6">
      <section class="rounded-card bg-card p-8 shadow-card">
        <h1 class="text-headline mb-2">School Settings</h1>
        <p class="text-text-secondary">Manage school profile and application settings.</p>
      </section>

      <section v-if="loading" class="rounded-card bg-card p-8 shadow-card">
        <p class="text-text-muted">Loading school data...</p>
      </section>

      <template v-else>
        <section class="rounded-card bg-card p-8 shadow-card">
          <h2 class="text-title mb-4">School Information</h2>
          <div class="grid gap-4 sm:grid-cols-2">
            <div>
              <p class="text-sm text-text-muted">School name</p>
              <p class="mt-1 text-lg font-semibold">{{ schoolStore.currentSchool?.name || DEFAULT_SCHOOL_NAME }}</p>
            </div>
            <div>
              <p class="text-sm text-text-muted">School ID</p>
              <p class="mt-1 text-lg font-mono text-brand">{{ schoolStore.currentSchoolId || 'N/A' }}</p>
            </div>
            <div>
              <p class="text-sm text-text-muted">Subscription status</p>
              <span class="mt-1 inline-flex rounded-full bg-success/10 px-3 py-1 text-sm font-semibold text-success">
                {{ schoolStore.currentSchool?.status || 'ACTIVE' }}
              </span>
            </div>
            <div>
              <p class="text-sm text-text-muted">Registered since</p>
              <p class="mt-1 text-lg">{{ schoolStore.currentSchool?.createdAt ? new Date(schoolStore.currentSchool.createdAt).toLocaleDateString() : 'N/A' }}</p>
            </div>
          </div>
        </section>

        <section class="rounded-card bg-card p-8 shadow-card">
          <h2 class="text-title mb-4">Application Settings</h2>
          <p class="text-text-secondary mb-6">Configure billing defaults and locale preferences.</p>

          <div class="grid gap-6 sm:grid-cols-2">
            <label class="block">
              <span class="text-sm text-text-muted">Currency</span>
              <CmSelect
                v-model="settings.currency"
                :options="[
                  { value: 'NGN', label: 'NGN (₦) — Nigerian Naira' },
                  { value: 'GHS', label: 'GHS (₵) — Ghanaian Cedi' },
                  { value: 'KES', label: 'KES (KSh) — Kenyan Shilling' },
                  { value: 'ZAR', label: 'ZAR (R) — South African Rand' },
                  { value: 'UGX', label: 'UGX (USh) — Ugandan Shilling' },
                ]"
                class="mt-2"
              />
            </label>

            <label class="block">
              <span class="text-sm text-text-muted">Timezone</span>
              <CmSelect
                v-model="settings.timezone"
                :options="[
                  { value: 'Africa/Lagos', label: 'Africa/Lagos (WAT)' },
                  { value: 'Africa/Accra', label: 'Africa/Accra (GMT)' },
                  { value: 'Africa/Nairobi', label: 'Africa/Nairobi (EAT)' },
                  { value: 'Africa/Johannesburg', label: 'Africa/Johannesburg (SAST)' },
                  { value: 'Africa/Kampala', label: 'Africa/Kampala (EAT)' },
                ]"
                class="mt-2"
              />
            </label>

            <label class="block">
              <span class="text-sm text-text-muted">Invoice prefix</span>
              <CmInput
                v-model="settings.invoice_prefix"
                class="mt-2"
                maxlength="10"
              />
            </label>

            <div class="block">
              <span class="text-sm text-text-muted">Tech levy per term (₦)</span>
              <p class="mt-2 w-full rounded-input border border-border bg-surface px-4 py-3.5 text-text-secondary">
                {{ settings.term_technology_levy.toLocaleString() }}
              </p>
            </div>
          </div>

          <div class="mt-6 flex items-center gap-4">
            <CmButton @click="saveSettings" :disabled="saving">
              {{ saving ? 'Saving...' : 'Save settings' }}
            </CmButton>
            <p v-if="message" class="text-sm text-success">{{ message }}</p>
          </div>
        </section>
      </template>
    </div>
  </main>
</template>