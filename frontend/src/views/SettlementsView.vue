<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { usePaymentsStore } from '@/stores/paymentsStore';
import { useModuleLock } from '@/composables/useModuleLock';
import ModuleLockOverlay from '@/features/onboarding/ModuleLockOverlay.vue';
import CmAlert from '@/components/ui/CmAlert.vue';
import CmStatusChip from '@/components/ui/CmStatusChip.vue';
import SkeletonLoader from '@/components/ui/SkeletonLoader.vue';

const store = usePaymentsStore();
const { showLock, lockReason, canAccessFinancials } = useModuleLock();

const settlements = computed(() => store.settlements);
const reconciliation = computed(() => store.reconciliation);
const loading = computed(() => store.loading);
const error = computed(() => store.error);

const fmtNaira = (minor: number) => `₦${(minor / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;

const toMinor = (row: Record<string, unknown>): number => {
  if (typeof row.amount_minor === 'number' && Number.isFinite(row.amount_minor)) return Math.trunc(row.amount_minor);
  const amount = Number(row.amount ?? 0);
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
};

const rowReference = (row: Record<string, unknown>): string => {
  const txn = row.payment_transactions as Record<string, unknown> | undefined;
  if (txn?.reference) return String(txn.reference);
  if (row.payment_transaction_id) return String(row.payment_transaction_id);
  return String(row.reference ?? '-');
};

const rowAccount = (row: Record<string, unknown>): string => {
  const last4 = row.account_number_last4 ?? row.account_number;
  if (typeof last4 === 'string' && last4.length >= 4) {
    const tail = last4.replace(/\D/g, '').slice(-4) || last4.slice(-4);
    return `•••• ${tail}`;
  }
  return '—';
};

const rowStatusChip = (row: Record<string, unknown>) => {
  const status = String(row.status ?? (row.source === 'SERVER' ? 'SETTLED' : 'PENDING')).toUpperCase();
  if (status === 'SETTLED' || status === 'SUCCESS') return { status: 'success' as const, label: 'Settled' };
  if (status === 'PENDING') return { status: 'pending' as const, label: 'Pending' };
  if (status === 'FAILED') return { status: 'error' as const, label: 'Failed' };
  return { status: 'neutral' as const, label: status };
};

const rowDate = (row: Record<string, unknown>): string => {
  const raw = (row.settled_at ?? row.updated_at ?? row.created_at) as string | undefined;
  if (!raw) return '-';
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString();
};

function statusChip(status: string) {
  switch (status) {
    case 'SUCCESS': return { status: 'success' as const, label: 'Settled' };
    case 'PENDING': return { status: 'pending' as const, label: 'Pending' };
    case 'FAILED': return { status: 'error' as const, label: 'Failed' };
    case 'OPEN': return { status: 'warning' as const, label: 'Open' };
    case 'RESOLVED': return { status: 'success' as const, label: 'Resolved' };
    default: return { status: 'neutral' as const, label: status };
  }
}

onMounted(() => {
  store.loadSettlements();
  store.loadSettlementSummary();
  store.loadReconciliation();
});
</script>

<template>
  <div class="p-6">
    <ModuleLockOverlay v-if="showLock" :variant="lockReason ?? 'setup'" />
    <template v-else-if="canAccessFinancials">
      <div class="mb-6">
        <h1 class="text-headline">Settlements &amp; Reconciliation</h1>
        <p class="text-slate-500">Settlement and reconciliation status, tracked by CAPFLUX.</p>
      </div>

      <CmAlert v-if="error" variant="danger">{{ error }}</CmAlert>

      <div v-if="loading && settlements.length === 0" class="space-y-6">
        <div class="grid gap-4 sm:grid-cols-3">
          <SkeletonLoader type="metric" :count="3" />
        </div>
        <SkeletonLoader type="table" :count="5" />
      </div>

      <template v-else>
        <!-- Settlement summary -->
        <div class="grid gap-4 sm:grid-cols-3 mb-6">
          <div class="rounded-card bg-card p-6 shadow-card">
            <p class="text-sm text-text-muted">Settled</p>
            <p class="text-2xl font-semibold text-success">{{ fmtNaira(store.settlementSummary?.settled_minor || 0) }}</p>
          </div>
          <div class="rounded-card bg-card p-6 shadow-card">
            <p class="text-sm text-text-muted">Pending Settlements</p>
            <p class="text-2xl font-semibold text-warning">{{ store.settlementSummary?.pending || 0 }}</p>
          </div>
          <div class="rounded-card bg-card p-6 shadow-card">
            <p class="text-sm text-text-muted">Failed</p>
            <p class="text-2xl font-semibold text-danger">{{ store.settlementSummary?.failed || 0 }}</p>
          </div>
        </div>

        <!-- Settlement history -->
        <div class="rounded-card bg-card shadow-card overflow-x-auto mb-6">
          <h2 class="text-title p-6 border-b border-divider">Settlement History</h2>
          <table class="w-full text-left text-sm">
            <thead>
              <tr class="border-b border-divider text-text-muted">
                <th class="py-3 px-6">Reference</th>
                <th class="py-3 px-6">Amount</th>
                <th class="py-3 px-6">Account</th>
                <th class="py-3 px-6">Status</th>
                <th class="py-3 px-6">Date</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="s in settlements" :key="s.id" class="border-b border-divider">
                <td class="py-3 px-6 font-mono text-xs">{{ rowReference(s) }}</td>
                <td class="py-3 px-6 font-medium">{{ fmtNaira(toMinor(s)) }}</td>
                <td class="py-3 px-6 font-mono text-xs">{{ rowAccount(s) }}</td>
                <td class="py-3 px-6"><CmStatusChip v-bind="rowStatusChip(s)" size="sm" /></td>
                <td class="py-3 px-6 text-text-muted">{{ rowDate(s) }}</td>
              </tr>
              <tr v-if="settlements.length === 0">
                <td colspan="5" class="py-8 text-center text-text-muted">No settlements yet.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Reconciliation issues -->
        <div class="rounded-card bg-card shadow-card overflow-x-auto">
          <h2 class="text-title p-6 border-b border-divider">Reconciliation Issues</h2>
          <table class="w-full text-left text-sm">
            <thead>
              <tr class="border-b border-divider text-text-muted">
                <th class="py-3 px-6">Type</th>
                <th class="py-3 px-6">Reference</th>
                <th class="py-3 px-6">Status</th>
                <th class="py-3 px-6">Date</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="issue in reconciliation?.open_issues || []" :key="issue.id" class="border-b border-divider">
                <td class="py-3 px-6">{{ issue.issue_type }}</td>
                <td class="py-3 px-6 font-mono text-xs">{{ issue.reference || '-' }}</td>
                <td class="py-3 px-6"><CmStatusChip v-bind="statusChip(issue.status)" size="sm" /></td>
                <td class="py-3 px-6 text-text-muted">{{ new Date(issue.created_at).toLocaleDateString() }}</td>
              </tr>
              <tr v-if="(reconciliation?.open_issues || []).length === 0">
                <td colspan="4" class="py-8 text-center text-text-muted">No open reconciliation issues. ✓</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </template>
    <div v-else class="space-y-6" aria-label="Checking financial access">
      <SkeletonLoader type="metric" :count="3" />
      <SkeletonLoader type="table" :count="5" />
    </div>
  </div>
</template>