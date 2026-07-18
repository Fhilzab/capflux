<script setup>
import { ref, onMounted } from 'vue';
import { BillingService } from '../shared/services/BillingService';
import { StudentService } from '../shared/services/StudentService';
import CmButton from '../components/ui/CmButton.vue';
import CmInput from '../components/ui/CmInput.vue';
import CmSelect from '../components/ui/CmSelect.vue';

const DEFAULT_SCHOOL_ID = 'demo-school';
const items = ref([]);
const balance = ref(0);
const students = ref([]);
const reconciliation = ref({ totalCharges: 0, totalCredits: 0, netBalance: 0 });
const searchQuery = ref('');
const form = ref({
  student_id: '',
  amount: '',
  entry_description: '',
  entry_type: 'DEBIT',
});
const saving = ref(false);
const message = ref('');

const loadBilling = async (studentIds = []) => {
  const result = await BillingService.getBillingSummary(DEFAULT_SCHOOL_ID, studentIds);
  items.value = result.items;
  balance.value = result.balance;
  reconciliation.value = {
    totalCharges: result.items.filter((item) => item.entry_type === 'DEBIT').reduce((sum, item) => sum + Number(item.amount || 0), 0),
    totalCredits: result.items.filter((item) => item.entry_type === 'CREDIT').reduce((sum, item) => sum + Number(item.amount || 0), 0),
    netBalance: result.balance,
  };
};

const loadStudents = async () => {
  students.value = await StudentService.getStudentsBySchool(DEFAULT_SCHOOL_ID);
};

const searchBilling = async () => {
  const query = searchQuery.value.trim();
  if (!query) {
    await loadBilling();
    return;
  }

  const matchingStudents = await StudentService.searchStudents(DEFAULT_SCHOOL_ID, query);
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

  await BillingService.createCharge({
    id: `${form.value.student_id}-${Date.now()}`,
    school_id: DEFAULT_SCHOOL_ID,
    student_id: form.value.student_id,
    amount: Number(form.value.amount),
    entry_type: form.value.entry_type,
    entry_category: form.value.entry_type === 'DEBIT' ? 'TUITION' : 'PAYMENT',
    entry_description: form.value.entry_description,
    created_at: new Date().toISOString(),
    client_sequence: 0,
    device_id: 'local-client',
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
  await loadBilling();
});
</script>

<template>
  <main class="min-h-screen bg-background text-text-primary p-8">
    <div class="max-w-6xl mx-auto space-y-6">
      <section class="rounded-card bg-card p-8 shadow-card">
        <h1 class="text-headline mb-2">Billing</h1>
        <p class="text-text-secondary">Local billing summary, payment history, and ledger reconciliation.</p>
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
                :options="students.map(s => ({ value: s.id, label: `${s.first_name} ${s.last_name}` }))"
                placeholder="Select student"
                class="mt-2"
              />
            </label>
            <label class="block">
              <span class="text-sm text-text-muted">Amount</span>
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
          <p class="text-5xl font-bold text-brand">₦{{ balance.toLocaleString() }}</p>
          <div class="mt-6 space-y-3 text-text-secondary">
            <p>Total charges: ₦{{ reconciliation.totalCharges.toLocaleString() }}</p>
            <p>Total payments: ₦{{ reconciliation.totalCredits.toLocaleString() }}</p>
            <p class="text-sm">Reconciliation is computed from local ledger entries.</p>
          </div>
        </div>
      </section>

      <section class="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div class="premium-card overflow-x-auto">
          <h2 class="text-headline mb-4">Charges</h2>
          <div class="overflow-x-auto">
            <table class="w-full border-collapse text-left text-sm">
              <thead>
                <tr class="border-b border-divider text-text-muted">
                  <th class="py-3">Student</th>
                  <th class="py-3">Amount</th>
                  <th class="py-3">Type</th>
                  <th class="py-3">Description</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in items" :key="item.id" class="border-b border-divider hover:bg-surface/50">
                  <td class="py-3">{{ item.student_name }}</td>
                  <td class="py-3">₦{{ item.amount }}</td>
                  <td class="py-3">{{ item.entry_type }}</td>
                  <td class="py-3">{{ item.entry_description || '-' }}</td>
                </tr>
                <tr v-if="items.length === 0">
                  <td colspan="4" class="py-8 text-center text-text-muted">No billing items available.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="premium-card">
          <h2 class="text-headline mb-4">Payment history</h2>
          <div class="grid gap-3">
            <div v-for="entry in items.filter((entry) => entry.entry_type === 'CREDIT')" :key="entry.id" class="rounded-card border border-divider bg-surface p-4">
              <div class="flex items-center justify-between gap-4">
                <p class="font-semibold">{{ entry.student_name }}</p>
                <p class="text-brand">₦{{ entry.amount }}</p>
              </div>
              <p class="text-text-secondary">{{ entry.entry_description || 'Payment received' }}</p>
            </div>
            <p v-if="items.filter((entry) => entry.entry_type === 'CREDIT').length === 0" class="text-text-muted">No payment history yet.</p>
          </div>
        </div>
      </section>
    </div>
  </main>
</template>