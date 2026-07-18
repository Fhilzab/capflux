<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { StudentService } from '../shared/services/StudentService';
import { BillingService } from '../shared/services/BillingService';
import db from '../offline/localDb';
import CmButton from '../components/ui/CmButton.vue';

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
    const studentRecord = await StudentService.getStudentById(route.params.id);
    if (!studentRecord) {
      error.value = 'Student not found.';
      return;
    }
    student.value = studentRecord;
    editForm.value = {
      first_name: student.value.first_name || '',
      last_name: student.value.last_name || '',
      class_name: student.value.class_name || '',
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
  <main class="min-h-screen bg-background text-text-primary p-8 transition-colors duration-200">
    <div class="max-w-5xl mx-auto space-y-6">
      <section class="rounded-card bg-card p-8 shadow-card transition-colors duration-200">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 class="text-4xl font-semibold text-text-primary">Student details</h1>
            <p class="text-text-muted">Review selected student and local billing ledger.</p>
          </div>
          <CmButton
            @click="router.push({ name: 'Students' })"
            variant="secondary"
          >
            &larr; Back to students
          </CmButton>
        </div>
      </section>

      <section v-if="loading" class="rounded-card bg-card p-8 shadow-card transition-colors duration-200">
        <p class="text-text-muted">Loading student details...</p>
      </section>

      <section v-else-if="error" class="rounded-card bg-card p-8 shadow-card transition-colors duration-200">
        <p class="text-danger">{{ error }}</p>
      </section>

      <section v-else class="space-y-6">
        <!-- Student info and edit form -->
        <div class="rounded-card bg-card p-8 shadow-card transition-colors duration-200">
          <div class="flex items-center justify-between mb-6">
            <h2 class="text-2xl font-semibold text-text-primary">Student Information</h2>
            <div class="flex gap-2">
              <CmButton
                v-if="!editing"
                @click="startEditing"
                variant="primary"
              >
                Edit
              </CmButton>
              <CmButton
                v-if="student.status === 'ACTIVE'"
                @click="archiveStudent('LEFT')"
                :disabled="archiving"
                variant="danger"
              >
                {{ archiving ? 'Archiving...' : 'Archive' }}
              </CmButton>
              <CmButton
                v-if="student.status !== 'ACTIVE'"
                @click="archiveStudent('ACTIVE')"
                :disabled="archiving"
                variant="success"
              >
                {{ archiving ? 'Restoring...' : 'Restore' }}
              </CmButton>
            </div>
          </div>

          <!-- Edit mode -->
          <div v-if="editing" class="grid gap-4 sm:grid-cols-2">
            <label class="block">
              <span class="text-sm text-text-muted">First name</span>
              <input v-model="editForm.first_name" class="mt-2 w-full rounded-button border border-border bg-surface px-4 py-3 text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-glow transition-shadow" />
            </label>
            <label class="block">
              <span class="text-sm text-text-muted">Last name</span>
              <input v-model="editForm.last_name" class="mt-2 w-full rounded-button border border-border bg-surface px-4 py-3 text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-glow transition-shadow" />
            </label>
            <label class="block">
              <span class="text-sm text-text-muted">Class</span>
              <input v-model="editForm.class_name" class="mt-2 w-full rounded-button border border-border bg-surface px-4 py-3 text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-glow transition-shadow" />
            </label>
            <div class="sm:col-span-2 flex gap-3">
              <CmButton @click="saveEdit" :disabled="savingEdit" variant="success">
                {{ savingEdit ? 'Saving...' : 'Save changes' }}
              </CmButton>
              <CmButton @click="cancelEditing" variant="secondary">
                Cancel
              </CmButton>
            </div>
          </div>

          <!-- View mode -->
          <div v-else class="space-y-3">
            <div class="grid gap-4 sm:grid-cols-2">
              <div>
                <p class="text-sm text-text-muted">First name</p>
                <p class="mt-1 text-lg font-semibold text-text-primary">{{ student.first_name }}</p>
              </div>
              <div>
                <p class="text-sm text-text-muted">Last name</p>
                <p class="mt-1 text-lg font-semibold text-text-primary">{{ student.last_name }}</p>
              </div>
              <div>
                <p class="text-sm text-text-muted">Class</p>
                <p class="mt-1 text-text-secondary">{{ student.class_name }}</p>
              </div>
              <div>
                <p class="text-sm text-text-muted">Guardian</p>
                <p class="mt-1 text-text-secondary" v-if="student.guardian_id">
                  <span class="block text-text-primary">{{ student.guardian?.full_name || 'Loading...' }}</span>
                  <span class="text-sm text-text-muted">{{ student.guardian?.primary_phone }} {{ student.guardian?.secondary_phone ? `(${student.guardian?.secondary_phone})` : '' }}</span>
                </p>
                <p class="mt-1 text-text-muted" v-else>-</p>
              </div>
              <div>
                <p class="text-sm text-text-muted">Status</p>
                <span class="mt-1 inline-flex rounded-full px-3 py-1 text-sm font-semibold"
                  :class="{
                    'bg-success/10 text-success': student.status === 'ACTIVE',
                    'bg-border/10 text-text-muted': student.status === 'GRADUATED',
                    'bg-danger/10 text-danger': student.status === 'LEFT',
                  }"
                >
                  {{ student.status }}
                </span>
              </div>
            </div>
          </div>
          <p v-if="editMessage" class="mt-4 text-sm text-success">{{ editMessage }}</p>
        </div>

        <!-- Balance cards -->
        <div class="grid gap-6 lg:grid-cols-3">
          <div class="rounded-card bg-card p-6 shadow-card transition-colors duration-200">
            <p class="text-sm uppercase tracking-[0.24em] text-text-muted">Charges</p>
            <p class="mt-4 text-3xl font-bold text-primary">₦{{ totalCharges.toLocaleString() }}</p>
          </div>
          <div class="rounded-card bg-card p-6 shadow-card transition-colors duration-200">
            <p class="text-sm uppercase tracking-[0.24em] text-text-muted">Payments</p>
            <p class="mt-4 text-3xl font-bold text-success">₦{{ totalPayments.toLocaleString() }}</p>
          </div>
          <div class="rounded-card bg-card p-6 shadow-card transition-colors duration-200">
            <p class="text-sm uppercase tracking-[0.24em] text-text-muted">Outstanding balance</p>
            <p class="mt-4 text-3xl font-bold text-warning">₦{{ outstandingBalance.toLocaleString() }}</p>
          </div>
        </div>

        <!-- Record transaction -->
        <div class="rounded-card bg-card p-8 shadow-card transition-colors duration-200">
          <h2 class="text-2xl font-semibold mb-4 text-text-primary">Record transaction</h2>
          <p class="text-text-muted mb-4">Add a charge or payment for this student locally.</p>
          <div class="grid gap-4 sm:grid-cols-2">
            <label class="block">
              <span class="text-sm text-text-muted">Type</span>
              <select v-model="form.entry_type" class="mt-2 w-full rounded-button border border-border bg-surface px-4 py-3 text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-glow transition-shadow">
                <option value="DEBIT">Charge</option>
                <option value="CREDIT">Payment</option>
              </select>
            </label>
            <label class="block">
              <span class="text-sm text-text-muted">Amount</span>
              <input v-model="form.amount" type="number" min="0" step="0.01" class="mt-2 w-full rounded-button border border-border bg-surface px-4 py-3 text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-glow transition-shadow" />
            </label>
            <label class="block sm:col-span-2">
              <span class="text-sm text-text-muted">Description</span>
              <input v-model="form.entry_description" class="mt-2 w-full rounded-button border border-border bg-surface px-4 py-3 text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-glow transition-shadow" />
            </label>
          </div>
          <div class="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CmButton @click="submitEntry" :disabled="saving" variant="primary">
              {{ saving ? 'Saving...' : 'Record transaction' }}
            </CmButton>
            <p v-if="message" class="text-sm text-success">{{ message }}</p>
          </div>
        </div>

        <!-- Ledger entries -->
        <div class="rounded-card bg-card p-8 shadow-card transition-colors duration-200">
          <h2 class="text-2xl font-semibold mb-4 text-text-primary">Ledger entries</h2>
          <p class="text-text-muted">Transactions saved locally for this student.</p>
          <div class="mt-6 space-y-4">
            <div v-for="entry in ledgerItems" :key="entry.id" class="rounded-card border border-divider bg-card p-4">
              <div class="flex items-center justify-between gap-4">
                <div class="flex items-center gap-3">
                  <span class="rounded-full px-3 py-1 text-xs font-semibold"
                    :class="entry.entry_type === 'DEBIT' ? 'bg-primary/10 text-primary' : 'bg-success/10 text-success'"
                  >
                    {{ entry.entry_type }}
                  </span>
                  <p class="font-semibold text-text-primary">{{ entry.entry_category }}</p>
                </div>
                <p class="font-semibold" :class="entry.entry_type === 'DEBIT' ? 'text-primary' : 'text-success'">
                  ₦{{ Number(entry.amount).toLocaleString() }}
                </p>
              </div>
              <p class="mt-2 text-text-muted">{{ entry.entry_description || 'No description' }}</p>
              <p class="text-xs text-text-muted mt-2">Created: {{ new Date(entry.created_at).toLocaleString() }}</p>
            </div>
            <p v-if="ledgerItems.length === 0" class="text-text-muted">No local ledger entries available.</p>
          </div>
        </div>
      </section>
    </div>
  </main>
</template>