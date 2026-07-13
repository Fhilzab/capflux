<script setup>
import { ref, onMounted } from 'vue';
import { SchoolService } from '../services/SchoolService';

const DEFAULT_SCHOOL_ID = 'demo-school';
const DEFAULT_SCHOOL_NAME = 'Capstone Demo School';

const school = ref(null);
const settings = ref({
  currency: 'NGN',
  timezone: 'Africa/Lagos',
  invoice_prefix: 'CAP',
  term_technology_levy: 1000,
});
const loading = ref(true);
const saving = ref(false);
const message = ref('');

const loadSchoolData = async () => {
  loading.value = true;
  try {
    school.value = await SchoolService.getSchool(DEFAULT_SCHOOL_ID);
    if (!school.value) {
      // Seed default school if none exists
      await SchoolService.saveSchool({
        id: DEFAULT_SCHOOL_ID,
        name: DEFAULT_SCHOOL_NAME,
        subscription_status: 'ACTIVE',
        created_at: new Date().toISOString(),
      });
      school.value = await SchoolService.getSchool(DEFAULT_SCHOOL_ID);
    }

    const appSettings = await SchoolService.getAppSettings(DEFAULT_SCHOOL_ID);
    if (appSettings) {
      settings.value = {
        currency: appSettings.currency || 'NGN',
        timezone: appSettings.timezone || 'Africa/Lagos',
        invoice_prefix: appSettings.settings?.invoice_prefix || 'CAP',
        term_technology_levy: appSettings.settings?.term_technology_levy || 1000,
      };
    }
  } catch (err) {
    message.value = `Error loading school data: ${err instanceof Error ? err.message : String(err)}`;
  } finally {
    loading.value = false;
  }
};

const saveSettings = async () => {
  saving.value = true;
  message.value = '';
  try {
    await SchoolService.updateAppSettings(DEFAULT_SCHOOL_ID, {
      currency: settings.value.currency,
      timezone: settings.value.timezone,
      settings: {
        invoice_prefix: settings.value.invoice_prefix,
      },
    });
    message.value = 'Settings saved locally.';
  } catch (err) {
    message.value = `Error saving settings: ${err instanceof Error ? err.message : String(err)}`;
  } finally {
    saving.value = false;
  }
};

onMounted(loadSchoolData);
</script>

<template>
  <main class="min-h-screen bg-slate-950 text-white p-8">
    <div class="max-w-4xl mx-auto space-y-6">
      <section class="rounded-3xl bg-slate-900 p-8 shadow-xl">
        <h1 class="text-4xl font-semibold mb-2">School Settings</h1>
        <p class="text-slate-400">Manage school profile and application settings.</p>
      </section>

      <section v-if="loading" class="rounded-3xl bg-slate-900 p-8 shadow-xl">
        <p class="text-slate-400">Loading school data...</p>
      </section>

      <template v-else>
        <!-- School info -->
        <section class="rounded-3xl bg-slate-900 p-8 shadow-xl">
          <h2 class="text-2xl font-semibold mb-4">School Information</h2>
          <div class="grid gap-4 sm:grid-cols-2">
            <div>
              <p class="text-sm text-slate-400">School name</p>
              <p class="mt-1 text-lg font-semibold">{{ school?.name || DEFAULT_SCHOOL_NAME }}</p>
            </div>
            <div>
              <p class="text-sm text-slate-400">School ID</p>
              <p class="mt-1 text-lg font-mono text-cyan-400">{{ DEFAULT_SCHOOL_ID }}</p>
            </div>
            <div>
              <p class="text-sm text-slate-400">Subscription status</p>
              <span class="mt-1 inline-flex rounded-full bg-emerald-500/10 px-3 py-1 text-sm font-semibold text-emerald-400">
                {{ school?.subscription_status || 'ACTIVE' }}
              </span>
            </div>
            <div>
              <p class="text-sm text-slate-400">Registered since</p>
              <p class="mt-1 text-lg">{{ school?.created_at ? new Date(school.created_at).toLocaleDateString() : 'N/A' }}</p>
            </div>
          </div>
        </section>

        <!-- App settings form -->
        <section class="rounded-3xl bg-slate-900 p-8 shadow-xl">
          <h2 class="text-2xl font-semibold mb-4">Application Settings</h2>
          <p class="text-slate-400 mb-6">Configure billing defaults and locale preferences.</p>

          <div class="grid gap-6 sm:grid-cols-2">
            <label class="block">
              <span class="text-sm text-slate-400">Currency</span>
              <select
                v-model="settings.currency"
                class="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white"
              >
                <option value="NGN">NGN (₦) — Nigerian Naira</option>
                <option value="GHS">GHS (₵) — Ghanaian Cedi</option>
                <option value="KES">KES (KSh) — Kenyan Shilling</option>
                <option value="ZAR">ZAR (R) — South African Rand</option>
                <option value="UGX">UGX (USh) — Ugandan Shilling</option>
              </select>
            </label>

            <label class="block">
              <span class="text-sm text-slate-400">Timezone</span>
              <select
                v-model="settings.timezone"
                class="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white"
              >
                <option value="Africa/Lagos">Africa/Lagos (WAT)</option>
                <option value="Africa/Accra">Africa/Accra (GMT)</option>
                <option value="Africa/Nairobi">Africa/Nairobi (EAT)</option>
                <option value="Africa/Johannesburg">Africa/Johannesburg (SAST)</option>
                <option value="Africa/Kampala">Africa/Kampala (EAT)</option>
              </select>
            </label>

            <label class="block">
              <span class="text-sm text-slate-400">Invoice prefix</span>
              <input
                v-model="settings.invoice_prefix"
                class="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white"
                maxlength="10"
              />
            </label>

            <div class="block">
              <span class="text-sm text-slate-400">Tech levy per term (₦)</span>
              <p class="mt-2 w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-slate-300">
                {{ settings.term_technology_levy.toLocaleString() }}
              </p>
            </div>
          </div>

          <div class="mt-6 flex items-center gap-4">
            <button
              @click="saveSettings"
              :disabled="saving"
              class="rounded-2xl bg-cyan-500 px-6 py-3 font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-50"
            >
              {{ saving ? 'Saving...' : 'Save settings' }}
            </button>
            <p v-if="message" class="text-sm text-emerald-400">{{ message }}</p>
          </div>
        </section>
      </template>
    </div>
  </main>
</template>