<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useStaffFinancialStore } from '@/stores/staffFinancialStore';
import CmButton from '@/components/ui/CmButton.vue';
import CmAlert from '@/components/ui/CmAlert.vue';
import CmBadge from '@/components/ui/CmBadge.vue';
import CmInput from '@/components/ui/CmInput.vue';
import CmModal from '@/components/ui/CmModal.vue';

const route = useRoute();
const router = useRouter();
const store = useStaffFinancialStore();

const detail = computed(() => store.kycDetail as any);
const loading = computed(() => store.loading);
const error = computed(() => store.error);

const showRejectModal = ref(false);
const rejectReason = ref('');
const actionMessage = ref('');

function badgeVariant(status: string) {
  if (status === 'VERIFIED') return 'success';
  if (status === 'REJECTED') return 'danger';
  if (status === 'UNDER_REVIEW') return 'info';
  return 'muted';
}

async function handleVerify() {
  actionMessage.value = '';
  try {
    await store.verifyKyc(route.params.id as string);
    actionMessage.value = 'KYC verified. Identity + CAC checks passed.';
  } catch (e) {
    actionMessage.value = (e as Error).message || 'Verification failed';
  }
}

async function confirmReject() {
  if (!rejectReason.value || rejectReason.value.trim().length < 5) return;
  try {
    await store.rejectKyc(route.params.id as string, rejectReason.value.trim());
    showRejectModal.value = false;
    actionMessage.value = 'KYC rejected.';
  } catch (e) {
    actionMessage.value = (e as Error).message || 'Rejection failed';
  }
}

async function handleActivate() {
  actionMessage.value = '';
  try {
    const result = await store.activatePayments(detail.value?.school_id);
    actionMessage.value = result?.alreadyReady
      ? 'Payments were already active.'
      : 'Payments activated. School is READY.';
  } catch (e) {
    actionMessage.value = (e as Error).message || 'Activation failed';
  }
}

onMounted(() => {
  store.loadKycDetail(route.params.id as string);
});
</script>

<template>
  <main class="min-h-screen bg-background text-text-primary p-8">
    <div class="max-w-5xl mx-auto space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-3xl font-semibold">KYC Review Detail</h1>
          <p class="text-text-muted mt-1">School: {{ detail?.schools?.name || detail?.school_id }}</p>
        </div>
        <CmButton variant="ghost" @click="router.push({ name: 'StaffKycDashboard' })">Back</CmButton>
      </div>

      <CmAlert v-if="error" variant="danger">{{ error }}</CmAlert>
      <CmAlert v-if="actionMessage" :variant="actionMessage.includes('failed') || actionMessage.includes('reject') ? 'warning' : 'success'">
        {{ actionMessage }}
      </CmAlert>

      <template v-if="detail">
        <section class="rounded-card bg-card p-8 shadow-card">
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold">Overview</h2>
            <CmBadge :variant="badgeVariant(detail.status)" :label="detail.status" />
          </div>
          <div class="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 text-sm">
            <div><p class="text-text-muted">Principal</p><p class="font-medium">{{ detail.principal_name }}</p></div>
            <div><p class="text-text-muted">Phone</p><p class="font-medium">{{ detail.principal_phone }}</p></div>
            <div><p class="text-text-muted">Official Email</p><p class="font-medium">{{ detail.official_email || '-' }}</p></div>
            <div><p class="text-text-muted">CAC Number</p><p class="font-medium">{{ detail.cac_registration_number || '-' }}</p></div>
            <div><p class="text-text-muted">BVN</p><p class="font-medium">{{ detail.bvn_masked || '-' }}</p></div>
            <div><p class="text-text-muted">NIN</p><p class="font-medium">{{ detail.nin_masked || '-' }}</p></div>
            <div><p class="text-text-muted">Rejection Reason</p><p class="font-medium text-danger">{{ detail.rejection_reason || '-' }}</p></div>
          </div>
        </section>

        <section v-if="detail.verification_history?.length" class="rounded-card bg-card p-8 shadow-card">
          <h2 class="text-lg font-semibold">Identity Verification History</h2>
          <div class="mt-4 space-y-2 text-sm">
            <div v-for="v in detail.verification_history" :key="v.id" class="flex items-center gap-3 border-b border-divider pb-2">
              <CmBadge :variant="v.status === 'VERIFIED' ? 'success' : 'danger'" :label="v.status" size="sm" />
              <span class="font-medium">{{ v.verification_type }}</span>
              <span class="text-text-muted">Provider: {{ v.provider }}</span>
              <span class="text-text-muted text-xs">{{ v.provider_reference }}</span>
            </div>
          </div>
        </section>

        <section v-if="detail.settlement" class="rounded-card bg-card p-8 shadow-card">
          <h2 class="text-lg font-semibold">Settlement Account</h2>
          <div class="mt-4 grid gap-4 sm:grid-cols-2 text-sm">
            <div><p class="text-text-muted">Status</p><CmBadge :variant="detail.settlement.status === 'VERIFIED' ? 'success' : 'info'" :label="detail.settlement.status" size="sm" /></div>
            <div><p class="text-text-muted">Account</p><p class="font-medium">****{{ detail.settlement.account_number_last4 }}</p></div>
            <div v-if="detail.settlement.account_name"><p class="text-text-muted">Account Name</p><p class="font-medium">{{ detail.settlement.account_name }}</p></div>
            <div v-if="detail.settlement.rejection_reason"><p class="text-text-muted">Reason</p><p class="font-medium text-danger">{{ detail.settlement.rejection_reason }}</p></div>
          </div>
        </section>

        <section v-if="detail.cac_document?.signed_url" class="rounded-card bg-card p-8 shadow-card">
          <h2 class="text-lg font-semibold">CAC Document</h2>
          <a :href="detail.cac_document.signed_url" target="_blank" rel="noopener" class="mt-2 inline-flex text-brand hover:underline">
            View CAC Certificate (signed link, expires shortly)
          </a>
        </section>

        <section class="rounded-card bg-card p-8 shadow-card">
          <h2 class="text-lg font-semibold">Actions</h2>
          <div class="mt-4 flex flex-wrap gap-3">
            <CmButton
              v-if="detail.status === 'UNDER_REVIEW' || detail.status === 'REJECTED'"
              variant="success"
              :loading="loading"
              @click="handleVerify"
            >
              Verify KYC
            </CmButton>
            <CmButton v-if="detail.status !== 'VERIFIED'" variant="danger" @click="showRejectModal = true">
              Reject KYC
            </CmButton>
            <CmButton v-if="detail.school_id" variant="primary" :loading="loading" @click="handleActivate">
              Activate Payments
            </CmButton>
          </div>
          <p class="mt-3 text-xs text-text-muted">
            Verification runs identity (NIN/BVN) and CAC checks server-side.
            Activation only succeeds when the school is ACTIVE, KYC is
            VERIFIED, settlement is VERIFIED, and a gateway is assigned.
          </p>
        </section>
      </template>

      <!-- Reject modal -->
      <CmModal v-model="showRejectModal" title="Reject KYC" closable @close="showRejectModal = false">
        <p class="text-sm text-text-secondary mb-4">A rejection reason is required.</p>
        <CmInput
          v-model="rejectReason"
          label="Rejection Reason"
          :required="true"
          helper-text="Minimum 5 characters"
        />
        <div class="mt-6 flex justify-end gap-3">
          <CmButton variant="ghost" @click="showRejectModal = false">Cancel</CmButton>
          <CmButton variant="danger" :disabled="rejectReason.trim().length < 5" @click="confirmReject">
            Reject KYC
          </CmButton>
        </div>
      </CmModal>
    </div>
  </main>
</template>
