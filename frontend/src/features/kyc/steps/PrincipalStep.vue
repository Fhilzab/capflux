<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { useFinancialActivationStore } from '@/stores/financialActivationStore';
import CmInput from '@/components/ui/CmInput.vue';
import CmCheckbox from '@/components/ui/CmCheckbox.vue';
import CmButton from '@/components/ui/CmButton.vue';
import CmAlert from '@/components/ui/CmAlert.vue';

const emit = defineEmits(['next-step', 'prev-step']);
const activationStore = useFinancialActivationStore();
const onboardingStore = useOnboardingStore();

const principalIsOwner = ref(true);
const sendingInvite = ref(false);
const alertError = ref('');
const alertSuccess = ref('');

const form = ref({
  principalName: '',
  principalEmail: '',
  principalPhone: '',
  principalRole: 'Principal',
});

const isFormValid = computed(() => {
  if (principalIsOwner.value) return true;
  return !!form.value.principalName && !!form.value.principalEmail;
});

onMounted(() => {
  // Prepopulate with owner info if available
  const ownerName = onboardingStore.personalInfo
    ? [onboardingStore.personalInfo.firstName, onboardingStore.personalInfo.middleName, onboardingStore.personalInfo.lastName]
        .filter(Boolean)
        .join(' ')
    : '';
  if (ownerName && !form.value.principalName) {
    form.value.principalName = ownerName;
  }
});

async function sendInvitation() {
  if (!form.value.principalEmail) return;
  sendingInvite.value = true;
  alertError.value = '';
  alertSuccess.value = '';

  try {
    await activationStore.invitePrincipal({
      email: form.value.principalEmail,
      name: form.value.principalName,
      role: form.value.principalRole,
    });
    alertSuccess.value = `Invitation sent to ${form.value.principalEmail}. They will receive an email to accept and join the school.`;
  } catch (e) {
    alertError.value = (e as Error)?.message || 'Failed to send invitation';
  } finally {
    sendingInvite.value = false;
  }
}

async function saveAndContinue() {
  alertError.value = '';
  alertSuccess.value = '';

  if (principalIsOwner.value) {
    emit('next-step');
    return;
  }

  if (!isFormValid.value) {
    alertError.value = 'Principal name and email are required.';
    return;
  }

  await sendInvitation();

  // Only proceed if invitation was sent successfully
  if (!alertError.value) {
    emit('next-step');
  }
}
</script>

<template>
  <section class="space-y-6">
    <div>
      <h2 class="text-2xl font-semibold text-text-primary">Principal Information</h2>
      <p class="text-sm text-text-muted mt-1">
        Specify the principal for this school. The principal receives login
        credentials and is associated with the school through the membership
        and RBAC architecture.
      </p>
    </div>

    <CmAlert v-if="alertError" variant="danger">{{ alertError }}</CmAlert>
    <CmAlert v-if="alertSuccess" variant="success">{{ alertSuccess }}</CmAlert>

    <CmCheckbox
      v-model="principalIsOwner"
      label="Principal is the same as the business owner"
      helper-text="Owner information will be reused for the principal role"
    />

    <transition name="fade">
      <div v-if="!principalIsOwner" class="space-y-4">
        <CmInput v-model="form.principalName" label="Principal Name" :required="true" />
        <CmInput v-model="form.principalEmail" label="Principal Email" type="email" helper-text="An invitation will be sent to this email address" :required="true" />
        <CmInput v-model="form.principalPhone" label="Principal Phone" type="tel" helper-text="Optional — for internal communication" />
        <CmInput v-model="form.principalRole" label="Principal Role" helper-text="Default: Principal" />
      </div>
    </transition>

    <div v-if="!principalIsOwner && form.principalEmail" class="rounded-card border border-border bg-surface p-4">
      <p class="text-sm text-text-secondary">
        When you click Save &amp; Continue, an invitation email will be sent to
        <strong>{{ form.principalEmail }}</strong>.
      </p>
    </div>

    <CmAlert v-if="principalIsOwner" variant="info">
      Principal will reuse the business owner information. No separate invitation is required.
    </CmAlert>

    <div class="flex justify-between pt-4 gap-4">
      <CmButton variant="ghost" @click="emit('prev-step')">Back</CmButton>
      <CmButton variant="primary" :loading="sendingInvite" :disabled="!isFormValid" @click="saveAndContinue">
        <span v-if="sendingInvite">Sending...</span>
        <span v-else>Save &amp; Continue</span>
      </CmButton>
    </div>
  </section>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active { transition: opacity 0.2s ease, transform 0.1s ease; }
.fade-enter-from,
.fade-leave-to { opacity: 0; transform: translateY(-0.25rem); }
</style>
