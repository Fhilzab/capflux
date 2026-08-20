<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { usePaymentStore } from '../stores/paymentStore';
import { useStudentStore } from '../stores/studentStore';
import { useBillingStore } from '../stores/billingStore';
import { useModuleLock } from '@/composables/useModuleLock';
import CmButton from '../components/ui/CmButton.vue';
import CmSelect from '../components/ui/CmSelect.vue';
import CmInput from '../components/ui/CmInput.vue';
import ModuleLockOverlay from '../features/onboarding/ModuleLockOverlay.vue';

const DEFAULT_SCHOOL_ID = 'demo-school';
const paymentStore = usePaymentStore();
const studentStore = useStudentStore();
const billingStore = useBillingStore();
const { paymentsLocked, requiresSetup, requiresKyc, requiresSettlement, loading: lockLoading } = useModuleLock();
const students = ref([]) as any;
const payments = ref([]) as any;
const form = ref({
  student_id: '',
  amount: '',
  description: '',
});
const saving = ref(false);
const message = ref('');

const loadStudents = async () => {
  await studentStore.loadStudents();
  students.value = studentStore.students;
};

const loadPayments = async () => {
  const allStudents = studentStore.students;
  const entries = [] as any[];

  for (const student of allStudents) {
    const ledgerEntries = await billingStore.loadStudentLedger(student.id);
    const creditEntries = ledgerEntries.filter((e: any) => e.entry_type === 'CREDIT');
    entries.push(
      ...creditEntries.map((entry: any) => ({
        ...entry,
        student_name: `${student.firstName} ${student.lastName}`,
      }))
    );
  }

  payments.value = entries.sort((a: any, b: any) => new Date(b.created_at || b.createdAt).getTime() - new Date(a.created_at || a.createdAt).getTime());
};

const submitPayment = async () => {
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
    entry_type: 'CREDIT',
    entry_category: 'PAYMENT',
    entry_description: form.value.description,
  });

  await loadPayments();
  saving.value = false;
  message.value = 'Payment recorded locally.';
  form.value = { student_id: '', amount: '', description: '' };
};

onMounted(async () => {
  await loadStudents();
  await loadPayments();
});
</script>

<template>
  <main class="min-h-screen bg-background text-text-primary p-8">
    <ModuleLockOverlay v-if="requiresSetup && !lockLoading" variant="setup" />
    <ModuleLockOverlay v-else-if="requiresKyc && !lockLoading" variant="kyc" />
    <ModuleLockOverlay v-else-if="requiresSettlement && !lockLoading" variant="settlement" />
    <ModuleLockOverlay v-else-if="paymentsLocked && !lockLoading" variant="payment" />
    <div v-else class="max-w-6xl mx-auto space-y-6">
      <section class="rounded-card bg-card p-8 shadow-card">
        <h1 class="text-display mb-2">Payments</h1>
        <p class="text-text-secondary">Record local payments and review payment history.</p>
      </section>

      <section class="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div class="rounded-card bg-card p-8 shadow-card space-y-6">
          <div>
            <h2 class="text-headline mb-4">New payment</h2>
            <p class="text-text-secondary">Log a payment against a student locally.</p>
          </div>

          <div class="grid gap-4 sm:grid-cols-2">
            <label class="block">
              <span class="text-sm text-text-muted">Student</span>
              <CmSelect v-model="form.student_id" :options="students.map(s => ({ value: s.id, label: `${s.first_name} ${s.last_name}` }))" 
                placeholder="Select student" class="mt-2" />
            </label>

            <label class="block">
              <span class="text-sm text-text-muted">Amount</span>
              <CmInput v-model="form.amount" type="number" min="0" step="0.01" class="mt-2" />
            </label>

            <label class="block sm:col-span-2">
              <span class="text-sm text-text-muted">Description</span>
              <CmInput v-model="form.description" class="mt-2" />
            </label>
          </div>

          <CmButton @click="submitPayment" :disabled="saving">
            {{ saving ? 'Saving...' : 'Record payment' }}
          </CmButton>
          <p v-if="message" class="text-sm text-success">{{ message }}</p>
        </div>

        <div class="rounded-card bg-card p-8 shadow-card">
          <h2 class="text-headline mb-4">Payment count</h2>
          <p class="text-metric text-brand">{{ payments.length }}</p>
          <p class="mt-4 text-text-secondary">Payments are stored locally and synced when the app reconnects.</p>
        </div>
      </section>

      <section class="rounded-card bg-card p-8 shadow-card overflow-x-auto">
        <h2 class="text-headline mb-4">Payment history</h2>
        <div class="grid gap-3">
          <div v-for="payment in payments" :key="payment.id" class="rounded-card border border-divider bg-surface p-4">
            <div class="flex items-center justify-between gap-4">
              <p class="font-semibold">{{ payment.student_name }}</p>
              <p class="text-brand">₦{{ payment.amount }}</p>
            </div>
            <p class="text-text-secondary">{{ payment.entry_description || 'Payment received' }}</p>
            <p class="mt-2 text-xs text-text-muted">{{ new Date(payment.created_at).toLocaleString() }}</p>
          </div>
          <p v-if="payments.length === 0" class="text-text-muted">No payments recorded yet.</p>
        </div>
      </section>
    </div>
  </main>
</template>