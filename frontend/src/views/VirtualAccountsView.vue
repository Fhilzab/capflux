<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { usePaymentsStore } from '@/stores/paymentsStore';
import { useModuleLock } from '@/composables/useModuleLock';
import ModuleLockOverlay from '@/features/onboarding/ModuleLockOverlay.vue';
import CmAlert from '@/components/ui/CmAlert.vue';
import CmButton from '@/components/ui/CmButton.vue';
import CmStatusChip from '@/components/ui/CmStatusChip.vue';

const store = usePaymentsStore();
const { paymentsLocked, requiresSetup, requiresKyc, requiresSettlement, loading: lockLoading } = useModuleLock();

const accounts = computed(() => store.dvAccounts);
const loading = computed(() => store.loading);
const error = computed(() => store.error);

function statusChip(status: string) {
  switch (status) {
    case 'ACTIVE': return { status: 'success' as const, label: 'Active' };
    case 'PENDING':
    case 'PROVISIONING': return { status: 'pending' as const, label: status };
    case 'FAILED': return { status: 'error' as const, label: 'Failed' };
    case 'DISABLED': return { status: 'warning' as const, label: 'Disabled' };
    default: return { status: 'neutral' as const, label: status };
  }
}

async function provision(studentId: string) {
  try {
    await store.provisionDVA(studentId);
  } catch (e) {
    // error surfaced via store.error
  }
}

onMounted(() => {
  store.loadDVAccounts();
});
</script>

<template>
  <div class="p-6">
    <ModuleLockOverlay v-if="requiresSetup && !lockLoading" variant="setup" />
    <ModuleLockOverlay v-else-if="requiresKyc && !lockLoading" variant="kyc" />
    <ModuleLockOverlay v-else-if="requiresSettlement && !lockLoading" variant="settlement" />
    <ModuleLockOverlay v-else-if="paymentsLocked && !lockLoading" variant="payment" />
    <template v-else>
      <div class="mb-6">
        <h1 class="text-headline">Virtual Accounts</h1>
        <p class="text-slate-500">Student dedicated virtual accounts (DVA), provisioned by CAPFLUX.</p>
      </div>

      <CmAlert v-if="error" variant="danger">{{ error }}</CmAlert>

      <div class="rounded-card bg-card shadow-card overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead>
            <tr class="border-b border-divider text-text-muted">
              <th class="py-3 px-6">Student</th>
              <th class="py-3 px-6">Account</th>
              <th class="py-3 px-6">Bank</th>
              <th class="py-3 px-6">Status</th>
              <th class="py-3 px-6">Action</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="a in accounts" :key="a.id" class="border-b border-divider">
              <td class="py-3 px-6">{{ a.students?.first_name }} {{ a.students?.last_name }}</td>
              <td class="py-3 px-6">
                <span v-if="a.virtual_account_number_last4" class="font-mono text-xs">
                  •••• {{ a.virtual_account_number_last4 }}
                </span>
                <span v-else class="text-text-muted text-xs">—</span>
              </td>
              <td class="py-3 px-6">{{ a.bank_name || '-' }}</td>
              <td class="py-3 px-6">
                <CmStatusChip v-bind="statusChip(a.status)" size="sm" />
              </td>
              <td class="py-3 px-6">
                <CmButton
                  v-if="a.status === 'ACTIVE'"
                  variant="secondary"
                  size="sm"
                  @click="store.deactivateDVA(a.id)"
                >
                  Disable
                </CmButton>
              </td>
            </tr>
            <tr v-if="accounts.length === 0 && !loading">
              <td colspan="5" class="py-8 text-center text-text-muted">
                No virtual accounts yet. Provision DVAs from a student's profile.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>
