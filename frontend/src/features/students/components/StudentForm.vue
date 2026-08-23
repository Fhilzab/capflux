<template>
  <form
    @submit.prevent="handleSubmit"
    class="grid grid-cols-1 gap-6 sm:grid-cols-2"
  >
    <!-- Student Information -->
    <div class="sm:col-span-2">
      <h4 class="mb-3 text-sm font-medium text-text-primary">Student information</h4>
    </div>

    <div>
      <CmInput
        v-model="form.firstName"
        label="First name *"
        :error="errors.firstName"
        required
      />
    </div>
    <div>
      <CmInput
        v-model="form.middleName"
        label="Middle name"
      />
    </div>
    <div class="sm:col-span-2">
      <CmInput
        v-model="form.lastName"
        label="Last name *"
        :error="errors.lastName"
        required
      />
    </div>

    <div>
      <CmInput
        v-model="form.dateOfBirth"
        label="Date of birth"
        type="date"
        :error="errors.dateOfBirth"
      />
    </div>
    <div>
      <CmInput
        v-model="form.dateOfAdmission"
        label="Admission date"
        type="date"
        :error="errors.admissionDate"
      />
    </div>

    <div>
      <CmSelect
        v-model="form.gender"
        label="Gender"
        :options="genderOptions"
        placeholder="Select gender"
        :error="errors.gender"
      />
    </div>
    <div>
      <CmInput
        v-model="form.admissionNumber"
        label="Admission number"
        placeholder="Auto-generated if left blank"
      />
    </div>

    <!-- Academic placement (from configured Academic Structure only) -->
    <div class="sm:col-span-2">
      <h4 class="mb-3 text-sm font-medium text-text-primary">Academic placement</h4>
    </div>
    <div>
      <CmSelect
        v-model="form.academicSessionId"
        label="Academic session"
        :options="sessionOptions"
        placeholder="Select session"
        :error="errors.academicSessionId"
      />
    </div>
    <div>
      <CmSelect
        v-model="form.sectionId"
        label="Section"
        :options="sectionOptions"
        placeholder="Select section"
        :error="errors.sectionId"
      />
    </div>
    <div class="sm:col-span-2">
      <CmSelect
        v-model="form.levelId"
        label="Academic level"
        :options="levelOptions"
        placeholder="Select level"
        :error="errors.levelId"
      />
      <p v-if="sessionOptions.length === 0" class="mt-1 text-xs text-text-muted">
        No academic structure configured yet — set up sessions, sections and levels under
        Students → Academic Structure.
      </p>
    </div>

    <div>
      <CmSelect
        v-model="form.status"
        label="Enrollment status"
        :options="statusOptions"
        placeholder="Active"
      />
    </div>

    <!-- Guardian Information -->
    <div class="sm:col-span-2">
      <h4 class="mb-3 flex items-center gap-3 text-sm font-medium text-text-primary">
        Guardian information
        <span class="inline-flex rounded-button border border-divider p-0.5 text-xs">
          <button
            type="button"
            class="rounded px-2 py-1 transition-colors"
            :class="guardianMode === 'existing' ? 'bg-brand text-background' : 'text-text-secondary hover:text-text-primary'"
            @click="guardianMode = 'existing'"
          >
            Existing guardian
          </button>
          <button
            type="button"
            class="rounded px-2 py-1 transition-colors"
            :class="guardianMode === 'new' ? 'bg-brand text-background' : 'text-text-secondary hover:text-text-primary'"
            @click="guardianMode = 'new'"
          >
            Create new
          </button>
        </span>
      </h4>
    </div>

    <template v-if="guardianMode === 'existing'">
      <div class="sm:col-span-2">
        <CmInput
          v-model="guardianSearch"
          label="Search guardians"
          placeholder="Search by name, phone or email"
        />
        <div v-if="guardianResults.length > 0" class="mt-2 max-h-44 space-y-1 overflow-y-auto rounded-input border border-divider bg-background p-1">
          <button
            v-for="g in guardianResults"
            :key="g.id"
            type="button"
            class="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm hover:bg-surface"
            :class="form.existingGuardianId === g.id ? 'bg-surface ring-1 ring-brand' : ''"
            @click="selectExistingGuardian(g)"
          >
            <span class="text-text-primary">{{ g.full_name }}</span>
            <span class="text-xs text-text-muted">{{ g.primary_phone }}</span>
          </button>
        </div>
        <p v-if="form.existingGuardianId && selectedGuardian" class="mt-2 text-xs text-success">
          Linked to {{ selectedGuardian.full_name }} ({{ selectedGuardian.primary_phone }})
        </p>
        <p v-if="errors.existingGuardianId" class="mt-1 text-xs text-danger">{{ errors.existingGuardianId }}</p>
      </div>
    </template>

    <template v-else>
      <div class="sm:col-span-2">
        <CmInput
          v-model="form.guardianName"
          label="Guardian full name *"
          :error="errors.guardianName"
          required
        />
      </div>

      <div>
        <CmInput
          v-model="form.guardianPhone"
          label="Phone number *"
          :error="errors.guardianPhone"
          required
        />
      </div>
      <div>
        <CmSelect
          v-model="form.relationship"
          label="Relationship"
          :options="relationshipOptions"
          placeholder="Select relationship"
        />
      </div>

      <div>
        <CmInput
          v-model="form.guardianSecondaryPhone"
          label="Alternative phone"
        />
      </div>
      <div class="sm:col-span-2">
        <CmInput
          v-model="form.guardianEmail"
          label="Guardian email"
          :error="errors.guardianEmail"
        />
      </div>
      <div class="sm:col-span-2">
        <CmInput
          v-model="form.guardianAddress"
          label="Guardian address"
        />
      </div>
    </template>

    <template v-if="guardianMode === 'existing'">
      <div>
        <CmSelect
          v-model="form.relationship"
          label="Relationship"
          :options="relationshipOptions"
          placeholder="Select relationship"
        />
      </div>
    </template>

    <!-- Optional Information -->
    <div class="sm:col-span-2">
      <h4 class="mb-3 text-sm font-medium text-text-primary">Optional information</h4>
    </div>

    <div class="sm:col-span-2">
      <CmInput
        v-model="form.previousSchool"
        label="Previous school"
        placeholder="Leave blank if none"
      />
    </div>

    <div class="sm:col-span-2">
      <label class="block text-sm font-medium text-text-primary mb-1">
        Medical notes
      </label>
      <textarea
        v-model="form.medicalNotes"
        rows="2"
        class="w-full px-3 py-2 border border-border rounded-input bg-card text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent resize-y"
        placeholder="Allergies, medical conditions, etc."
      />
    </div>

    <div class="sm:col-span-2">
      <label class="block text-sm font-medium text-text-primary mb-1">
        Special notes
      </label>
      <textarea
        v-model="form.specialNotes"
        rows="2"
        class="w-full px-3 py-2 border border-border rounded-input bg-card text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent resize-y"
        placeholder="Additional remarks..."
      />
    </div>

    <!-- Form actions -->
    <div class="sm:col-span-2 flex justify-end gap-3 border-t border-divider pt-6">
      <CmButton variant="secondary" @click="emit('cancel')">Cancel</CmButton>
      <CmButton
        variant="primary"
        :disabled="submitting"
        :loading="submitting"
        type="submit"
      >
        {{ isEditMode ? 'Save changes' : 'Register student' }}
      </CmButton>
    </div>
  </form>
</template>

<script setup lang="ts">
import { reactive, computed, ref, watch } from 'vue';
import { CmInput, CmSelect, CmButton } from '@/components/ui';
import type { NormalizedStudent } from '../types';
import type { Relationship, StudentStatus } from '@/shared/students/types';
import type { AcademicSessionRow, SchoolDivisionRow, AcademicLevelRow, GuardianRowLike } from '../formTypes';
import { GUARDIAN_RELATIONSHIP_OPTIONS } from '@/shared/guardians/relationshipTypes';

interface Props {
  student?: NormalizedStudent | null;
  loading?: boolean;
  sessions: AcademicSessionRow[];
  sections: SchoolDivisionRow[];
  levels: AcademicLevelRow[];
  knownGuardians?: GuardianRowLike[];
}

interface Emits {
  (e: 'submit', data: Record<string, any>): void;
  (e: 'cancel'): void;
  (e: 'update:loading', value: boolean): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const isEditMode = computed(() => !!props.student);
const submitting = computed(() => props.loading || false);

interface FormState {
  firstName: string;
  middleName: string;
  lastName: string;
  dateOfBirth: string;
  dateOfAdmission: string;
  gender: string;
  admissionNumber: string;
  status: string;
  academicSessionId: string;
  sectionId: string;
  levelId: string;
  guardianMode: 'existing' | 'new';
  existingGuardianId: string;
  guardianName: string;
  relationship: string;
  guardianPhone: string;
  guardianSecondaryPhone: string;
  guardianEmail: string;
  guardianAddress: string;
  previousSchool: string;
  medicalNotes: string;
  specialNotes: string;
}

const form = reactive<FormState>({
  firstName: '',
  middleName: '',
  lastName: '',
  dateOfBirth: '',
  dateOfAdmission: '',
  gender: '',
  admissionNumber: '',
  status: 'ACTIVE',
  academicSessionId: '',
  sectionId: '',
  levelId: '',
  guardianMode: 'new',
  existingGuardianId: '',
  guardianName: '',
  relationship: 'OTHER',
  guardianPhone: '',
  guardianSecondaryPhone: '',
  guardianEmail: '',
  guardianAddress: '',
  previousSchool: '',
  medicalNotes: '',
  specialNotes: '',
});

const errors: Record<string, string> = reactive({});

const genderOptions = [
  { value: 'Male', label: 'Male' },
  { value: 'Female', label: 'Female' },
  { value: 'Other', label: 'Other' },
];

const statusOptions = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'GRADUATED', label: 'Graduated' },
  { value: 'TRANSFERRED', label: 'Transferred' },
  { value: 'SUSPENDED', label: 'Suspended' },
  { value: 'WITHDRAWN', label: 'Withdrawn' },
  { value: 'ARCHIVED', label: 'Archived' },
];

const relationshipOptions = GUARDIAN_RELATIONSHIP_OPTIONS;

// --- Cascading placement options ---

const sessionOptions = computed(() =>
  [...props.sessions]
    .sort((a, b) => Number(b.is_current) - Number(a.is_current))
    .map((s) => ({ value: s.id, label: s.is_current ? `${s.name} (current)` : s.name }))
);

const sectionOptions = computed(() =>
  [...props.sections]
    .filter((s) => s.status === 'ACTIVE')
    .sort((a, b) => a.display_order - b.display_order)
    .map((s) => ({ value: s.id, label: s.name }))
);

const levelOptions = computed(() => {
  if (!form.sectionId) return [];
  return props.levels
    .filter((l) => l.section_id === form.sectionId && l.status === 'ACTIVE')
    .sort((a, b) => a.display_order - b.display_order)
    .map((l) => ({ value: l.id, label: l.name }));
});

// Reset dependent selections when a parent changes.
watch(
  () => form.sectionId,
  () => {
    if (!props.levels.some((l) => l.id === form.levelId && l.section_id === form.sectionId)) {
      form.levelId = '';
    }
  }
);

// Default the session to the current one on create.
watch(
  () => props.sessions,
  (sessions) => {
    if (!isEditMode.value && !form.academicSessionId && sessions.length > 0) {
      const current = sessions.find((s) => s.is_current && s.status === 'ACTIVE');
      if (current) form.academicSessionId = current.id;
    }
  },
  { immediate: true }
);

// --- Guardian search (existing mode) ---

const guardianSearch = ref('');
const guardianResults = ref<GuardianRowLike[]>([]);
let guardianSearchTimer: ReturnType<typeof setTimeout> | null = null;

const selectedGuardian = computed(() =>
  guardianResults.value.find((g) => g.id === form.existingGuardianId) ??
  (props.knownGuardians ?? []).find((g) => g.id === form.existingGuardianId)
);

watch(guardianSearch, (q) => {
  if (guardianSearchTimer) clearTimeout(guardianSearchTimer);
  guardianSearchTimer = setTimeout(() => runGuardianSearch(q), 250);
});

function runGuardianSearch(query: string) {
  const normalized = query.trim().toLowerCase();
  const pool = props.knownGuardians ?? [];
  if (!normalized) {
    guardianResults.value = pool.slice(0, 8);
    return;
  }
  guardianResults.value = pool
    .filter(
      (g) =>
        (g.full_name ?? '').toLowerCase().includes(normalized) ||
        (g.primary_phone ?? '').includes(normalized) ||
        (g.email ?? '').toLowerCase().includes(normalized)
    )
    .slice(0, 8);
}

function selectExistingGuardian(guardian: GuardianRowLike) {
  form.existingGuardianId = guardian.id;
  if (guardian.full_name) form.guardianName = guardian.full_name;
  if (guardian.primary_phone) form.guardianPhone = guardian.primary_phone;
}

watch(
  () => props.knownGuardians,
  () => runGuardianSearch(guardianSearch.value),
  { immediate: true }
);

watch(
  () => props.student,
  (student) => {
    if (student) {
      Object.assign(form, {
        firstName: student.firstName || '',
        middleName: student.middleName || '',
        lastName: student.lastName || '',
        dateOfBirth: student.dateOfBirth || '',
        dateOfAdmission: student.admissionDate || '',
        gender: student.gender || '',
        admissionNumber: student.admissionNumber || '',
        status: student.status || 'ACTIVE',
        academicSessionId: (student as any).sessionId || '',
        sectionId: (student as any).sectionId || student.divisionId || '',
        levelId: (student as any).levelId || '',
        guardianMode: student.guardian?.id ? 'existing' : 'new',
        existingGuardianId: student.guardian?.id || '',
        guardianName: student.guardian?.fullName || '',
        relationship: (student.guardian?.relationship as string) || 'OTHER',
        guardianPhone: student.guardian?.phone || '',
        guardianSecondaryPhone: student.guardian?.secondaryPhone || '',
        guardianEmail: student.guardian?.email || '',
        guardianAddress: (student.guardian as any)?.address || '',
      });
      runGuardianSearch('');
    }
  },
  { immediate: true }
);

function clearErrors() {
  Object.keys(errors).forEach(key => delete errors[key]);
}

function validate(): boolean {
  clearErrors();

  if (!form.firstName || form.firstName.length < 2) {
    errors.firstName = 'First name must be at least 2 characters';
  }
  if (!form.lastName || form.lastName.length < 2) {
    errors.lastName = 'Last name must be at least 2 characters';
  }

  if (guardianMode.value === 'existing') {
    if (!form.existingGuardianId) {
      errors.existingGuardianId = 'Select an existing guardian';
    }
  } else {
    if (!form.guardianName || form.guardianName.length < 2) {
      errors.guardianName = 'Guardian name must be at least 2 characters';
    }
    if (!form.guardianPhone) {
      errors.guardianPhone = 'Phone number is required';
    } else {
      const digits = form.guardianPhone.replace(/\D/g, '');
      if (digits.length < 10) {
        errors.guardianPhone = 'Phone number must be at least 10 digits';
      }
    }
    if (form.guardianEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.guardianEmail)) {
      errors.guardianEmail = 'Invalid email address';
    }
  }

  if (form.dateOfBirth && !isValidDate(form.dateOfBirth)) {
    errors.dateOfBirth = 'Invalid date format';
  }

  return Object.keys(errors).length === 0;
}

const guardianMode = computed(() => form.guardianMode);

function isValidDate(value: string): boolean {
  if (!value) return true;
  const d = new Date(value);
  return !isNaN(d.getTime());
}

function handleSubmit() {
  if (submitting.value) return;
  if (!validate()) return;

  emit('update:loading', true);

  emit('submit', {
    firstName: form.firstName,
    middleName: form.middleName || undefined,
    lastName: form.lastName,
    dateOfBirth: form.dateOfBirth || undefined,
    admissionDate: form.dateOfAdmission || new Date().toISOString().split('T')[0],
    registeredAt: new Date().toISOString(),
    gender: form.gender,
    admissionNumber: form.admissionNumber || undefined,
    status: form.status as StudentStatus,
    // Placement
    academicSessionId: form.academicSessionId || undefined,
    sectionId: form.sectionId || undefined,
    levelId: form.levelId || undefined,
    // Guardian
    guardianMode: form.guardianMode,
    existingGuardianId: form.existingGuardianId || undefined,
    guardianName: form.guardianName,
    relationship: form.relationship as Relationship,
    guardianPhone: form.guardianPhone,
    guardianSecondaryPhone: form.guardianSecondaryPhone || undefined,
    guardianEmail: form.guardianEmail || undefined,
    guardianAddress: form.guardianAddress || undefined,
    previousSchool: form.previousSchool || undefined,
    medicalNotes: form.medicalNotes || undefined,
    specialNotes: form.specialNotes || undefined,
  });

  emit('update:loading', false);
}
</script>
