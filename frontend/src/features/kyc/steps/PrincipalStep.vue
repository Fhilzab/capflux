<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { useFinancialActivationStore } from '@/stores/financialActivationStore';
import CmInput from '@/components/ui/CmInput.vue';
import CmCheckbox from '@/components/ui/CmCheckbox.vue';
import CmButton from '@/components/ui/CmButton.vue';
import CmAlert from '@/components/ui/CmAlert.vue';

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

const ownerInfo = computed(() => ({
  name: onboardingStore.status?.organization?.name || '',
}));

const showForm = computed(() => !principalIsOwner.value);

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

const isFormValid = computed(() => {
  if (principalIsOwner.value) return true;
  return !!form.value.principalName && !!form.value.principalEmail;
});

onMounted(() => {
  if (ownerInfo.value.name && !form.value.principalName) {
    form.value.principalName = ownerInfo.value.name;
  }
});

function saveAndContinue() {
  if (showForm.value && form.value.principalEmail) {
    sendInvitation().then(() => {
      // Proceed after invitation is sent (or if principal is same as owner)
      if (principalIsOwner.value || !alertError.value) {
        // Delay to let user see success message
        setTimeout(() => $emit('next-step'), 1000);
      }
    });
  } else {
    // Principal is same as owner, just proceed
    setTimeout(() => $emit('next-step'), 100);
  }
}
</script>

<template>
  <section class="rounded-card bg-card p-8 shadow-card space-y-6">
    <h2 class="text-xl font-semibold text-text-primary">Principal Information</h2>
    <p class="text-sm text-text-muted">
      Specify the principal for this school. The principal receives login
      credentials and is associated with the school through the existing
      membership and RBAC architecture.
    </p>

    <CmAlert v-if="alertError" variant="danger">{{ alertError }}</CmAlert>
    <CmAlert v-if="alertSuccess" variant="success">{{ alertSuccess }}</CmAlert>

    <CmCheckbox
      v-model="principalIsOwner"
      label="Principal is the same as the business owner"
      helper-text="Owner information will be reused for the principal role"
    />

    <transition name="fade">
      <div v-if="showForm" class="space-y-4">
        <CmInput v-model="form.principalName" label="Principal Full Name" required />
        <CmInput v-model="form.principalEmail" label="Principal Email" type="email" helper-text="An invitation will be sent to this email address" required />
        <CmInput v-model="form.principalPhone" label="Principal Phone" type="tel" helper-text="Optional — for internal communication" />
        <CmInput v-model="form.principalRole" label="Principal Role" helper-text="Default: Principal" />
      </div>
    </transition>

    <div v-if="showForm && form.principalEmail" class="rounded-card border border-divider bg-surface p-4">
      <p class="text-sm text-text-secondary">
        When you click Save & Continue, an invitation email will be sent to
        <strong>{{ form.principalEmail }}</strong>.
      </p>
    </div>

    <CmAlert v-if="principalIsOwner" variant="info">
      Principal will reuse the business owner information. No separate invitation is required.
    </CmAlert>

    <div class="flex justify-between pt-4 gap-4">
      <CmButton variant="ghost" @click="$emit('prev-step')">Back</CmButton>
      <CmButton variant="primary" :loading="sendingInvite" :disabled="!isFormValid" @click="saveAndContinue">
        <span v-if="sendingInvite">Sending...</span>
        <span v-else>Save & Continue</span>
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
