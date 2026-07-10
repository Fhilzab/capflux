<script setup>
import { ref, onMounted } from 'vue';
import { BillingService } from '../services/BillingService';
import { StudentService } from '../services/StudentService';

const DEFAULT_SCHOOL_ID = 'demo-school';
const items = ref([]);
const balance = ref(0);
const students = ref([]);
const reconciliation = ref({ totalCharges: 0, totalCredits: 0, netBalance: 0 });
const form = ref({
  student_id: '',
  amount: '',
  entry_description: '',
  entry_type: 'DEBIT',
});
const saving = ref(false);
const message = ref('');

const loadBilling = async () => {
  const result = await BillingService.getBillingSummary(DEFAULT_SCHOOL_ID);
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
  <main class="min-h-screen bg-slate-950 text-white p-8">
    <div class="max-w-6xl mx-auto space-y-6">
      <section class="rounded-3xl bg-slate-900 p-8 shadow-xl">
        <h1 class="text-4xl font-semibold mb-2">Billing</h1>
        <p class="text-slate-400">Local billing summary, payment history, and ledger reconciliation.</p>
      </section>

      <section class="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div class="rounded-3xl bg-slate-900 p-8 shadow-xl space-y-6">
          <div>
            <h2 class="text-2xl font-semibold mb-4">New charge</h2>
            <p class="text-slate-400">Record a billing charge or payment locally for a student.</p>
          </div>
          <div class="grid gap-4 sm:grid-cols-2">
            <label class="block">
              <span class="text-sm text-slate-400">Student</span>
              <select v-model="form.student_id" class="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white">
                <option value="" disabled>Select student</option>
                <option v-for="student in students" :key="student.id" :value="student.id">
                  {{ student.first_name }} {{ student.last_name }}
                </option>
              </select>
            </label>
            <label class="block">
              <span class="text-sm text-slate-400">Amount</span>
              <input v-model="form.amount" type="number" min="0" step="0.01" class="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white" />
            </label>
            <label class="block">
              <span class="text-sm text-slate-400">Type</span>
              <select v-model="form.entry_type" class="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white">
                <option value="DEBIT">Charge</option>
                <option value="CREDIT">Payment</option>
              </select>
            </label>
            <label class="block sm:col-span-2">
              <span class="text-sm text-slate-400">Description</span>
              <input v-model="form.entry_description" class="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white" />
            </label>
          </div>
          <button @click="submitCharge" :disabled="saving" class="rounded-2xl bg-cyan-500 px-5 py-3 font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-50">
            {{ saving ? 'Saving...' : 'Save charge' }}
          </button>
          <p v-if="message" class="text-sm text-emerald-400">{{ message }}</p>
        </div>

        <div class="rounded-3xl bg-slate-900 p-8 shadow-xl">
          <h2 class="text-2xl font-semibold mb-4">Outstanding balance</h2>
          <p class="text-5xl font-bold text-cyan-400">₦{{ balance }}</p>
          <div class="mt-6 space-y-3 text-slate-400">
            <p>Total charges: ₦{{ reconciliation.totalCharges }}</p>
            <p>Total payments: ₦{{ reconciliation.totalCredits }}</p>
            <p class="text-sm">Reconciliation is computed from local ledger entries.</p>
          </div>
        </div>
      </section>

      <section class="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div class="rounded-3xl bg-slate-900 p-8 shadow-xl overflow-x-auto">
          <h2 class="text-2xl font-semibold mb-4">Charges</h2>
          <table class="w-full border-collapse text-left text-sm text-slate-200">
            <thead>
              <tr class="border-b border-slate-700 text-slate-400">
                <th class="py-3">Student</th>
                <th class="py-3">Amount</th>
                <th class="py-3">Type</th>
                <th class="py-3">Description</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in items" :key="item.id" class="border-b border-slate-800 hover:bg-slate-950/50">
                <td class="py-3">{{ item.student_name }}</td>
                <td class="py-3">₦{{ item.amount }}</td>
                <td class="py-3">{{ item.entry_type }}</td>
                <td class="py-3">{{ item.entry_description || '-' }}</td>
              </tr>
              <tr v-if="items.length === 0">
                <td colspan="4" class="py-8 text-center text-slate-500">No billing items available.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="rounded-3xl bg-slate-900 p-8 shadow-xl overflow-x-auto">
          <h2 class="text-2xl font-semibold mb-4">Payment history</h2>
          <div class="grid gap-3">
            <div v-for="entry in items.filter((entry) => entry.entry_type === 'CREDIT')" :key="entry.id" class="rounded-2xl border border-slate-800 bg-slate-950 p-4">
              <div class="flex items-center justify-between gap-4">
                <p class="font-semibold">{{ entry.student_name }}</p>
                <p class="text-cyan-400">₦{{ entry.amount }}</p>
              </div>
              <p class="text-slate-400">{{ entry.entry_description || 'Payment received' }}</p>
            </div>
            <p v-if="items.filter((entry) => entry.entry_type === 'CREDIT').length === 0" class="text-slate-500">No payment history yet.</p>
          </div>
        </div>
      </section>
    </div>
  </main>
</template>
