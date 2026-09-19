<script setup lang="ts">
import { computed, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { usePaymentsStore } from '@/stores/paymentsStore';
import { useModuleLock } from '@/composables/useModuleLock';
import ModuleLockOverlay from '@/features/onboarding/ModuleLockOverlay.vue';
import MetricCard from '@/components/ui/MetricCard.vue';
import CmAlert from '@/components/ui/CmAlert.vue';
import CmStatusChip from '@/components/ui/CmStatusChip.vue';
import CmButton from '@/components/ui/CmButton.vue';
import ErrorState from '@/components/ui/ErrorState.vue';
import SkeletonLoader from '@/components/ui/SkeletonLoader.vue';

const store = usePaymentsStore();
const route = useRoute();
const { paymentsLocked, requiresSetup, requiresKyc, requiresSettlement, loading: lockLoading } = useModuleLock();

/** Student context preserved from Student Detail (?student=<id>). */
const scopedStudentId = computed(() =>
  typeof route.query.student === 'string' && route.query.student ? route.query.student : '',
);

function paymentStudentId(p: any): string {
  return p.student_id ?? p.studentId ?? p.students?.id ?? '';
}

const payments = computed(() => {
  if (!scopedStudentId.value) return store.payments;
  return store.payments.filter((p: any) => paymentStudentId(p) === scopedStudentId.value);
});
const loading = computed(() => store.loading);
const error = computed(() => store.error);

const fmtNaira = (minor: number) => (minor / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 });

const todayNaira = computed(() => fmtNaira(store.paymentSummary?.today_collections_minor || 0));
const monthNaira = computed(() => fmtNaira(store.paymentSummary?.month_collections_minor || 0));
const totalNaira = computed(() => fmtNaira(store.paymentSummary?.total_collected_minor || 0));

function statusChip(status: string) {
  switch (status) {
    case 'SUCCESS': return { status: 'success' as const, label: 'Success' };
    case 'PENDING': return { status: 'pending' as const, label: 'Pending' };
    case 'PROCESSING': return { status: 'info' as const, label: 'Processing' };
    case 'FAILED': return { status: 'error' as const, label: 'Failed' };
    case 'REVERSED': return { status: 'warning' as const, label: 'Reversed' };
    default: return { status: 'neutral' as const, label: status };
  }
}

const retryLoad = () => {
  if (scopedStudentId.value) {
    void store.loadPayments(scopedStudentId.value);
  } else {
    void store.loadAll();
  }
};

async function loadScoped() {
  if (scopedStudentId.value) {
    await Promise.allSettled([
      store.loadPayments(scopedStudentId.value),
      store.loadPaymentSummary(),
    ]);
  } else {
    await Promise.allSettled([store.loadAll(), store.loadPaymentSummary()]);
  }
}

watch(scopedStudentId, () => {
  void loadScoped();
});

onMounted(async () => {
  await loadScoped();
});
</script>

<template>
  <ModuleLockOverlay v-if="requiresSetup && !lockLoading" variant="setup" />
  <ModuleLockOverlay v-else-if="requiresKyc && !lockLoading" variant="kyc" />
  <ModuleLockOverlay v-else-if="requiresSettlement && !lockLoading" variant="settlement" />
  <ModuleLockOverlay v-else-if="paymentsLocked && !lockLoading" variant="payment" />
  <div v-else class="space-y-6">
    <div>
      <h1 class="text-headline">Payments</h1>
      <p class="text-slate-500">Real-time payment collections, verified by the payment gateway.</p>
      <p v-if="scopedStudentId" class="mt-1 text-sm text-slate-500">
        Filtered to this student — <RouterLink class="font-medium text-brand hover:underline" :to="{ name: 'StudentDetail', params: { id: scopedStudentId } }">back to student</RouterLink>
      </p>
    </div>

    <ErrorState v-if="error" title="Unable to load payments" :description="error" @retry="retryLoad" />

    <div v-if="loading && payments.length === 0" class="space-y-6">
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SkeletonLoader type="metric" :count="4" />
      </div>
      <SkeletonLoader type="table" :count="5" />
    </div>

    <template v-else>
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Today's Collections" :value="todayNaira" variant="collection" currency />
        <MetricCard label="This Month" :value="monthNaira" variant="revenue" currency />
        <MetricCard label="Total Collected" :value="totalNaira" variant="success" currency />
        <MetricCard
          label="Successful Payments"
          :value="store.paymentSummary?.successful_payments || 0"
          variant="info"
        />
      </div>

      <div class="rounded-card bg-card shadow-card overflow-x-auto">
        <div class="p-6 border-b border-divider flex items-center justify-between">
          <h2 class="text-title">Payment History</h2>
        </div>
        <table class="w-full text-left text-sm">
          <thead>
            <tr class="border-b border-divider text-text-muted">
              <th class="py-3 px-6">Reference</th>
              <th class="py-3 px-6">Student</th>
              <th class="py-3 px-6">Amount</th>
              <th class="py-3 px-6">Status</th>
              <th class="py-3 px-6">Date</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in payments" :key="p.id" class="border-b border-divider">
              <td class="py-3 px-6 font-mono text-xs">{{ p.reference }}</td>
              <td class="py-3 px-6">{{ p.students?.first_name }} {{ p.students?.last_name }}</td>
              <td class="py-3 px-6 font-medium">{{ fmtNaira(p.amount_minor) }}</td>
              <td class="py-3 px-6">
                <CmStatusChip v-bind="statusChip(p.status)" size="sm" />
              </td>
              <td class="py-3 px-6 text-text-muted">{{ new Date(p.created_at).toLocaleString() }}</td>
            </tr>
            <tr v-if="payments.length === 0">
              <td colspan="5" class="py-8 text-center text-text-muted">No payments yet.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>