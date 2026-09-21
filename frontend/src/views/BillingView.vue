<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useBillingStore, type BillingSummaryItem } from '../stores/billingStore';
import { useStudentStore } from '../stores/studentStore';
import CmButton from '../components/ui/CmButton.vue';
import CmInput from '../components/ui/CmInput.vue';
import CmSelect from '../components/ui/CmSelect.vue';
import CmStatusChip from '../components/ui/CmStatusChip.vue';
import ErrorState from '../components/ui/ErrorState.vue';
import EmptyState from '../components/ui/EmptyState.vue';
import SkeletonLoader from '../components/ui/SkeletonLoader.vue';
import { useModuleLock } from '../composables/useModuleLock';
import ModuleLockOverlay from '../features/onboarding/ModuleLockOverlay.vue';
import { formatNairaKobo } from '../lib/ledgerSemantics';

const DEFAULT_SCHOOL_ID = 'demo-school';
const items = ref<BillingSummaryItem[]>([]);
const assessedMinor = ref(0);
const collectedMinor = ref(0);
const outstandingMinor = ref(0);
const students = ref<Array<{ id: string; firstName: string; lastName: string }>>([]);
const searchQuery = ref('');
const form = ref({
  student_id: '',
  amount: '',
  entry_description: '',
  entry_type: 'DEBIT',
});
const saving = ref(false);
const message = ref('');
const error = ref('');
const loading = ref(false);

const billingStore = useBillingStore();
const studentStore = useStudentStore();
const route = useRoute();
const { showLock, lockReason, canAccessFinancials } = useModuleLock();

/** Student context preserved from Student Detail (?student=<id>). */
const scopedStudentId = computed(() =>
  typeof route.query.student === 'string' && route.query.student ? route.query.student : '',
);

const chargeItems = computed(() =>
  items.value.filter((item) => item.entry_type === 'CHARGE' || item.entry_type === 'DEBIT'),
);
const paymentItems = computed(() =>
  items.value.filter((item) => item.entry_type === 'PAYMENT' || item.entry_type === 'CREDIT'),
);
const reversalItems = computed(() => items.value.filter((item) => item.entry_type === 'REVERSAL'));

const loadBilling = async (studentIds: string[] = []) => {
  loading.value = true;
  error.value = '';
  try {
    const result = await billingStore.getBillingSummary(DEFAULT_SCHOOL_ID, studentIds);
    items.value = result.items;
    assessedMinor.value = result.summary.assessedMinor;
    collectedMinor.value = result.summary.collectedMinor;
    outstandingMinor.value = result.summary.outstandingMinor;
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load billing data.';
  } finally {
    loading.value = false;
  }
};

const loadStudents = async () => {
  await studentStore.loadStudents();
  students.value = studentStore.students;
};

const searchBilling = async () => {
  const query = searchQuery.value.trim();
  if (!query) {
    await loadBilling();
    return;
  }

  const matchingStudents = await studentStore.searchStudents(DEFAULT_SCHOOL_ID, query);
  const ids = matchingStudents.map((student) => student.id);
  await loadBilling(ids);
};

const submitCharge = async () => {
  if (!form.value.student_id || !form.value.amount) {
    message.value = 'Select a student and enter an amount.';
    return;
  }

  saving.value = true;
  message.value = '';

  await billingStore.createCharge({
    school_id: DEFAULT_SCHOOL_ID,
    student_id: form.value.student_id,
    amount: Number(form.value.amount),
    entry_type: form.value.entry_type as 'DEBIT' | 'CREDIT',
    entry_category: form.value.entry_type === 'DEBIT' ? 'TUITION' : 'PAYMENT',
    entry_description: form.value.entry_description,
  });

  await loadBilling();
  saving.value = false;
  message.value = 'Charge recorded locally.';
  form.value = {
    student_id: '',
    amount: '',
    entry_description: '',
    entry_type: 'DEBIT',
  };
};

onMounted(async () => {
  await loadStudents();
  if (scopedStudentId.value) {
    form.value.student_id = scopedStudentId.value;
    await loadBilling([scopedStudentId.value]);
  } else {
    await loadBilling();
  }
});

watch(scopedStudentId, async (id) => {
  if (id) {
    form.value.student_id = id;
    await loadBilling([id]);
  }
});
</script>

<template>
  <main class="min-h-screen bg-background text-text-primary p-4 sm:p-8">
    <ModuleLockOverlay v-if="showLock" :variant="lockReason ?? 'setup'" />
    <div v-else-if="canAccessFinancials" class="max-w-6xl mx-auto space-y-6">
      <section class="rounded-card bg-card p-8 shadow-card">
        <h1 class="text-headline mb-2">Billing</h1>
        <p class="text-text-secondary">Local billing summary, payment history, and ledger reconciliation.</p>
        <p v-if="scopedStudentId" class="mt-2 text-sm text-text-secondary">
          Scoped to student <span class="font-mono text-xs">{{ scopedStudentId }}</span>
          — <button type="button" class="font-medium text-brand hover:underline" @click="$router.push({ name: 'StudentDetail', params: { id: scopedStudentId } })">back to student</button>
        </p>
      </section>

      <section class="premium-card p-8 space-y-6">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 class="text-headline mb-2">Billing</h2>
            <p class="text-text-secondary">Filter charges by student and review local reconciliation.</p>
          </div>
          <div class="grid gap-3 sm:grid-cols-[1fr_auto]">
            <CmInput v-model="searchQuery" placeholder="Search students" class="mt-0" />
            <CmButton @click="searchBilling" size="md">Filter</CmButton>
          </div>
        </div>

        <ErrorState v-if="error" :description="error" @retry="loadBilling()" />
        <div v-else-if="loading" class="space-y-4">
          <SkeletonLoader type="row" :count="3" />
          <SkeletonLoader type="metric" :count="1" />
        </div>
        <template v-else>
          <div class="premium-card space-y-6">
            <div>
              <h2 class="text-headline mb-4">New charge</h2>
              <p class="text-text-secondary">Record a billing charge or payment locally for a student.</p>
            </div>
            <div class="grid gap-4 sm:grid-cols-2">
              <label class="block">
                <span class="text-sm text-text-muted">Student</span>
                <CmSelect
                  v-model="form.student_id"
                  :options="students.map(s => ({ value: s.id, label: `${s.firstName} ${s.lastName}` }))"
                  placeholder="Select student"
                  class="mt-2"
                />
              </label>
              <label class="block">
                <span class="text-sm text-text-muted">Amount (₦)</span>
                <CmInput v-model="form.amount" type="number" min="0" step="0.01" class="mt-2" />
              </label>
              <label class="block">
                <span class="text-sm text-text-muted">Type</span>
                <CmSelect
                  v-model="form.entry_type"
                  :options="[
                    { value: 'DEBIT', label: 'Charge (Debit)' },
                    { value: 'CREDIT', label: 'Payment (Credit)' },
                  ]"
                  class="mt-2"
                />
              </label>
              <label class="block sm:col-span-2">
                <span class="text-sm text-text-muted">Description</span>
                <CmInput v-model="form.entry_description" class="mt-2" />
              </label>
            </div>
            <CmButton @click="submitCharge" :disabled="saving">
              {{ saving ? 'Saving...' : 'Save charge' }}
            </CmButton>
            <p v-if="message" class="text-sm text-success">{{ message }}</p>
          </div>

          <div class="premium-card">
            <h2 class="text-headline mb-4">Outstanding balance</h2>
            <p class="text-5xl font-bold text-brand">{{ formatNairaKobo(outstandingMinor) }}</p>
            <div class="mt-6 space-y-3 text-text-secondary">
              <p>Total charges: {{ formatNairaKobo(assessedMinor) }}</p>
              <p>Total payments collected: {{ formatNairaKobo(collectedMinor) }}</p>
              <p class="text-sm">Reconciliation is computed from local ledger entries (integer kobo).</p>
            </div>
          </div>

          <section class="grid gap-6 lg:grid-cols-[1fr_1fr]">
            <div class="premium-card overflow-x-auto">
              <h2 class="text-headline mb-4">Charges</h2>
              <div class="overflow-x-auto">
                <table class="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr class="border-b border-divider text-text-muted">
                      <th class="py-3">Student</th>
                      <th class="py-3">Amount</th>
                      <th class="py-3">Status</th>
                      <th class="py-3">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="item in chargeItems" :key="item.id" class="border-b border-divider hover:bg-surface/50">
                      <td class="py-3">{{ item.student_name }}</td>
                      <td class="py-3">{{ formatNairaKobo(item.amount_minor) }}</td>
                      <td class="py-3"><CmStatusChip :status="item.entry_type === 'CHARGE' ? 'success' : 'info'" :label="item.entry_type" /></td>
                      <td class="py-3">{{ item.entry_description || '-' }}</td>
                    </tr>
                    <tr v-if="chargeItems.length === 0">
                      <td colspan="4" class="py-8 text-center text-text-muted">No charges recorded yet.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div class="premium-card">
              <h2 class="text-headline mb-4">Payment history</h2>
              <div class="grid gap-3">
                <div v-for="entry in paymentItems" :key="entry.id" class="rounded-card border border-divider bg-surface p-4">
                  <div class="flex items-center justify-between gap-4">
                    <p class="font-semibold">{{ entry.student_name }}</p>
                    <p class="text-brand">{{ formatNairaKobo(entry.amount_minor) }}</p>
                  </div>
                  <p class="text-text-secondary">{{ entry.entry_description || 'Payment received' }}</p>
                </div>
                <p v-if="paymentItems.length === 0" class="text-text-muted">No payment history yet.</p>
              </div>
              <div v-if="reversalItems.length" class="mt-6">
                <h3 class="text-headline mb-3">Reversals</h3>
                <div class="grid gap-3">
                  <div v-for="entry in reversalItems" :key="entry.id" class="rounded-card border border-divider bg-surface p-4">
                    <div class="flex items-center justify-between gap-4">
                      <p class="font-semibold">{{ entry.student_name }}</p>
                      <p class="text-danger">{{ formatNairaKobo(entry.amount_minor) }}</p>
                    </div>
                    <p class="text-text-secondary">{{ entry.entry_description || 'Reversed payment' }}</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <EmptyState
            v-if="items.length === 0 && !loading && !error"
            title="No billing activity"
            description="Charges and payments recorded locally will appear here."
          />
        </template>
      </section>
    </div>
    <div v-else class="max-w-6xl mx-auto space-y-4" aria-label="Checking financial access">
      <SkeletonLoader type="row" :count="3" />
      <SkeletonLoader type="metric" :count="1" />
    </div>
  </main>
</template>