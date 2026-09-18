<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useStudentStore } from '../stores/studentStore';
import { useBillingStore } from '../stores/billingStore';
import { useEnrollmentStore, type HydratedEnrollment } from '../stores/enrollmentStore';
import { useAcademicStore } from '@/stores/academicStore';
import { useDivisionStore } from '@/stores/divisionStore';
import { useGuardianStore } from '@/stores/guardianStore';
import { usePaymentsStore } from '@/stores/paymentsStore';
import { ArrowLeft, CheckCircle, Clock3, AlertCircle, ReceiptText, RefreshCw } from '@lucide/vue';
import CmButton from '../components/ui/CmButton.vue';
import CmStatusChip from '@/components/ui/CmStatusChip.vue';
import CmAlert from '@/components/ui/CmAlert.vue';
import AcademicHistoryList from '@/features/students/components/AcademicHistoryList.vue';
import StudentMovementModal from '@/features/students/components/StudentMovementModal.vue';
import StudentGuardiansCard from '@/features/students/components/StudentGuardiansCard.vue';
import { STATUS_LABELS, STATUS_CHIP_VARIANTS } from '@/features/students/utils/normalizeStudent';
import {
  summarizeLedger,
  getEntryAmountMinor,
  getEntryDate,
  isChargeEntry,
  isPaymentCreditEntry,
  formatNairaKobo,
} from '@/lib/ledgerSemantics';
import { db } from '@/offline/localDb';

const route = useRoute();
const router = useRouter();
const studentStore = useStudentStore();
const billingStore = useBillingStore();
const enrollmentStore = useEnrollmentStore();
const academicStore = useAcademicStore();
const divisionStore = useDivisionStore();
const guardianStore = useGuardianStore();
const paymentsStore = usePaymentsStore();

const student = ref<any>(null);
const ledgerItems = ref<any[]>([]);
const ledgerError = ref('');
const historyError = ref('');
const dvaError = ref('');
const loading = ref(true);
const error = ref('');
const editing = ref(false);
const savingEdit = ref(false);
const archiving = ref(false);
const editMessage = ref('');

// Placement + movement modal
const currentEnrollment = ref<HydratedEnrollment | null>(null);
const showMovementModal = ref(false);

const editForm = ref({
  first_name: '',
  last_name: '',
});

// ── Canonical kobo-safe financial derivation (single source of truth) ──
const ledgerSummary = computed(() => summarizeLedger(ledgerItems.value ?? []));
const totalChargesMinor = computed(() => ledgerSummary.value.assessedMinor);
const totalPaymentsMinor = computed(() => ledgerSummary.value.collectedMinor);
const outstandingMinor = computed(() => ledgerSummary.value.outstandingMinor);

const collectionPct = computed(() => {
  const assessed = totalChargesMinor.value;
  if (assessed <= 0) return 0;
  return Math.min(100, Math.round((totalPaymentsMinor.value / assessed) * 100));
});

type ChipStatus = 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'pending';

const financialStatus = computed<{ key: string; label: string; chip: ChipStatus }>(() => {
  if (ledgerError.value) return { key: 'unavailable', label: 'Data unavailable', chip: 'neutral' };
  const assessed = totalChargesMinor.value;
  const collected = totalPaymentsMinor.value;
  const outstanding = outstandingMinor.value;
  if (assessed === 0 && collected === 0)
    return { key: 'no-records', label: 'No billing records', chip: 'neutral' };
  if (assessed > 0 && outstanding <= 0) return { key: 'paid', label: 'Paid', chip: 'success' };
  if (collected > 0) return { key: 'partial', label: 'Partially paid', chip: 'warning' };
  return { key: 'outstanding', label: 'Outstanding', chip: 'error' };
});

const statusChip = computed<{ status: ChipStatus; label: string }>(() => {
  const raw = String(student.value?.status ?? 'ACTIVE');
  const variant = (STATUS_CHIP_VARIANTS[raw] ?? 'info') as ChipStatus;
  return { status: variant, label: STATUS_LABELS[raw] || raw };
});

const recentPayments = computed(() =>
  (ledgerItems.value ?? [])
    .filter((e: any) => isPaymentCreditEntry(e))
    .slice()
    .sort((a: any, b: any) => String(getEntryDate(b) ?? '').localeCompare(String(getEntryDate(a) ?? '')))
    .slice(0, 5)
);

const recentCharges = computed(() =>
  (ledgerItems.value ?? [])
    .filter((e: any) => isChargeEntry(e))
    .slice()
    .sort((a: any, b: any) => String(getEntryDate(b) ?? '').localeCompare(String(getEntryDate(a) ?? '')))
    .slice(0, 3)
);

// ── Virtual account (masked; authoritative status opportunistically loaded) ──
const rawAccountNumber = computed(
  () => student.value?.dva_account_number || student.value?.virtual_account_number || ''
);
const maskedAccountNumber = computed(() => {
  const digits = String(rawAccountNumber.value).replace(/\D/g, '');
  if (!digits) return '';
  return `•••• •••• ${digits.slice(-4)}`;
});
const dvaBankName = computed(() => student.value?.dva_bank_name || student.value?.bank_name || '');
const backendDva = computed(() => {
  if (!student.value) return null;
  return (
    (paymentsStore.dvAccounts ?? []).find((a: any) => {
      const sid = a.student_id ?? a.studentId ?? a.students?.id ?? '';
      return sid === student.value.id;
    }) ?? null
  );
});
const dvaStatusChip = computed<{ status: ChipStatus; label: string } | null>(() => {
  const s = String(backendDva.value?.status ?? '');
  if (!s) return null;
  if (s === 'ACTIVE') return { status: 'success', label: 'Active' };
  if (s === 'PENDING' || s === 'PROVISIONING') return { status: 'pending', label: s };
  if (s === 'FAILED') return { status: 'error', label: 'Failed' };
  if (s === 'DISABLED') return { status: 'warning', label: 'Disabled' };
  return { status: 'neutral', label: s };
});
const provisioning = ref(false);
const provisionMessage = ref('');

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

const placementLine = computed(() => {
  const parts = [
    currentEnrollment.value?.level?.name ?? '',
    currentEnrollment.value?.session?.name ?? '',
  ].filter(Boolean);
  return parts.join(' · ');
});

/** Load the student directly by ID — no full-table scans. Secondary sections
 *  load independently so one failure never destroys the whole overview. */
const loadStudent = async () => {
  try {
    loading.value = true;
    error.value = '';
    ledgerError.value = '';
    historyError.value = '';
    dvaError.value = '';
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

    // Placement, ledger, guardian links and virtual-account status resolve
    // independently — each section owns its error state.
    await Promise.allSettled([
      (async () => {
        try {
          await enrollmentStore.loadHistory(studentId);
          if (enrollmentStore.error) throw new Error(enrollmentStore.error);
          currentEnrollment.value = enrollmentStore.current[studentId] ?? null;
        } catch (e) {
          historyError.value = e instanceof Error ? e.message : 'Unable to load academic history.';
        }
      })(),
      (async () => {
        try {
          ledgerItems.value = (await billingStore.loadStudentLedger(studentId)) ?? [];
          if (billingStore.error) throw new Error(billingStore.error);
        } catch (e) {
          ledgerError.value = e instanceof Error ? e.message : 'Unable to load financial records.';
          ledgerItems.value = [];
        }
      })(),
      (async () => {
        try {
          await guardianStore.loadLinksForStudent(studentId);
        } catch {
          // StudentGuardiansCard owns its visible error state.
        }
      })(),
      (async () => {
        try {
          await paymentsStore.loadDVAccounts();
          if (paymentsStore.error) throw new Error(paymentsStore.error);
        } catch (e) {
          dvaError.value = e instanceof Error ? e.message : 'Unable to load virtual-account status.';
        }
      })(),
    ]);
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err);
  } finally {
    loading.value = false;
  }
};

const retryLedger = async () => {
  if (!student.value) return;
  ledgerError.value = '';
  try {
    ledgerItems.value = (await billingStore.loadStudentLedger(student.value.id)) ?? [];
    if (billingStore.error) throw new Error(billingStore.error);
  } catch (e) {
    ledgerError.value = e instanceof Error ? e.message : 'Unable to load financial records.';
  }
};

const retryDva = async () => {
  dvaError.value = '';
  try {
    await paymentsStore.loadDVAccounts();
    if (paymentsStore.error) throw new Error(paymentsStore.error);
  } catch (e) {
    dvaError.value = e instanceof Error ? e.message : 'Unable to load virtual-account status.';
  }
};

const provisionAccount = async () => {
  if (!student.value) return;
  provisioning.value = true;
  provisionMessage.value = '';
  try {
    await paymentsStore.provisionDVA(student.value.id);
    provisionMessage.value = 'Provisioning requested. Track progress under Virtual Accounts.';
  } catch (e) {
    provisionMessage.value =
      e instanceof Error ? e.message : 'Unable to provision a virtual account right now.';
  } finally {
    provisioning.value = false;
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

function goBilling() {
  router.push({ name: 'Billing', query: { student: student.value.id } });
}

function goPayments() {
  router.push({ name: 'Payments', query: { student: student.value.id } });
}

function goVirtualAccounts() {
  router.push({ name: 'VirtualAccounts', query: { student: student.value.id } });
}

function backToStudents() {
  router.push({ name: 'Students' });
}

function formatDate(iso: string | undefined): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return String(iso);
  }
}

function entryAmount(entry: any): string {
  return formatNairaKobo(getEntryAmountMinor(entry));
}

function onMoved() {
  void loadStudent();
}

onMounted(loadStudent);
</script>

<template>
  <main class="min-h-screen bg-background text-text-primary transition-colors duration-200">
    <div class="mx-auto max-w-5xl space-y-6 p-6 lg:p-8">
      <!-- Back -->
      <div>
        <CmButton variant="link" size="sm" @click="backToStudents">
          <span class="flex min-h-[44px] items-center gap-1.5">
            <ArrowLeft class="size-4" aria-hidden="true" /> Students
          </span>
        </CmButton>
      </div>

      <!-- Loading / Error -->
      <section
        v-if="loading"
        class="rounded-card bg-card p-8 shadow-card"
        aria-label="Loading student"
      >
        <p class="text-text-muted">Loading student details...</p>
      </section>
      <section v-else-if="error" class="rounded-card bg-card p-8 shadow-card" aria-label="Error">
        <p class="text-danger">{{ error }}</p>
        <CmButton class="mt-4 min-h-[44px]" variant="secondary" @click="loadStudent">Retry</CmButton>
      </section>

      <template v-else>
        <!-- 1. IDENTITY -->
        <section
          class="rounded-card bg-card p-6 shadow-card transition-colors duration-200 sm:p-8"
          aria-labelledby="student-name"
        >
          <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 id="student-name" class="text-2xl font-semibold text-text-primary sm:text-3xl">
                {{ student?.first_name }} {{ student?.last_name }}
              </h1>
              <p class="mt-1 text-sm text-text-muted">
                Admission ID: {{ student?.admission_number || student?.id }}
              </p>
              <p v-if="placementLine" class="mt-1 text-sm font-medium text-text-secondary">
                {{ placementLine }}
              </p>
              <div class="mt-2 flex items-center gap-2">
                <CmStatusChip v-bind="statusChip" size="sm" />
              </div>
            </div>
            <div class="flex flex-wrap gap-2">
              <CmButton
                v-if="!editing"
                variant="secondary"
                class="min-h-[44px]"
                @click="startEditing"
              >
                Edit student
              </CmButton>
              <CmButton
                v-if="student.status === 'ACTIVE'"
                variant="danger"
                class="min-h-[44px]"
                :disabled="archiving"
                @click="archiveStudent(true)"
              >
                {{ archiving ? 'Archiving...' : 'Archive' }}
              </CmButton>
              <CmButton
                v-else
                variant="success"
                class="min-h-[44px]"
                :disabled="archiving"
                @click="archiveStudent(false)"
              >
                {{ archiving ? 'Restoring...' : 'Restore' }}
              </CmButton>
            </div>
          </div>

          <div v-if="editing" class="mt-6 grid gap-4 sm:grid-cols-2">
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
              <CmButton
                variant="success"
                class="min-h-[44px]"
                :disabled="savingEdit"
                @click="saveEdit"
              >
                {{ savingEdit ? 'Saving...' : 'Save changes' }}
              </CmButton>
              <CmButton variant="secondary" class="min-h-[44px]" @click="cancelEditing">
                Cancel
              </CmButton>
            </div>
          </div>
          <p v-if="editMessage" class="mt-4 text-sm text-success">{{ editMessage }}</p>
        </section>

        <!-- 2. FINANCIAL POSITION -->
        <section
          class="rounded-card bg-card p-6 shadow-card sm:p-8"
          aria-labelledby="financial-position"
        >
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h2 id="financial-position" class="text-lg font-semibold text-text-primary">
              Financial position
            </h2>
            <span
              class="inline-flex items-center gap-1.5 text-sm font-medium"
              :class="{
                'text-success': financialStatus.key === 'paid',
                'text-warning':
                  financialStatus.key === 'partial' || financialStatus.key === 'outstanding',
                'text-danger': financialStatus.key === 'unavailable',
                'text-text-muted':
                  financialStatus.key === 'no-records',
              }"
            >
              <CheckCircle
                v-if="financialStatus.key === 'paid'"
                class="size-4"
                aria-hidden="true"
              />
              <Clock3
                v-else-if="financialStatus.key === 'partial'"
                class="size-4"
                aria-hidden="true"
              />
              <AlertCircle
                v-else-if="
                  financialStatus.key === 'outstanding' || financialStatus.key === 'unavailable'
                "
                class="size-4"
                aria-hidden="true"
              />
              <ReceiptText v-else class="size-4" aria-hidden="true" />
              {{ financialStatus.label }}
            </span>
          </div>

          <div v-if="ledgerError" class="mt-4">
            <CmAlert
              variant="danger"
              title="Unable to load financial records"
              :description="ledgerError"
              :dismissible="false"
            />
            <CmButton variant="secondary" size="sm" class="mt-3 min-h-[44px]" @click="retryLedger">
              <span class="flex items-center gap-1.5">
                <RefreshCw class="size-4" aria-hidden="true" /> Retry
              </span>
            </CmButton>
          </div>

          <div v-else class="mt-4 grid gap-4 sm:grid-cols-3">
            <div class="rounded-card border border-divider bg-background px-4 py-4">
              <p class="text-xs uppercase tracking-wider text-text-muted">Expected</p>
              <p class="mt-1 text-2xl font-bold text-text-primary">
                {{ formatNairaKobo(totalChargesMinor) }}
              </p>
              <p class="mt-1 text-xs text-text-muted">Ledger charges</p>
            </div>
            <div class="rounded-card border border-divider bg-background px-4 py-4">
              <p class="text-xs uppercase tracking-wider text-text-muted">Paid</p>
              <p class="mt-1 text-2xl font-bold text-success">
                {{ formatNairaKobo(totalPaymentsMinor) }}
              </p>
              <p class="mt-1 text-xs text-text-muted">Ledger payments</p>
            </div>
            <div class="rounded-card border border-divider bg-background px-4 py-4">
              <p class="text-xs uppercase tracking-wider text-text-muted">Outstanding</p>
              <p class="mt-1 text-2xl font-bold text-warning">
                {{ formatNairaKobo(outstandingMinor) }}
              </p>
              <p class="mt-1 text-xs text-text-muted">Expected minus paid</p>
            </div>
          </div>

          <div v-if="!ledgerError && totalChargesMinor > 0" class="mt-4">
            <div
              class="h-2 overflow-hidden rounded-full bg-surface"
              role="progressbar"
              :aria-valuenow="collectionPct"
              aria-valuemin="0"
              aria-valuemax="100"
              :aria-label="`${collectionPct} percent collected`"
            >
              <div class="h-full rounded-full bg-success" :style="{ width: `${collectionPct}%` }" />
            </div>
            <p class="mt-2 text-sm text-text-secondary">{{ collectionPct }}% collected</p>
          </div>
        </section>

        <!-- STUDENT INFORMATION -->
        <section
          class="rounded-card bg-card p-6 shadow-card sm:p-8"
          aria-labelledby="student-information"
        >
          <h2 id="student-information" class="text-lg font-semibold text-text-primary">
            Student information
          </h2>
          <dl class="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <dt class="text-sm text-text-muted">Admission ID</dt>
              <dd class="mt-1 text-text-secondary">{{ student.admission_number || '—' }}</dd>
            </div>
            <div>
              <dt class="text-sm text-text-muted">Class</dt>
              <dd class="mt-1 text-text-secondary">
                {{ currentEnrollment?.level?.name || student.class_name || '—' }}
              </dd>
            </div>
            <div>
              <dt class="text-sm text-text-muted">Academic session</dt>
              <dd class="mt-1 text-text-secondary">
                {{ currentEnrollment?.session?.name || '—' }}
              </dd>
            </div>
            <div>
              <dt class="text-sm text-text-muted">Enrollment status</dt>
              <dd class="mt-1 text-text-secondary">
                {{ currentEnrollment?.enrollment?.status || student.status || '—' }}
              </dd>
            </div>
            <div>
              <dt class="text-sm text-text-muted">Gender</dt>
              <dd class="mt-1 text-text-secondary">{{ student.gender || '—' }}</dd>
            </div>
            <div>
              <dt class="text-sm text-text-muted">Admission date</dt>
              <dd class="mt-1 text-text-secondary">
                {{ student.admission_date?.slice(0, 10) || '—' }}
              </dd>
            </div>
          </dl>
        </section>

        <!-- 3. GUARDIAN + 6. VIRTUAL ACCOUNT -->
        <div class="grid gap-6 lg:grid-cols-2">
          <section
            class="rounded-card bg-card p-6 shadow-card sm:p-8"
            aria-labelledby="guardian-heading"
          >
            <h2 id="guardian-heading" class="sr-only">Guardian</h2>
            <StudentGuardiansCard :student-id="student.id" />
          </section>

          <section
            class="rounded-card bg-card p-6 shadow-card sm:p-8"
            aria-labelledby="virtual-account"
          >
            <h2 id="virtual-account" class="text-lg font-semibold text-text-primary">
              Virtual account
            </h2>
            <p class="mt-1 text-sm text-text-muted">Dedicated account for fee payments.</p>

            <div v-if="dvaError && !rawAccountNumber" class="mt-4">
              <CmAlert
                variant="danger"
                title="Virtual-account status unavailable"
                :description="dvaError"
                :dismissible="false"
              />
              <CmButton variant="secondary" size="sm" class="mt-3 min-h-[44px]" @click="retryDva">
                <span class="flex items-center gap-1.5">
                  <RefreshCw class="size-4" aria-hidden="true" /> Retry
                </span>
              </CmButton>
            </div>

            <div
              v-else-if="rawAccountNumber"
              class="mt-4 rounded-card border border-divider bg-background px-4 py-4"
            >
              <p class="text-xs uppercase tracking-wider text-text-muted">Account number</p>
              <p class="mt-1 font-mono text-lg font-semibold text-text-primary">
                {{ maskedAccountNumber }}
              </p>
              <p v-if="dvaBankName" class="mt-1 text-sm text-text-secondary">{{ dvaBankName }}</p>
              <div v-if="dvaStatusChip" class="mt-2">
                <CmStatusChip v-bind="dvaStatusChip" size="sm" />
              </div>
              <CmButton variant="link" size="sm" class="mt-2 min-h-[44px] px-0" @click="goVirtualAccounts">
                View account
              </CmButton>
            </div>

            <div v-else class="mt-4">
              <p class="text-sm text-text-secondary">Not provisioned yet.</p>
              <CmButton
                variant="primary"
                size="sm"
                class="mt-3 min-h-[44px]"
                :disabled="provisioning"
                @click="provisionAccount"
              >
                {{ provisioning ? 'Provisioning...' : 'Provision account' }}
              </CmButton>
              <p v-if="provisionMessage" class="mt-2 text-sm text-text-secondary">
                {{ provisionMessage }}
              </p>
              <CmButton variant="link" size="sm" class="mt-1 min-h-[44px] px-0" @click="goVirtualAccounts">
                View accounts
              </CmButton>
            </div>
          </section>
        </div>

        <!-- 4. FEES + 5. RECENT PAYMENTS -->
        <div class="grid gap-6 lg:grid-cols-2">
          <section class="rounded-card bg-card p-6 shadow-card sm:p-8" aria-labelledby="fees">
            <h2 id="fees" class="text-lg font-semibold text-text-primary">Fees</h2>
            <p class="mt-1 text-sm text-text-muted">Charges for this student.</p>

            <div v-if="ledgerError" class="mt-4">
              <p class="text-sm text-text-secondary">Billing data unavailable.</p>
              <CmButton variant="secondary" size="sm" class="mt-3 min-h-[44px]" @click="retryLedger">
                <span class="flex items-center gap-1.5">
                  <RefreshCw class="size-4" aria-hidden="true" /> Retry
                </span>
              </CmButton>
            </div>

            <template v-else>
              <dl class="mt-4 space-y-2 text-sm">
                <div class="flex items-center justify-between gap-4">
                  <dt class="text-text-muted">Expected</dt>
                  <dd class="font-semibold text-text-primary">
                    {{ formatNairaKobo(totalChargesMinor) }}
                  </dd>
                </div>
                <div class="flex items-center justify-between gap-4">
                  <dt class="text-text-muted">Outstanding</dt>
                  <dd class="font-semibold text-warning">
                    {{ formatNairaKobo(outstandingMinor) }}
                  </dd>
                </div>
              </dl>

              <div v-if="recentCharges.length > 0" class="mt-4 space-y-2">
                <div
                  v-for="entry in recentCharges"
                  :key="entry.id"
                  class="flex items-center justify-between gap-4 rounded-card border border-divider bg-background px-4 py-3"
                >
                  <div class="min-w-0">
                    <p class="truncate text-sm font-medium text-text-primary">
                      {{ entry.entry_category || 'Charge' }}
                    </p>
                    <p class="text-xs text-text-muted">{{ formatDate(getEntryDate(entry)) }}</p>
                  </div>
                  <p class="shrink-0 font-semibold text-text-primary">{{ entryAmount(entry) }}</p>
                </div>
              </div>
              <p v-else class="mt-4 text-sm text-text-muted">No billing records available.</p>

              <CmButton variant="link" size="sm" class="mt-3 min-h-[44px] px-0" @click="goBilling">
                View billing
              </CmButton>
            </template>
          </section>

          <section
            class="rounded-card bg-card p-6 shadow-card sm:p-8"
            aria-labelledby="recent-payments"
          >
            <h2 id="recent-payments" class="text-lg font-semibold text-text-primary">
              Recent payments
            </h2>
            <p class="mt-1 text-sm text-text-muted">Latest payments on this student's ledger.</p>

            <div v-if="ledgerError" class="mt-4">
              <p class="text-sm text-text-secondary">Payment data unavailable.</p>
              <CmButton variant="secondary" size="sm" class="mt-3 min-h-[44px]" @click="retryLedger">
                <span class="flex items-center gap-1.5">
                  <RefreshCw class="size-4" aria-hidden="true" /> Retry
                </span>
              </CmButton>
            </div>

            <template v-else>
              <div v-if="recentPayments.length > 0" class="mt-4 space-y-2">
                <div
                  v-for="entry in recentPayments"
                  :key="entry.id"
                  class="flex items-center justify-between gap-4 rounded-card border border-divider bg-background px-4 py-3"
                >
                  <div class="min-w-0">
                    <p class="truncate text-sm font-medium text-text-primary">
                      {{ entry.entry_category || 'Payment' }}
                    </p>
                    <p class="text-xs text-text-muted">{{ formatDate(getEntryDate(entry)) }}</p>
                  </div>
                  <p class="shrink-0 font-semibold text-success">{{ entryAmount(entry) }}</p>
                </div>
              </div>
              <p v-else-if="totalChargesMinor === 0" class="mt-4 text-sm text-text-muted">
                No billing records available.
              </p>
              <p v-else class="mt-4 text-sm text-text-muted">No payments recorded yet.</p>

              <CmButton
                v-if="recentPayments.length > 0"
                variant="link"
                size="sm"
                class="mt-3 min-h-[44px] px-0"
                @click="goPayments"
              >
                View all payments
              </CmButton>
              <CmButton v-else variant="link" size="sm" class="mt-3 min-h-[44px] px-0" @click="goPayments">
                View payments
              </CmButton>
            </template>
          </section>
        </div>

        <!-- Record transaction (preserved operational action) -->
        <section
          class="rounded-card bg-card p-6 shadow-card sm:p-8"
          aria-labelledby="record-transaction"
        >
          <h2 id="record-transaction" class="text-lg font-semibold text-text-primary">
            Record transaction
          </h2>
          <p class="mt-1 text-sm text-text-muted">Add a charge or payment for this student locally.</p>
          <div class="mt-4 grid gap-4 sm:grid-cols-2">
            <label class="block">
              <span class="text-sm text-text-muted">Type</span>
              <select
                v-model="form.entry_type"
                class="mt-2 min-h-[44px] w-full rounded-button border border-border bg-surface px-4 py-3 text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
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
                class="mt-2 min-h-[44px] w-full rounded-button border border-border bg-surface px-4 py-3 text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </label>
            <label class="block sm:col-span-2">
              <span class="text-sm text-text-muted">Description</span>
              <input
                v-model="form.entry_description"
                class="mt-2 min-h-[44px] w-full rounded-button border border-border bg-surface px-4 py-3 text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </label>
          </div>
          <div class="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CmButton variant="primary" class="min-h-[44px]" :disabled="saving" @click="submitEntry">
              {{ saving ? 'Saving...' : 'Record transaction' }}
            </CmButton>
            <p v-if="message" class="text-sm text-success">{{ message }}</p>
          </div>
        </section>

        <!-- 7. ACADEMIC INFORMATION / HISTORY -->
        <section
          class="rounded-card bg-card p-6 shadow-card sm:p-8"
          aria-labelledby="academic-history"
        >
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 id="academic-history" class="text-lg font-semibold text-text-primary">
                Academic history
              </h2>
              <p class="mt-1 text-sm text-text-muted">
                Current placement and every preserved placement change.
              </p>
            </div>
            <CmButton variant="secondary" size="sm" class="min-h-[44px]" @click="showMovementModal = true">
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

          <div class="mt-6">
            <div v-if="historyError">
              <CmAlert
                variant="danger"
                title="Unable to load academic history"
                :description="historyError"
                :dismissible="false"
              />
              <CmButton variant="secondary" size="sm" class="mt-3 min-h-[44px]" @click="loadStudent">
                <span class="flex items-center gap-1.5">
                  <RefreshCw class="size-4" aria-hidden="true" /> Retry
                </span>
              </CmButton>
            </div>
            <AcademicHistoryList v-else :history="enrollmentStore.history[student.id] ?? []" />
          </div>
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
