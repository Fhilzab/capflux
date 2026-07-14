<script setup lang="ts">
import { ref } from 'vue';
import { useOnboardingStore } from '../../stores/onboardingStore';

const onboardingStore = useOnboardingStore();

const businessForm = ref({
  proprietorBvn: '',
  proprietorNin: '',
  businessType: 'SOLE_PROPRIETOR',
  cacNumber: '',
  tin: '',
});

const settlementForm = ref({
  bank: '',
  accountNumber: '',
  accountName: '',
});

const verifyLoading = ref(false);
const verifyError = ref('');
const showSettlementForm = ref(false);

const businessTypes = [
  { value: 'SOLE_PROPRIETOR', label: 'Sole Proprietor' },
  { value: 'PARTNERSHIP', label: 'Partnership' },
  { value: 'LIMITED_COMPANY', label: 'Limited Company' },
];

const banks = [
  { value: 'ACCESS', label: 'Access Bank' },
  { value: 'GTBANK', label: 'Guaranty Trust Bank' },
  { value: 'ZENITH', label: 'Zenith Bank' },
  { value: 'FIRST_BANK', label: 'First Bank of Nigeria' },
  { value: 'UBA', label: 'United Bank for Africa' },
  { value: 'UNION_BANK', label: 'Union Bank' },
];

const verifyAccount = async () => {
  if (!settlementForm.value.bank || !settlementForm.value.accountNumber) return;
  
  verifyLoading.value = true;
  verifyError.value = '';
  
  // Mock verification - in production this would call backend
  if (settlementForm.value.accountNumber.length >= 10) {
    settlementForm.value.accountName = 'Verified Account Name';
    showSettlementForm.value = true;
  } else {
    verifyError.value = 'Invalid account number';
  }
  
  verifyLoading.value = false;
};

const handleSubmit = async () => {
  // Complete business verification
  await onboardingStore.completeBusinessVerification({
    proprietorBvn: businessForm.value.proprietorBvn,
    proprietorNin: businessForm.value.proprietorNin,
    businessType: businessForm.value.businessType,
    cacNumber: businessForm.value.cacNumber,
    tin: businessForm.value.tin,
  });
  
  // Complete settlement verification
  await onboardingStore.verifySettlementAccount({
    bank: settlementForm.value.bank,
    accountNumber: settlementForm.value.accountNumber,
    accountName: settlementForm.value.accountName,
  });
  
  await onboardingStore.completeStep('financial_setup');
  onboardingStore.setStage(3);
};
</script>

<template>
  <div class="premium-card p-8">
    <h2 class="text-headline mb-2">Financial Setup</h2>
    <p class="text-slate-500 mb-6">Verify your business and settlement account for compliance</p>

    <!-- Business Verification Section -->
    <div class="space-y-6 mb-8">
      <h3 class="text-title border-b border-slate-200 dark:border-slate-700 pb-2">Business Verification</h3>
      
      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Proprietor BVN
          </label>
          <input
            v-model="businessForm.proprietorBvn"
            type="text"
            placeholder="12345678901"
            maxlength="11"
            class="w-full rounded-xl px-4 py-3 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 focus-ring"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Proprietor NIN
          </label>
          <input
            v-model="businessForm.proprietorNin"
            type="text"
            placeholder="123456789012"
            maxlength="12"
            class="w-full rounded-xl px-4 py-3 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 focus-ring"
          />
        </div>
      </div>

      <div>
        <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          Business Type
        </label>
        <select
          v-model="businessForm.businessType"
          class="w-full rounded-xl px-4 py-3 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 focus-ring"
        >
          <option v-for="type in businessTypes" :key="type.value" :value="type.value">
            {{ type.label }}
          </option>
        </select>
      </div>

      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            CAC Number (Optional)
          </label>
          <input
            v-model="businessForm.cacNumber"
            type="text"
            placeholder="RC123456"
            class="w-full rounded-xl px-4 py-3 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 focus-ring"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Tax Identification Number (Optional)
          </label>
          <input
            v-model="businessForm.tin"
            type="text"
            placeholder="1234567890"
            class="w-full rounded-xl px-4 py-3 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 focus-ring"
          />
        </div>
      </div>
    </div>

    <!-- Settlement Account Section -->
    <div class="space-y-6 mb-8">
      <h3 class="text-title border-b border-slate-200 dark:border-slate-700 pb-2">Settlement Account</h3>
      
      <div class="grid gap-4 sm:grid-cols-3">
        <div class="sm:col-span-2">
          <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Bank
          </label>
          <select
            v-model="settlementForm.bank"
            class="w-full rounded-xl px-4 py-3 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 focus-ring"
          >
            <option value="">Select Bank</option>
            <option v-for="bank in banks" :key="bank.value" :value="bank.value">
              {{ bank.label }}
            </option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Account Number
          </label>
          <input
            v-model="settlementForm.accountNumber"
            type="text"
            placeholder="0123456789"
            maxlength="10"
            class="w-full rounded-xl px-4 py-3 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 focus-ring"
          />
        </div>
      </div>

      <button
        @click="verifyAccount"
        :disabled="verifyLoading || !settlementForm.bank || !settlementForm.accountNumber"
        class="rounded-xl px-4 py-2 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/20 transition-colors disabled:opacity-50 focus-ring"
      >
        {{ verifyLoading ? 'Verifying...' : 'Verify Account' }}
      </button>

      <p v-if="verifyError" class="text-sm text-rose-600">{{ verifyError }}</p>

      <div v-if="showSettlementForm && settlementForm.accountName" class="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
        <p class="text-sm font-medium text-emerald-600 dark:text-emerald-400">Account Verified</p>
        <p class="text-slate-900 dark:text-white">{{ settlementForm.accountName }}</p>
      </div>
    </div>

    <button
      @click="handleSubmit"
      :disabled="!showSettlementForm"
      class="w-full rounded-xl px-4 py-3 bg-cyan-500 text-slate-950 font-medium hover:bg-cyan-400 transition-colors disabled:opacity-50 focus-ring"
    >
      Continue to Activation
    </button>
  </div>
</template>