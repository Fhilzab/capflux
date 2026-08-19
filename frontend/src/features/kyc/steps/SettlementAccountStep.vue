<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useFinancialActivationStore } from '@/stores/financialActivationStore';
import CmInput from '@/components/ui/CmInput.vue';
import CmSelect from '@/components/ui/CmSelect.vue';
import CmButton from '@/components/ui/CmButton.vue';
import CmAlert from '@/components/ui/CmAlert.vue';
import CmBadge from '@/components/ui/CmBadge.vue';

const activationStore = useFinancialActivationStore();

const form = ref({
  bankCode: '',
  accountNumber: '',
  bvn: '',
});

const submitting = ref(false);
const alertError = ref('');
const alertSuccess = ref('');

const bankOptions = [
  { value: '000001', label: 'Access Bank' },
  { value: '000002', label: 'Guaranty Trust Bank' },
  { value: '000003', label: 'First Bank of Nigeria' },
  { value: '000005', label: 'Zenith Bank' },
  { value: '000007', label: 'First City Monument Bank' },
  { value: '000011', label: 'United Bank for Africa' },
  { value: '000012', label: 'United Commercial Bank' },
  { value: '000015', label: 'Wema Bank' },
  { value: '000017', label: 'Fidelity Bank' },
  { value: '000018', label: 'Stanbic IBTC' },
  { value: '000019', label: 'Polaris Bank' },
  { value: '000021', label: 'Ecobank Nigeria' },
  { value: '000022', label: 'Heritage Bank' },
  { value: '000024', label: 'Keystone Bank' },
  { value: '000027', label: 'Transnational Incorporated' },
  { value: '000030', label: 'African International Bank' },
  { value: '000032', label: 'Premium Bank' },
  { value: '000034', label: 'Providus Bank' },
  { value: '000035', label: 'Titan Trust Bank' },
  { value: '000037', label: 'Renault Bank' },
  { value: '000038', label: 'Taj Bank' },
  { value: '000040', label: 'Unity Bank' },
];

// Deduplicate by value and label
const bankOptionsList = computed(() => bankOptions);

const accountNumberError = computed(() => {
  if (!form.value.accountNumber) return '';
  if (form.value.accountNumber.length !== 10) return 'Account number must be 10 digits';
  if (!/^\d+$/.test(form.value.accountNumber)) return 'Only digits are allowed';
  return '';
});

const bvnError = computed(() => {
  if (!form.value.bvn) return '';
  if (form.value.bvn.length !== 11) return 'BVN must be exactly 11 digits';
  if (!/^\d+$/.test(form.value.bvn)) return 'Only digits are allowed';
  return '';
});

const isFormValid = computed(() => {
  return (
    !!form.value.bankCode &&
    !!form.value.accountNumber &&
    form.value.accountNumber.length === 10 &&
    /^\d+$/.test(form.value.accountNumber) &&
    !!form.value.bvn &&
    form.value.bvn.length === 11 &&
    /^\d+$/.test(form.value.bvn)
  );
});

// Settlement read-only status
const settlement = computed(() => activationStore.settlement);
const ownershipStatus = computed(() => settlement.value?.ownership_match_status || null);
const accountVerified = computed(() => settlement.value?.status === 'VERIFIED');

const ownershipVariant = computed(() => {
  if (ownershipStatus.value === 'OWNERSHIP_MATCH') return 'success';
  if (ownershipStatus.value === 'NAME_MISMATCH') return 'danger';
  if (ownershipStatus.value === 'NAME_NOT_VERIFIED') return 'warning';
  if (ownershipStatus.value === 'PENDING') return 'info';
  return 'info';
});

function maskValue(value: string | null | undefined, visible = 4): string {
  if (!value) return '—';
  if (value.length <= visible) return '*'.repeat(value.length);
  return '*'.repeat(value.length - visible) + value.slice(-visible);
}

async function saveAndContinue() {
  if (!isFormValid.value) return;

  alertError.value = '';
  alertSuccess.value = '';
  submitting.value = true;

  try {
    await activationStore.submitSettlement({
      bankCode: form.value.bankCode,
      accountNumber: form.value.accountNumber,
      bvn: form.value.bvn,
    });
    alertSuccess.value = 'Settlement account submitted. Verification is in progress.';
  } catch (e) {
    alertError.value = (e as Error)?.message || 'Failed to submit settlement account';
  } finally {
    submitting.value = false;
  }
}

onMounted(() => {
  activationStore.loadSettlementStatus();
});
</script>

<template>
  <section class="rounded-card bg-card p-8 shadow-card space-y-6">
    <h2 class="text-xl font-semibold text-text-primary">Settlement Account</h2>
    <p class="text-sm text-text-muted">
      Enter your settlement bank details and BVN. Account-name enquiry and BVN
      ownership verification are evaluated as separate provider capabilities.
      Only masked information is displayed.
    </p>

    <CmAlert v-if="alertError" variant="danger">{{ alertError }}</CmAlert>
    <CmAlert v-if="alertSuccess" variant="success">{{ alertSuccess }}</CmAlert>

    <!-- Read-only settlement status (if already submitted) -->
    <div v-if="settlement && settlement.status !== 'NEW'" class="space-y-3">
      <div class="grid gap-3 sm:grid-cols-2">
        <div class="rounded-card border border-divider bg-surface p-4">
          <p class="text-xs uppercase tracking-wider text-text-muted">Account</p>
          <p class="text-sm font-mono text-text-secondary">{{ maskValue(settlement.account_number_last4, 4) }}</p>
        </div>
        <div class="rounded-card border border-divider bg-surface p-4">
          <p class="text-xs uppercase tracking-wider text-text-muted">BVN</p>
          <p class="text-sm font-mono text-text-secondary">{{ maskValue(settlement.bvn_last4, 4) }}</p>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <CmBadge :variant="ownershipStatus === 'OWNERSHIP_MATCH' ? 'success' : 'warning'" :label="ownershipStatus || 'Pending'" />
        <span class="text-xs text-text-secondary">
          {{ ownershipStatus === 'OWNERSHIP_MATCH' ? 'Account ownership verified' : 'Ownership pending verification' }}
        </span>
      </div>
    </div>

    <div v-else class="space-y-4">
      <CmSelect
        v-model="form.bankCode"
        label="Bank"
        :options="bankOptionsList"
        placeholder="Select your bank"
        required
      />
      <CmInput
        v-model="form.accountNumber"
        label="Account Number"
        type="text"
        maxlength="10"
        :error="accountNumberError"
        helper-text="10-digit account number"
        required
      />
      <CmInput
        v-model="form.bvn"
        label="BVN"
        type="text"
        maxlength="11"
        :error="bvnError"
        helper-text="11-digit Bank Verification Number"
        required
      />

      <CmAlert variant="info" title="Important">
        Your BVN is encrypted at the application layer. The backend evaluates
        account ownership using provider-returned evidence only.
        BVN and account-number enquiry are separate provider capabilities — the
        system will not assume the settlement provider can verify BVN.
      </CmAlert>
    </div>

    <div class="flex justify-between pt-4 gap-4">
      <CmButton variant="ghost" @click="$emit('prev-step')">Back</CmButton>
      <CmButton variant="primary" :loading="submitting" :disabled="!accountVerified && !isFormValid" @click="saveAndContinue">
        <span v-if="submitting">Submitting...</span>
        <span v-else>{{ accountVerified ? 'View Settlement' : 'Submit & Continue' }}</span>
      </CmButton>
    </div>
  </section>
</template>
