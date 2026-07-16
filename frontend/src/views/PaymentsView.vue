<script setup>
import { ref, onMounted } from 'vue';
import { PaymentService } from '../shared/services/PaymentService';
import { StudentService } from '../shared/services/StudentService';

const DEFAULT_SCHOOL_ID = 'demo-school';
const students = ref([]);
const payments = ref([]);
const form = ref({
  student_id: '',
  amount: '',
  description: '',
});
const saving = ref(false);
const message = ref('');

const loadStudents = async () => {
  students.value = await StudentService.getStudentsBySchool(DEFAULT_SCHOOL_ID);
};

const loadPayments = async () => {
  const allStudents = await StudentService.getStudentsBySchool(DEFAULT_SCHOOL_ID);
  const entries = [];

  for (const student of allStudents) {
    const history = await PaymentService.getPaymentHistory(student.id);
    entries.push(
      ...history.map((entry) => ({
        ...entry,
        student_name: `${student.first_name} ${student.last_name}`,
      }))
    );
  }

  payments.value = entries.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
};

const submitPayment = async () => {
  if (!form.value.student_id || !form.value.amount) {
    message.value = 'Select a student and enter an amount.';
    return;
  }

  saving.value = true;
  message.value = '';

  await PaymentService.recordPayment({
    id: `${form.value.student_id}-${Date.now()}`,
    school_id: DEFAULT_SCHOOL_ID,
    student_id: form.value.student_id,
    amount: Number(form.value.amount),
    entry_description: form.value.description,
    created_at: new Date().toISOString(),
    client_sequence: 0,
    device_id: 'local-client',
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
  <main class="min-h-screen bg-slate-950 text-white p-8">
    <div class="max-w-6xl mx-auto space-y-6">
      <section class="rounded-3xl bg-slate-900 p-8 shadow-xl">
        <h1 class="text-4xl font-semibold mb-2">Payments</h1>
        <p class="text-slate-400">Record local payments and review payment history.</p>
      </section>

      <section class="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div class="rounded-3xl bg-slate-900 p-8 shadow-xl space-y-6">
          <div>
            <h2 class="text-2xl font-semibold mb-4">New payment</h2>
            <p class="text-slate-400">Log a payment against a student locally.</p>
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

            <label class="block sm:col-span-2">
              <span class="text-sm text-slate-400">Description</span>
              <input v-model="form.description" class="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white" />
            </label>
          </div>

          <button @click="submitPayment" :disabled="saving" class="rounded-2xl bg-cyan-500 px-5 py-3 font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-50">
            {{ saving ? 'Saving...' : 'Record payment' }}
          </button>
          <p v-if="message" class="text-sm text-emerald-400">{{ message }}</p>
        </div>

        <div class="rounded-3xl bg-slate-900 p-8 shadow-xl">
          <h2 class="text-2xl font-semibold mb-4">Payment count</h2>
          <p class="text-5xl font-bold text-cyan-400">{{ payments.length }}</p>
          <p class="mt-4 text-slate-400">Payments are stored locally and synced when the app reconnects.</p>
        </div>
      </section>

      <section class="rounded-3xl bg-slate-900 p-8 shadow-xl overflow-x-auto">
        <h2 class="text-2xl font-semibold mb-4">Payment history</h2>
        <div class="grid gap-3">
          <div v-for="payment in payments" :key="payment.id" class="rounded-2xl border border-slate-800 bg-slate-950 p-4">
            <div class="flex items-center justify-between gap-4">
              <p class="font-semibold">{{ payment.student_name }}</p>
              <p class="text-cyan-400">₦{{ payment.amount }}</p>
            </div>
            <p class="text-slate-400">{{ payment.entry_description || 'Payment received' }}</p>
            <p class="mt-2 text-xs text-slate-500">{{ new Date(payment.created_at).toLocaleString() }}</p>
          </div>
          <p v-if="payments.length === 0" class="text-slate-500">No payments recorded yet.</p>
        </div>
      </section>
    </div>
  </main>
</template>
