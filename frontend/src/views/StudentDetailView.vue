<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { StudentService } from '../services/StudentService';
import { BillingService } from '../services/BillingService';

const route = useRoute();
const router = useRouter();
const student = ref(null);
const ledgerItems = ref([]);
const loading = ref(true);
const error = ref('');
const editing = ref(false);
const savingEdit = ref(false);
const archiving = ref(false);
const editMessage = ref('');

const editForm = ref({
  first_name: '',
  last_name: '',
  class_name: '',
  guardian_phone: '',
});

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
    editForm.value = {
      first_name: student.value.first_name || '',
      last_name: student.value.last_name || '',
      class_name: student.value.class_name || '',
      guardian_phone: student.value.guardian_phone || '',
    };
    ledgerItems.value = await BillingService.getStudentLedgerEntries(student.value.id);
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err);
  } finally {
    loading.value = false;
  }
};

const startEditing = () => {
  editing.value = true;
  editMessage.value = '';
};

const cancelEditing = () => {
  editing.value = false;
  editMessage.value = '';
  if (student.value) {
    editForm.value = {
      first_name: student.value.first_name || '',
      last_name: student.value.last_name || '',
      class_name: student.value.class_name || '',
      guardian_phone: student.value.guardian_phone || '',
    };
  }
};

const saveEdit = async () => {
  if (!student.value) return;
  if (!editForm.value.first_name || !editForm.value.last_name) {
    editMessage.value = 'First name and last name are required.';
    return;
  }

  savingEdit.value = true;
  editMessage.value = '';

  try {
    await StudentService.updateStudent(student.value.id, {
      first_name: editForm.value.first_name,
      last_name: editForm.value.last_name,
      class_name: editForm.value.class_name,
      guardian_phone: editForm.value.guardian_phone,
    });
    await loadStudent();
    editing.value = false;
    editMessage.value = 'Student updated successfully.';
  } catch (err) {
    editMessage.value = err instanceof Error ? err.message : String(err);
  } finally {
    savingEdit.value = false;
  }
};

const archiveStudent = async (status) => {
  if (!student.value) return;
  archiving.value = true;
  editMessage.value = '';

  try {
    await StudentService.archiveStudent(student.value.id, status);
    await loadStudent();
    editMessage.value = `Student status changed to ${status}.`;
  } catch (err) {
    editMessage.value = err instanceof Error ? err.message : String(err);
  } finally {
    archiving.value = false;
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
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 class="text-4xl font-semibold">Student details</h1>
            <p class="text-slate-400">Review selected student and local billing ledger.</p>
          </div>
          <button
            @click="router.push({ name: 'Students' })"
            class="rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
          >
            &larr; Back to students
          </button>
        </div>
      </section>

      <section v-if="loading" class="rounded-3xl bg-slate-900 p-8 shadow-xl">
        <p class="text-slate-400">Loading student details...</p>
      </section>

      <section v-else-if="error" class="rounded-3xl bg-slate-900 p-8 shadow-xl">
        <p class="text-rose-400">{{ error }}</p>
      </section>

      <section v-else class="space-y-6">
        <!-- Student info and edit form -->
        <div class="rounded-3xl bg-slate-900 p-8 shadow-xl">
          <div class="flex items-center justify-between mb-6">
            <h2 class="text-2xl font-semibold">Student Information</h2>
            <div class="flex gap-2">
              <button
                v-if="!editing"
                @click="startEditing"
                class="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400"
              >
                Edit
              </button>
              <button
                v-if="student.status === 'ACTIVE'"
                @click="archiveStudent('LEFT')"
                :disabled="archiving"
                class="rounded-xl bg-rose-500 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-400 disabled:opacity-50"
              >
                {{ archiving ? 'Archiving...' : 'Archive' }}
              </button>
              <button
                v-if="student.status !== 'ACTIVE'"
                @click="archiveStudent('ACTIVE')"
                :disabled="archiving"
                class="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-400 disabled:opacity-50"
              >
                {{ archiving ? 'Restoring...' : 'Restore' }}
              </button>
            </div>
          </div>

          <!-- Edit mode -->
          <div v-if="editing" class="grid gap-4 sm:grid-cols-2">
            <label class="block">
              <span class="text-sm text-slate-400">First name</span>
              <input v-model="editForm.first_name" class="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white" />
            </label>
            <label class="block">
              <span class="text-sm text-slate-400">Last name</span>
              <input v-model="editForm.last_name" class="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white" />
            </label>
            <label class="block">
              <span class="text-sm text-slate-400">Class</span>
              <input v-model="editForm.class_name" class="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white" />
            </label>
            <label class="block">
              <span class="text-sm text-slate-400">Guardian phone</span>
              <input v-model="editForm.guardian_phone" class="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white" />
            </label>
            <div class="sm:col-span-2 flex gap-3">
              <button @click="saveEdit" :disabled="savingEdit" class="rounded-2xl bg-emerald-500 px-5 py-3 font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50">
                {{ savingEdit ? 'Saving...' : 'Save changes' }}
              </button>
              <button @click="cancelEditing" class="rounded-2xl bg-slate-800 px-5 py-3 font-semibold text-white hover:bg-slate-700">
                Cancel
              </button>
            </div>
          </div>

          <!-- View mode -->
          <div v-else class="space-y-3 text-slate-200">
            <div class="grid gap-4 sm:grid-cols-2">
              <div>
                <p class="text-sm text-slate-400">First name</p>
                <p class="mt-1 text-lg font-semibold">{{ student.first_name }}</p>
              </div>
              <div>
                <p class="text-sm text-slate-400">Last name</p>
                <p class="mt-1 text-lg font-semibold">{{ student.last_name }}</p>
              </div>
              <div>
                <p class="text-sm text-slate-400">Class</p>
                <p class="mt-1">{{ student.class_name }}</p>
              </div>
              <div>
                <p class="text-sm text-slate-400">Guardian phone</p>
                <p class="mt-1">{{ student.guardian_phone }}</p>
              </div>
              <div>
                <p class="text-sm text-slate-400">Status</p>
                <span class="mt-1 inline-flex rounded-full px-3 py-1 text-sm font-semibold"
                  :class="{
                    'bg-emerald-500/10 text-emerald-400': student.status === 'ACTIVE',
                    'bg-slate-500/10 text-slate-400': student.status === 'GRADUATED',
                    'bg-rose-500/10 text-rose-400': student.status === 'LEFT',
                  }"
                >
                  {{ student.status }}
                </span>
              </div>
            </div>
          </div>
          <p v-if="editMessage" class="mt-4 text-sm text-emerald-400">{{ editMessage }}</p>
        </div>

        <!-- Balance cards -->
        <div class="grid gap-6 lg:grid-cols-3">
          <div class="rounded-3xl bg-slate-900 p-6 shadow-xl">
            <p class="text-sm uppercase tracking-[0.24em] text-slate-500">Charges</p>
            <p class="mt-4 text-3xl font-bold text-cyan-400">₦{{ totalCharges.toLocaleString() }}</p>
          </div>
          <div class="rounded-3xl bg-slate-900 p-6 shadow-xl">
            <p class="text-sm uppercase tracking-[0.24em] text-slate-500">Payments</p>
            <p class="mt-4 text-3xl font-bold text-emerald-400">₦{{ totalPayments.toLocaleString() }}</p>
          </div>
          <div class="rounded-3xl bg-slate-900 p-6 shadow-xl">
            <p class="text-sm uppercase tracking-[0.24em] text-slate-500">Outstanding balance</p>
            <p class="mt-4 text-3xl font-bold text-amber-400">₦{{ outstandingBalance.toLocaleString() }}</p>
          </div>
        </div>

        <!-- Record transaction -->
        <div class="rounded-3xl bg-slate-900 p-8 shadow-xl">
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

        <!-- Ledger entries -->
        <div class="rounded-3xl bg-slate-900 p-8 shadow-xl">
          <h2 class="text-2xl font-semibold mb-4">Ledger entries</h2>
          <p class="text-slate-400">Transactions saved locally for this student.</p>
          <div class="mt-6 space-y-4">
            <div v-for="entry in ledgerItems" :key="entry.id" class="rounded-2xl border border-slate-800 bg-slate-950 p-4">
              <div class="flex items-center justify-between gap-4">
                <div class="flex items-center gap-3">
                  <span class="rounded-full px-3 py-1 text-xs font-semibold"
                    :class="entry.entry_type === 'DEBIT' ? 'bg-cyan-500/10 text-cyan-400' : 'bg-emerald-500/10 text-emerald-400'"
                  >
                    {{ entry.entry_type }}
                  </span>
                  <p class="font-semibold">{{ entry.entry_category }}</p>
                </div>
                <p class="font-semibold" :class="entry.entry_type === 'DEBIT' ? 'text-cyan-400' : 'text-emerald-400'">
                  ₦{{ Number(entry.amount).toLocaleString() }}
                </p>
              </div>
              <p class="mt-2 text-slate-400">{{ entry.entry_description || 'No description' }}</p>
              <p class="text-xs text-slate-500 mt-2">Created: {{ new Date(entry.created_at).toLocaleString() }}</p>
            </div>
            <p v-if="ledgerItems.length === 0" class="text-slate-500">No local ledger entries available.</p>
          </div>
        </div>
      </section>
    </div>
  </main>
</template>