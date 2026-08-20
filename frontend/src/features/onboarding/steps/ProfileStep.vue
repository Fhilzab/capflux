<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { useAuthStore } from '@/stores/authStore';
import CmInput from '@/components/ui/CmInput.vue';
import CmSelect from '@/components/ui/CmSelect.vue';
import CmButton from '@/components/ui/CmButton.vue';
import CmAlert from '@/components/ui/CmAlert.vue';
import {
  getCountryOptions,
  getStatesForCountry,
  getLgasForState,
  hasStructuredStates,
  normalizeCountry,
  NIGERIAN_STATES,
} from '@/shared/kyc/geography';

const emit = defineEmits(['next-step', 'prev-step']);
const onboardingStore = useOnboardingStore();
const authStore = useAuthStore();

const STORAGE_KEY = 'capflux:kyc:personalInfoDraft';

const form = ref({
  firstName: '',
  middleName: '',
  lastName: '',
  phone: '',
  dateOfBirth: '',
  country: 'Nigeria',
  state: '',
  lga: '',
  residentialAddress: '',
});
const submitting = ref(false);

const userFullName = computed(() => {
  const u = authStore.user;
  return u?.user_metadata?.full_name || u?.user_metadata?.name || '';
});

const userPhone = computed(() => {
  const u = authStore.user;
  return u?.user_metadata?.phone || u?.phone || authStore.profile?.phone || '';
});

const userEmail = computed(() => {
  return authStore.user?.email || '';
});

// Surface structured errors from the store instead of a generic message
const alertError = computed(() => {
  const storeErr = onboardingStore.error;
  return storeErr || '';
});

// ── Dependent dropdown options ──────────────────────────────────────

const countryOptions = computed(() => getCountryOptions());

const stateOptions = computed(() => {
  return getStatesForCountry(form.value.country);
});

const lgaOptions = computed(() => {
  return getLgasForState(form.value.state);
});

// When the country is not Nigeria, state/LGA are free-text (no structured data).
const showStateSelect = computed(() => hasStructuredStates(form.value.country));
const showLgaSelect = computed(() => showStateSelect.value && !!form.value.state);

// ── Reactive dependent-field clearing ──────────────────────────────

// Changing Country → clear State and LGA (transparent to the user via UI labels).
watch(() => form.value.country, (newCountry, oldCountry) => {
  if (newCountry !== oldCountry) {
    // If the saved state belonged to a different country that also has structured
    // data, it would be invalid here. For Nigeria-only structured data:
    // switching away from Nigeria clears state/LGA; switching back restores
    // the last Nigeria selection from localStorage/backend (handled by onMounted).
    form.value.state = '';
    form.value.lga = '';
  }
});

// Changing State → clear LGA if it no longer belongs to the new state.
watch(() => form.value.state, (newState, oldState) => {
  if (newState !== oldState) {
    const validLgas = getLgasForState(newState);
    if (form.value.lga && !validLgas.some((l) => l.value === form.value.lga)) {
      form.value.lga = '';
    }
  }
});

// ── Local persistence (draft survives refresh before server save) ──

function saveLocalDraft() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(form.value));
  } catch {
    // localStorage may be unavailable (privacy mode, quota) — non-fatal.
  }
}

function restoreLocalDraft() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const draft = JSON.parse(raw) as typeof form.value;
      // Only restore if the draft is newer/more complete than defaults
      if (draft) {
        form.value = { ...form.value, ...draft };
      }
    }
  } catch {
    // Corrupt or unreadable draft — ignore.
  }
}

function clearLocalDraft() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

// Watch form changes and persist to localStorage for refresh-resilience
watch(
  () => form.value,
  () => saveLocalDraft(),
  { deep: true },
);

onMounted(async () => {
  // Load saved personal info from backend for resume after refresh
  await onboardingStore.loadProfile();

  // Prioritize saved personal info (from a resume) over auth metadata
  if (onboardingStore.personalInfo) {
    const pi = onboardingStore.personalInfo;
    form.value.firstName = pi.firstName;
    form.value.middleName = pi.middleName;
    form.value.lastName = pi.lastName;
    form.value.phone = pi.phone;
    form.value.dateOfBirth = pi.dateOfBirth;
    // Do not overwrite a saved country — it was already persisted
    if (pi.country) {
      form.value.country = normalizeCountry(pi.country) || 'Nigeria';
    }
    form.value.state = pi.state;
    form.value.lga = pi.lga;
    form.value.residentialAddress = pi.residentialAddress;
  } else {
    // No backend profile — restore from local draft (pre-save refresh)
    restoreLocalDraft();

    // If local draft didn't have a country, try auth metadata
    if (!form.value.firstName) {
      const meta = authStore.user?.user_metadata || {};
      if (meta.first_name && meta.last_name) {
        form.value.firstName = meta.first_name;
        form.value.lastName = meta.last_name;
      } else if (userFullName.value && !form.value.firstName) {
        const parts = userFullName.value.split(' ');
        form.value.firstName = parts[0] || '';
        form.value.lastName = parts[parts.length - 1] || '';
      }
    }
    if (!form.value.phone && userPhone.value) {
      form.value.phone = userPhone.value;
    }
  }

  // Validate that the restored state belongs to the restored country.
  // If the state is not in the current country's list, clear it.
  if (form.value.state && showStateSelect.value) {
    const validStates = NIGERIAN_STATES;
    const stateMatch = validStates.some((s) => s.value === form.value.state);
    if (!stateMatch) {
      form.value.state = '';
      form.value.lga = '';
    }
  } else if (!showStateSelect.value && form.value.state) {
    // Non-Nigeria country with a saved Nigerian state — that state is not valid
    // for this country. Keep the value (it may be a free-text state from another
    // country) only if the country is not Nigeria; otherwise clear.
    form.value.state = '';
    form.value.lga = '';
  }
});

const isFormValid = computed(() => {
  return !!form.value.firstName.trim() && !!form.value.lastName.trim() && !!form.value.phone.trim();
});

async function handleSubmit() {
  if (!isFormValid.value) {
    onboardingStore.clearError();
    return;
  }
  onboardingStore.clearError();
  submitting.value = true;
  try {
    await onboardingStore.saveProfile({
      firstName: form.value.firstName,
      middleName: form.value.middleName,
      lastName: form.value.lastName,
      phone: form.value.phone,
      dateOfBirth: form.value.dateOfBirth,
      country: form.value.country,
      state: form.value.state,
      lga: form.value.lga,
      residentialAddress: form.value.residentialAddress,
    });
    // Clear local draft after successful save — backend is now the source of truth
    clearLocalDraft();
    emit('next-step');
  } catch (e) {
    // Surface the actual error message (validation, auth, DB, or business-rule).
    // Form values are preserved so the user can retry without restarting.
    onboardingStore.error = (e as Error)?.message || 'Failed to save profile';
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <section class="space-y-6">
    <div>
      <h2 class="text-2xl font-semibold text-text-primary">Personal Information</h2>
      <p class="text-sm text-text-muted mt-1">
        Complete your personal details. Your email is read-only from your authenticated
        CAPFLUX account.
      </p>
    </div>

    <CmAlert v-if="alertError" variant="danger">{{ alertError }}</CmAlert>

    <!-- Read-only email -->
    <div class="rounded-card bg-surface p-4">
      <label class="block text-sm font-medium text-text-secondary">Email Address</label>
      <p class="mt-1.5 text-sm text-text-primary break-all">
        {{ userEmail || 'Not available' }}
      </p>
      <p class="mt-1 text-xs text-text-muted">
        This email is used for your CAPFLUX account authentication and cannot be changed here.
      </p>
    </div>

    <!-- Name fields: First / Middle / Last — NO Full Name -->
    <div class="grid gap-4 sm:grid-cols-2">
      <CmInput
        v-model="form.firstName"
        label="First Name"
        placeholder="e.g. Ade"
        :required="true"
        :error="alertError && !form.firstName.trim() ? 'Required' : undefined"
      />
      <CmInput
        v-model="form.middleName"
        label="Middle Name"
        placeholder="e.g. Babatunde"
        helper-text="If applicable"
      />
      <CmInput
        v-model="form.lastName"
        label="Last Name"
        placeholder="e.g. Johnson"
        :required="true"
        :error="alertError && !form.lastName.trim() ? 'Required' : undefined"
      />
      <CmInput
        v-model="form.phone"
        label="Phone Number"
        type="tel"
        placeholder="+234XXXXXXXXX"
        :required="true"
        helper-text="Used for school communications"
      />
    </div>

    <!-- Origin fields -->
    <div class="grid gap-4 sm:grid-cols-2">
      <CmInput
        v-model="form.dateOfBirth"
        label="Date of Birth"
        type="date"
        :required="true"
      />
      <CmSelect
        v-model="form.country"
        label="Country of Origin"
        :options="countryOptions"
        :required="true"
      />
      <CmSelect
        v-if="showStateSelect"
        v-model="form.state"
        label="State of Origin"
        :options="stateOptions"
        placeholder="Select a state"
        :required="true"
      />
      <CmInput
        v-else
        v-model="form.state"
        label="State of Origin"
        placeholder="Enter your state"
        :required="true"
      />
      <CmSelect
        v-if="showLgaSelect"
        v-model="form.lga"
        label="Local Government Area"
        :options="lgaOptions"
        placeholder="Select an LGA"
        :required="true"
      />
      <CmInput
        v-else
        v-model="form.lga"
        label="Local Government Area"
        placeholder="Enter your LGA"
        :required="true"
      />
    </div>

    <!-- Residential address -->
    <CmInput
      v-model="form.residentialAddress"
      label="Residential Address"
      placeholder="Full residential address"
      :required="true"
    />

    <div class="flex justify-between pt-4 gap-4">
      <CmButton variant="ghost" @click="emit('prev-step')">Back</CmButton>
      <CmButton variant="primary" :loading="submitting" :disabled="!isFormValid" @click="handleSubmit">
        Save &amp; Continue
      </CmButton>
    </div>
  </section>
</template>
