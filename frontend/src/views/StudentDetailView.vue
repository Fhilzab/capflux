<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import { StudentService } from '../services/StudentService';
import { BillingService } from '../services/BillingService';

const route = useRoute();
const student = ref(null);
const ledgerItems = ref([]);
const loading = ref(true);
const error = ref('');

const totalCharges = computed(() =>
  ledgerItems.value
    .filter((entry) => entry.entry_type === 'DEBIT')
    .reduce((sum, entry) => sum + Number(entry.amount || 0), 0)
);

const totalPayments = computed(() =>
  ledgerItems.value
    .filter((entry) => entry.entry_type === 'CREDIT')
    .reduce((sum, entry) => sum + Number(entry.amount || 0), 0)
);

const outstandingBalance = computed(() => totalCharges.value - totalPayments.value);

const form = ref({
  entry_type: 'DEBIT',
  amount: '',
  entry_description: '',
});
const saving = ref(false);
const message = ref('');

const loadStudent = async () => {
  try {
    loading.value = true;
    error.value = '';
    student.value = await StudentService.getStudentById(route.params.id);
    if (!student.value) {
      error.value = 'Student not found.';
      return;
    }
    ledgerItems.value = await BillingService.getStudentLedgerEntries(student.value.id);
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err);
  } finally {
    loading.value = false;
  }
};

const submitEntry = async () => {
  if (!student.value) {
    message.value = 'No student selected.';
    return;
  }

  if (!form.value.amount) {
    message.value = 'Enter an amount to record.';
    return;
  }

  saving.value = true;
  message.value = '';

  await BillingService.createCharge({
    id: `${student.value.id}-${Date.now()}`,
    school_id: student.value.school_id,
    student_id: student.value.id,
    amount: Number(form.value.amount),
    entry_type: form.value.entry_type,
    entry_category: form.value.entry_type === 'DEBIT' ? 'TUITION' : 'PAYMENT',
    entry_description: form.value.entry_description,
    created_at: new Date().toISOString(),
    client_sequence: 0,
    device_id: 'local-client',
  });

  await loadStudent();
  saving.value = false;
  message.value = 'Transaction recorded locally.';
  form.value = {
    entry_type: 'DEBIT',
    amount: '',
    entry_description: '',
  };
};

onMounted(loadStudent);
</script>

<template>
  <main class="min-h-screen bg-slate-950 text-white p-8">
    <div class="max-w-5xl mx-auto space-y-6">
      <section class="rounded-3xl bg-slate-900 p-8 shadow-xl">
        <div class="flex flex-col gap-3">
          <h1 class="text-4xl font-semibold">Student details</h1>
          <p class="text-slate-400">Review selected student and local billing ledger.</p>
        </div>
      </section>

      <section v-if="loading" class="rounded-3xl bg-slate-900 p-8 shadow-xl">
        <p class="text-slate-400">Loading student details...</p>
      </section>

      <section v-else-if="error" class="rounded-3xl bg-slate-900 p-8 shadow-xl">
        <p class="text-rose-400">{{ error }}</p>
      </section>

      <section v-else class="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div class="rounded-3xl bg-slate-900 p-8 shadow-xl">
          <h2 class="text-2xl font-semibold mb-4">{{ student.first_name }} {{ student.last_name }}</h2>
          <div class="space-y-3 text-slate-200">
            <p><span class="text-slate-400">Class:</span> {{ student.class_name }}</p>
            <p><span class="text-slate-400">Guardian phone:</span> {{ student.guardian_phone }}</p>
            <p><span class="text-slate-400">Status:</span> {{ student.status }}</p>
          </div>
        </div>

        <div class="rounded-3xl bg-slate-900 p-8 shadow-xl">
          <div class="grid gap-6 lg:grid-cols-[1fr_1fr] mb-6">
            <div class="rounded-3xl bg-slate-950 p-4">
              <p class="text-sm uppercase tracking-[0.24em] text-slate-500">Charges</p>
              <p class="mt-4 text-3xl font-bold text-cyan-400">₦{{ totalCharges }}</p>
            </div>
            <div class="rounded-3xl bg-slate-950 p-4">
              <p class="text-sm uppercase tracking-[0.24em] text-slate-500">Payments</p>
              <p class="mt-4 text-3xl font-bold text-emerald-400">₦{{ totalPayments }}</p>
            </div>
            <div class="rounded-3xl bg-slate-950 p-4 lg:col-span-2">
              <p class="text-sm uppercase tracking-[0.24em] text-slate-500">Outstanding balance</p>
              <p class="mt-4 text-3xl font-bold text-amber-400">₦{{ outstandingBalance }}</p>
            </div>
          </div>

          <div class="rounded-3xl bg-slate-950 p-6 mb-6">
            <h2 class="text-2xl font-semibold mb-4">Record transaction</h2>
            <p class="text-slate-400 mb-4">Add a charge or payment for this student locally.</p>
            <div class="grid gap-4 sm:grid-cols-2">
              <label class="block">
                <span class="text-sm text-slate-400">Type</span>
                <select v-model="form.entry_type" class="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white">
                  <option value="DEBIT">Charge</option>
                  <option value="CREDIT">Payment</option>
                </select>
              </label>
              <label class="block">
                <span class="text-sm text-slate-400">Amount</span>
                <input v-model="form.amount" type="number" min="0" step="0.01" class="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white" />
              </label>
              <label class="block sm:col-span-2">
                <span class="text-sm text-slate-400">Description</span>
                <input v-model="form.entry_description" class="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white" />
              </label>
            </div>
            <div class="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <button @click="submitEntry" :disabled="saving" class="rounded-2xl bg-cyan-500 px-5 py-3 font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-50">
                {{ saving ? 'Saving...' : 'Record transaction' }}
              </button>
              <p v-if="message" class="text-sm text-emerald-400">{{ message }}</p>
            </div>
          </div>

          <h2 class="text-2xl font-semibold mb-4">Ledger entries</h2>
          <p class="text-slate-400">Transactions saved locally for this student.</p>
          <div class="mt-6 space-y-4">
            <div v-for="entry in ledgerItems" :key="entry.id" class="rounded-2xl border border-slate-800 bg-slate-950 p-4">
              <div class="flex items-center justify-between gap-4">
                <p class="font-semibold">{{ entry.entry_type }}</p>
                <p class="text-cyan-400">₦{{ entry.amount }}</p>
              </div>
              <p class="text-slate-400">{{ entry.entry_description || 'No description' }}</p>
              <p class="text-xs text-slate-500 mt-2">Created: {{ new Date(entry.created_at).toLocaleString() }}</p>
            </div>
            <p v-if="ledgerItems.length === 0" class="text-slate-500">No local ledger entries available.</p>
          </div>
        </div>
      </section>
    </div>
  </main>
</template>
