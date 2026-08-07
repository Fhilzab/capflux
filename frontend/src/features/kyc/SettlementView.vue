<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useFinancialActivationStore } from '@/stores/financialActivationStore';
import CmInput from '@/components/ui/CmInput.vue';
import CmButton from '@/components/ui/CmButton.vue';
import CmAlert from '@/components/ui/CmAlert.vue';
import CmBadge from '@/components/ui/CmBadge.vue';

const router = useRouter();
const activationStore = useFinancialActivationStore();

const form = ref({
  bankCode: '',
  accountNumber: '',
});

const submitting = ref(false);
const alertError = ref('');
const alertSuccess = ref('');

const settlement = computed(() => activationStore.settlementStatus?.settlement || null);
const gateway = computed(() => activationStore.settlementStatus?.gateway || null);
const kycVerified = computed(() => activationStore.kycVerified);

const accountError = computed(() =>
  form.value.accountNumber && !/^\d{10}$/.test(form.value.accountNumber)
    ? 'Account number must be exactly 10 digits'
    : ''
);
const bankError = computed(() =>
  form.value.bankCode && !/^\d{3,6}$/.test(form.value.bankCode)
    ? 'Invalid bank code'
    : ''
);

const statusLabel = computed(() => {
  const s = settlement.value?.status;
  if (s === 'VERIFIED') return 'Verified';
  if (s === 'REJECTED') return 'Action Required';
  if (s === 'PENDING_VERIFICATION') return 'Pending Verification';
  return 'Not Submitted';
});

async function handleSubmit() {
  if (!form.value.bankCode || !form.value.accountNumber) {
    alertError.value = 'Bank code and account number are required';
    return;
  }
  if (accountError.value || bankError.value) {
    alertError.value = 'Please correct the bank and account details';
    return;
  }
  alertError.value = '';
  submitting.value = true;
  try {
    await activationStore.submitSettlement(form.value.bankCode.trim(), form.value.accountNumber.trim());
    alertSuccess.value = 'Settlement account submitted for verification.';
    form.value.accountNumber = '';
  } catch (e) {
    alertError.value = (e as Error).message || 'Failed to submit settlement account';
  } finally {
    submitting.value = false;
  }
}

onMounted(async () => {
  await Promise.allSettled([activationStore.loadKycStatus(), activationStore.loadSettlementStatus()]);
});
</script>

<template>
  <main class="min-h-screen bg-background text-text-primary p-8">
    <div class="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 class="text-4xl font-semibold mb-2">Settlement Account</h1>
        <p class="text-text-muted">
          Provide the bank account CAPFLUX will settle school fee collections
          to. The account is verified against the registered school/owner.
        </p>
      </div>

      <CmAlert v-if="alertError" variant="error">{{ alertError }}</CmAlert>
      <CmAlert v-if="alertSuccess" variant="success">{{ alertSuccess }}</CmAlert>

      <CmAlert v-if="!kycVerified" variant="warning">
        KYC must be verified before submitting a settlement account.
      </CmAlert>

      <!-- Current settlement status -->
      <section class="rounded-card bg-card p-8 shadow-card">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold text-text-primary">Verification Status</h2>
          <CmBadge
            :variant="settlement?.status === 'VERIFIED' ? 'success' : settlement?.status === 'REJECTED' ? 'danger' : 'info'"
            :label="statusLabel"
          />
        </div>

        <div v-if="settlement" class="mt-4 grid gap-4 sm:grid-cols-2 text-sm">
          <div>
            <p class="text-text-muted">Bank Code</p>
            <p class="font-medium">{{ settlement.bankCode }}</p>
          </div>
          <div>
            <p class="text-text-muted">Account</p>
            <p class="font-medium">****{{ settlement.accountNumberLast4 }}</p>
          </div>
          <div v-if="settlement.accountName">
            <p class="text-text-muted">Account Name</p>
            <p class="font-medium">{{ settlement.accountName }}</p>
          </div>
          <div v-if="settlement.rejectionReason">
            <p class="text-text-muted">Reason</p>
            <p class="font-medium text-danger">{{ settlement.rejectionReason }}</p>
          </div>
        </div>
        <p v-else class="mt-4 text-sm text-text-muted">No settlement account submitted yet.</p>
      </section>

      <!-- Submit form (only when KYC verified and no active account) -->
      <section
        v-if="kycVerified && settlement?.status !== 'VERIFIED' && settlement?.status !== 'PENDING_VERIFICATION'"
        class="rounded-card bg-card p-8 shadow-card space-y-6"
      >
        <h2 class="text-lg font-semibold text-text-primary">Submit Settlement Account</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <CmInput v-model="form.bankCode" label="Bank Code" helper-text="e.g. 044 (Access Bank)" :error="bankError" required />
          <CmInput v-model="form.accountNumber" label="Account Number" type="text" :error="accountError" required helper-text="10 digits" />
        </div>
        <div class="flex justify-end pt-4">
          <CmButton variant="primary" :loading="submitting" @click="handleSubmit">
            Submit for Verification
          </CmButton>
        </div>
      </section>

      <!-- Gateway assignment (read-only, no credentials) -->
      <section v-if="gateway" class="rounded-card bg-card p-8 shadow-card">
        <h2 class="text-lg font-semibold text-text-primary">Payment Gateway</h2>
        <p class="mt-2 text-sm text-text-secondary">
          Gateway: <span class="font-medium">{{ gateway.provider.toUpperCase() }}</span>
          · Status: {{ gateway.status }} · Assigned by CAPFLUX
        </p>
        <p class="mt-1 text-xs text-text-muted">
          CAPFLUX assigns your payment gateway internally after verification.
        </p>
      </section>

      <div class="flex justify-end pt-2">
        <CmButton variant="ghost" @click="router.push({ name: 'KycDashboard' })">
          Back to Financial Activation
        </CmButton>
      </div>
    </div>
  </main>
</template>
