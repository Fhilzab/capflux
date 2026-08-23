<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useStudentStore } from '../stores/studentStore';
import { useBillingStore } from '../stores/billingStore';
import { useEnrollmentStore, type HydratedEnrollment } from '../stores/enrollmentStore';
import { useAcademicStore } from '@/stores/academicStore';
import { useDivisionStore } from '@/stores/divisionStore';
import { useGuardianStore } from '@/stores/guardianStore';
import CmButton from '../components/ui/CmButton.vue';
import CmModal from '@/components/ui/CmModal.vue';
import CmStatusChip from '@/components/ui/CmStatusChip.vue';
import AcademicHistoryList from '@/features/students/components/AcademicHistoryList.vue';
import StudentMovementModal from '@/features/students/components/StudentMovementModal.vue';
import StudentGuardiansCard from '@/features/students/components/StudentGuardiansCard.vue';
import { STATUS_LABELS } from '@/features/students/utils/normalizeStudent';
import { db } from '@/offline/localDb';

type TabName = 'overview' | 'history' | 'guardians' | 'fees' | 'payments' | 'virtual-account';

const route = useRoute();
const router = useRouter();
const studentStore = useStudentStore();
const billingStore = useBillingStore();
const enrollmentStore = useEnrollmentStore();
const academicStore = useAcademicStore();
const divisionStore = useDivisionStore();
const guardianStore = useGuardianStore();

const student = ref<any>(null);
const ledgerItems = ref([]) as any;
const loading = ref(true);
const error = ref('');
const editing = ref(false);
const savingEdit = ref(false);
const archiving = ref(false);
const editMessage = ref('');

// Tabs
const activeTab = ref<TabName>('overview');
const tabs: { name: TabName; label: string }[] = [
  { name: 'overview', label: 'Overview' },
  { name: 'history', label: 'Academic History' },
  { name: 'guardians', label: 'Guardians' },
  { name: 'fees', label: 'Fees' },
  { name: 'payments', label: 'Payments' },
  { name: 'virtual-account', label: 'Virtual Account' },
];

function setTab(tab: TabName) {
  activeTab.value = tab;
}

// Placement + movement modal
const currentEnrollment = ref<HydratedEnrollment | null>(null);
const showMovementModal = ref(false);

const editForm = ref({
  first_name: '',
  last_name: '',
});

const totalCharges = computed(() =>
  ledgerItems.value
    .filter((entry: any) => entry.entry_type === 'DEBIT')
    .reduce((sum: number, entry: any) => sum + Number(entry.amount || 0), 0)
);

const totalPayments = computed(() =>
  ledgerItems.value
    .filter((entry: any) => entry.entry_type === 'CREDIT')
    .reduce((sum: number, entry: any) => sum + Number(entry.amount || 0), 0)
);

const outstandingBalance = computed(() => totalCharges.value - totalPayments.value);

const form = ref({
  entry_type: 'DEBIT',
  amount: '',
  entry_description: '',
});
const saving = ref(false);
const message = ref('');

const divisionRows = computed(() =>
  (divisionStore.divisions ?? []).map((d: any) => ({
    id: d.id,
    school_id: d.schoolId ?? d.school_id,
    name: d.name,
    code: d.code ?? '',
    display_order: d.displayOrder ?? d.display_order ?? 0,
    description: d.description ?? null,
    status: d.status,
    created_at: d.createdAt ?? d.created_at ?? new Date().toISOString(),
    updated_at: d.updatedAt ?? d.updated_at ?? new Date().toISOString(),
  }))
);

/** Load the student directly by ID — no full-table scans. */
const loadStudent = async () => {
  try {
    loading.value = true;
    error.value = '';
    const studentId = route.params.id as string;

    const [record] = await Promise.all([
      db.students.get(studentId),
      academicStore.initialize(),
      divisionStore.initialize(),
      guardianStore.initialize(),
    ]);

    if (!record) {
      error.value = 'Student not found.';
      return;
    }

    // Join guardian locally.
    let guardian = null;
    if ((record as any).guardian_id) {
      guardian = (await db.guardians.get((record as any).guardian_id)) ?? null;
    }
    student.value = { ...record, guardian };
    editForm.value = {
      first_name: student.value.first_name || '',
      last_name: student.value.last_name || '',
    };

    // Placement + history.
    await enrollmentStore.loadHistory(studentId);
    currentEnrollment.value = enrollmentStore.current[studentId] ?? null;
    await guardianStore.loadLinksForStudent(studentId);

    ledgerItems.value = await billingStore.loadStudentLedger(studentId);
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
    const result = await studentStore.updateStudent(student.value.id, {
      firstName: editForm.value.first_name,
      lastName: editForm.value.last_name,
    });
    if (result === false && studentStore.error) {
      throw new Error(studentStore.error);
    }
    await loadStudent();
    editing.value = false;
    editMessage.value = 'Student updated successfully.';
  } catch (err) {
    editMessage.value = err instanceof Error ? err.message : String(err);
  } finally {
    savingEdit.value = false;
  }
};

const archiveStudent = async (archive: boolean) => {
  if (!student.value) return;
  archiving.value = true;
  editMessage.value = '';

  try {
    if (archive) {
      await studentStore.deactivateStudent(student.value.id);
    } else {
      await studentStore.activateStudent(student.value.id);
    }
    await loadStudent();
    editMessage.value = archive ? 'Student archived.' : 'Student restored.';
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

  await billingStore.createCharge({
    school_id: student.value.school_id || student.value.schoolId || '',
    student_id: student.value.id,
    amount: Number(form.value.amount),
    entry_type: form.value.entry_type as 'DEBIT' | 'CREDIT',
    entry_category: form.value.entry_type === 'DEBIT' ? 'TUITION' : 'PAYMENT',
    entry_description: form.value.entry_description,
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

function onMoved() {
  void loadStudent();
}

onMounted(loadStudent);
</script>

<template>
  <main class="min-h-screen bg-background text-text-primary transition-colors duration-200">
    <div class="mx-auto max-w-5xl space-y-6 p-6 lg:p-8">
      <!-- Header -->
      <section class="rounded-card bg-card p-6 shadow-card transition-colors duration-200 sm:p-8">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 class="text-2xl font-semibold text-text-primary sm:text-3xl">
              {{ student?.first_name }} {{ student?.last_name }}
            </h1>
            <p class="mt-1 text-sm text-text-muted">
              {{ student?.admission_number || student?.id }}
            </p>
          </div>
          <CmButton variant="secondary" @click="router.push({ name: 'Students' })">
            &larr; Back to students
          </CmButton>
        </div>
      </section>

      <!-- Loading / Error -->
      <section v-if="loading" class="rounded-card bg-card p-8 shadow-card">
        <p class="text-text-muted">Loading student details...</p>
      </section>
      <section v-else-if="error" class="rounded-card bg-card p-8 shadow-card">
        <p class="text-danger">{{ error }}</p>
        <CmButton class="mt-4" variant="secondary" @click="loadStudent">Retry</CmButton>
      </section>

      <template v-else>
        <!-- Tabs -->
        <nav class="flex gap-1 overflow-x-auto border-b border-divider bg-card px-4 pt-3 rounded-t-card">
          <button
            v-for="tab in tabs"
            :key="tab.name"
            class="whitespace-nowrap border-b-2 px-3 pb-3 pt-1 text-sm font-medium transition-colors"
            :class="
              activeTab === tab.name
                ? 'border-brand text-brand'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            "
            @click="setTab(tab.name)"
          >
            {{ tab.label }}
          </button>
        </nav>

        <!-- OVERVIEW -->
        <section v-show="activeTab === 'overview'" class="space-y-6">
          <!-- Identity + status -->
          <div class="rounded-card bg-card p-6 shadow-card sm:p-8">
            <div class="mb-6 flex items-center justify-between">
              <h2 class="text-lg font-semibold text-text-primary">Student information</h2>
              <div class="flex gap-2">
                <CmButton v-if="!editing" variant="secondary" @click="startEditing">Edit</CmButton>
                <CmButton
                  v-if="student.status === 'ACTIVE'"
                  variant="danger"
                  :disabled="archiving"
                  @click="archiveStudent(true)"
                >
                  {{ archiving ? 'Archiving...' : 'Archive' }}
                </CmButton>
                <CmButton
                  v-else
                  variant="success"
                  :disabled="archiving"
                  @click="archiveStudent(false)"
                >
                  {{ archiving ? 'Restoring...' : 'Restore' }}
                </CmButton>
              </div>
            </div>

            <div v-if="editing" class="grid gap-4 sm:grid-cols-2">
              <label class="block">
                <span class="text-sm text-text-muted">First name</span>
                <input
                  v-model="editForm.first_name"
                  class="mt-2 w-full rounded-button border border-border bg-surface px-4 py-3 text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </label>
              <label class="block">
                <span class="text-sm text-text-muted">Last name</span>
                <input
                  v-model="editForm.last_name"
                  class="mt-2 w-full rounded-button border border-border bg-surface px-4 py-3 text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </label>
              <div class="sm:col-span-2 flex gap-3">
                <CmButton variant="success" :disabled="savingEdit" @click="saveEdit">
                  {{ savingEdit ? 'Saving...' : 'Save changes' }}
                </CmButton>
                <CmButton variant="secondary" @click="cancelEditing">Cancel</CmButton>
              </div>
            </div>

            <div v-else class="grid gap-4 sm:grid-cols-2">
              <div>
                <p class="text-sm text-text-muted">Status</p>
                <div class="mt-2">
                  <CmStatusChip :status="student.status" />
                  <span v-if="student.status !== 'ACTIVE'" class="ml-2 text-xs text-text-muted">
                    {{ STATUS_LABELS[student.status] || student.status }}
                  </span>
                </div>
              </div>
              <div>
                <p class="text-sm text-text-muted">Gender</p>
                <p class="mt-1 text-text-secondary">{{ student.gender || '—' }}</p>
              </div>
              <div>
                <p class="text-sm text-text-muted">Date of birth</p>
                <p class="mt-1 text-text-secondary">{{ student.date_of_birth || '—' }}</p>
              </div>
              <div>
                <p class="text-sm text-text-muted">Admission date</p>
                <p class="mt-1 text-text-secondary">{{ student.admission_date?.slice(0, 10) || '—' }}</p>
              </div>
            </div>
            <p v-if="editMessage" class="mt-4 text-sm text-success">{{ editMessage }}</p>
          </div>

          <!-- Academic placement card -->
          <div class="rounded-card bg-card p-6 shadow-card sm:p-8">
            <div class="flex items-start justify-between gap-4">
              <h2 class="text-lg font-semibold text-text-primary">Academic placement</h2>
              <CmButton variant="secondary" size="sm" @click="showMovementModal = true">
                Change placement
              </CmButton>
            </div>
            <div v-if="currentEnrollment" class="mt-4 grid gap-4 sm:grid-cols-3">
              <div class="rounded-card border border-divider bg-background px-4 py-3">
                <p class="text-xs uppercase tracking-wider text-text-muted">Session</p>
                <p class="mt-1 text-sm font-medium text-text-primary">
                  {{ currentEnrollment.session?.name ?? '—' }}
                </p>
              </div>
              <div class="rounded-card border border-divider bg-background px-4 py-3">
                <p class="text-xs uppercase tracking-wider text-text-muted">Section</p>
                <p class="mt-1 text-sm font-medium text-text-primary">
                  {{ currentEnrollment.section?.name ?? '—' }}
                </p>
              </div>
              <div class="rounded-card border border-divider bg-background px-4 py-3">
                <p class="text-xs uppercase tracking-wider text-text-muted">Level</p>
                <p class="mt-1 text-sm font-medium text-text-primary">
                  {{ currentEnrollment.level?.name ?? '—' }}
                </p>
              </div>
            </div>
            <p v-else class="mt-4 text-sm text-text-muted">
              No academic placement recorded. Use “Change placement” to enroll this student.
            </p>
          </div>

          <!-- Balances -->
          <div class="grid gap-6 lg:grid-cols-3">
            <div class="rounded-card bg-card p-6 shadow-card">
              <p class="text-sm uppercase tracking-[0.24em] text-text-muted">Charges</p>
              <p class="mt-4 text-3xl font-bold text-primary">₦{{ totalCharges.toLocaleString() }}</p>
            </div>
            <div class="rounded-card bg-card p-6 shadow-card">
              <p class="text-sm uppercase tracking-[0.24em] text-text-muted">Payments</p>
              <p class="mt-4 text-3xl font-bold text-success">₦{{ totalPayments.toLocaleString() }}</p>
            </div>
            <div class="rounded-card bg-card p-6 shadow-card">
              <p class="text-sm uppercase tracking-[0.24em] text-text-muted">Outstanding balance</p>
              <p class="mt-4 text-3xl font-bold text-warning">₦{{ outstandingBalance.toLocaleString() }}</p>
            </div>
          </div>

          <!-- Record transaction -->
          <div class="rounded-card bg-card p-6 shadow-card sm:p-8">
            <h2 class="text-lg font-semibold text-text-primary">Record transaction</h2>
            <p class="mt-1 text-sm text-text-muted">Add a charge or payment for this student locally.</p>
            <div class="mt-4 grid gap-4 sm:grid-cols-2">
              <label class="block">
                <span class="text-sm text-text-muted">Type</span>
                <select
                  v-model="form.entry_type"
                  class="mt-2 w-full rounded-button border border-border bg-surface px-4 py-3 text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="DEBIT">Charge</option>
                  <option value="CREDIT">Payment</option>
                </select>
              </label>
              <label class="block">
                <span class="text-sm text-text-muted">Amount</span>
                <input
                  v-model="form.amount"
                  type="number"
                  min="0"
                  step="0.01"
                  class="mt-2 w-full rounded-button border border-border bg-surface px-4 py-3 text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </label>
              <label class="block sm:col-span-2">
                <span class="text-sm text-text-muted">Description</span>
                <input
                  v-model="form.entry_description"
                  class="mt-2 w-full rounded-button border border-border bg-surface px-4 py-3 text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </label>
            </div>
            <div class="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <CmButton variant="primary" :disabled="saving" @click="submitEntry">
                {{ saving ? 'Saving...' : 'Record transaction' }}
              </CmButton>
              <p v-if="message" class="text-sm text-success">{{ message }}</p>
            </div>
          </div>

          <!-- Ledger entries -->
          <div class="rounded-card bg-card p-6 shadow-card sm:p-8">
            <h2 class="text-lg font-semibold text-text-primary">Ledger entries</h2>
            <div class="mt-4 space-y-4">
              <div
                v-for="entry in ledgerItems"
                :key="entry.id"
                class="rounded-card border border-divider bg-card p-4"
              >
                <div class="flex items-center justify-between gap-4">
                  <div class="flex items-center gap-3">
                    <span
                      class="rounded-full px-3 py-1 text-xs font-semibold"
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
                <p class="mt-2 text-xs text-text-muted">Created: {{ new Date(entry.created_at).toLocaleString() }}</p>
              </div>
              <p v-if="ledgerItems.length === 0" class="text-text-muted">No local ledger entries available.</p>
            </div>
          </div>
        </section>

        <!-- ACADEMIC HISTORY -->
        <section v-show="activeTab === 'history'" class="rounded-card bg-card p-6 shadow-card sm:p-8">
          <h2 class="text-lg font-semibold text-text-primary">Academic history</h2>
          <p class="mt-1 text-sm text-text-muted">
            Every placement change is preserved — history is never overwritten.
          </p>
          <div class="mt-4">
            <AcademicHistoryList :history="enrollmentStore.history[student.id] ?? []" />
          </div>
        </section>

        <!-- GUARDIANS -->
        <section v-show="activeTab === 'guardians'" class="rounded-card bg-card p-6 shadow-card sm:p-8">
          <StudentGuardiansCard :student-id="student.id" />
        </section>

        <!-- FEES -->
        <section v-show="activeTab === 'fees'" class="rounded-card bg-card p-6 shadow-card sm:p-8">
          <h2 class="text-lg font-semibold text-text-primary">Fees</h2>
          <p class="mt-1 text-sm text-text-muted">
            Applicable fees follow the student's current academic level.
          </p>
          <p class="mt-4 text-sm text-text-muted">
            Fee templates for this level are managed under Billing. Charges appear in the ledger on
            the Overview tab.
          </p>
        </section>

        <!-- PAYMENTS -->
        <section v-show="activeTab === 'payments'" class="rounded-card bg-card p-6 shadow-card sm:p-8">
          <h2 class="text-lg font-semibold text-text-primary">Payments</h2>
          <div class="mt-4 space-y-2">
            <div
              v-for="entry in ledgerItems.filter((e: any) => e.entry_type === 'CREDIT')"
              :key="`pay-${entry.id}`"
              class="flex items-center justify-between rounded-card border border-divider bg-background px-4 py-3"
            >
              <div>
                <p class="text-sm font-medium text-text-primary">{{ entry.entry_category }}</p>
                <p class="text-xs text-text-muted">{{ new Date(entry.created_at).toLocaleString() }}</p>
              </div>
              <p class="font-semibold text-success">₦{{ Number(entry.amount).toLocaleString() }}</p>
            </div>
            <p v-if="totalPayments === 0" class="text-sm text-text-muted">No payments recorded yet.</p>
          </div>
        </section>

        <!-- VIRTUAL ACCOUNT -->
        <section v-show="activeTab === 'virtual-account'" class="rounded-card bg-card p-6 shadow-card sm:p-8">
          <h2 class="text-lg font-semibold text-text-primary">Virtual account</h2>
          <div
            v-if="student.dva_account_number || student.virtual_account_number"
            class="mt-4 rounded-card border border-divider bg-background px-4 py-3"
          >
            <p class="text-xs uppercase tracking-wider text-text-muted">Account number</p>
            <p class="mt-1 font-mono text-lg font-semibold text-text-primary">
              {{ student.dva_account_number || student.virtual_account_number }}
            </p>
            <p v-if="student.dva_bank_name || student.bank_name" class="text-sm text-text-secondary">
              {{ student.dva_bank_name || student.bank_name }}
            </p>
          </div>
          <p v-else class="mt-4 text-sm text-text-muted">
            No virtual account provisioned for this student yet.
          </p>
        </section>
      </template>
    </div>

    <!-- Movement modal -->
    <StudentMovementModal
      v-if="student"
      v-model="showMovementModal"
      :student-id="student.id"
      :current="currentEnrollment"
      :sections="divisionRows"
      @moved="onMoved"
    />
  </main>
</template>
