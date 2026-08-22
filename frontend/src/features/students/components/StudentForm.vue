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
      <CmSelect
        v-model="form.className"
        label="Class"
        :options="divisions"
        placeholder="Select class"
      />
    </div>

    <div>
      <CmInput
        v-model="form.admissionNumber"
        label="Admission number"
        placeholder="Auto-generated if left blank"
      />
    </div>
    <div>
      <CmSelect
        v-model="form.status"
        label="Enrollment status"
        :options="statusOptions"
        placeholder="Active"
      />
    </div>

    <div class="sm:col-span-2">
      <CmInput
        v-model="form.academicSession"
        label="Academic session"
        placeholder="e.g. 2024/2025"
      />
    </div>

    <!-- Guardian Information -->
    <div class="sm:col-span-2">
      <h4 class="mb-3 text-sm font-medium text-text-primary">Guardian information</h4>
    </div>

    <div class="sm:col-span-2">
      <CmInput
        v-model="form.guardianName"
        label="Guardian full name *"
        :error="errors.guardianName"
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
        v-model="form.guardianPhone"
        label="Phone number *"
        :error="errors.guardianPhone"
        required
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
import { reactive, computed, watch } from 'vue';
import { CmInput, CmSelect, CmButton } from '@/components/ui';
import type { NormalizedStudent } from '../types';
import type { Relationship, StudentStatus } from '@/shared/students/types';

interface Props {
  student?: NormalizedStudent | null;
  loading?: boolean;
  divisions: { value: string; label: string }[];
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
  className: string;
  admissionNumber: string;
  status: string;
  academicSession: string;
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
  className: '',
  admissionNumber: '',
  status: 'ACTIVE',
  academicSession: '',
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

const relationshipOptions = [
  { value: 'FATHER', label: 'Father' },
  { value: 'MOTHER', label: 'Mother' },
  { value: 'UNCLE', label: 'Uncle' },
  { value: 'AUNT', label: 'Aunt' },
  { value: 'GUARDIAN', label: 'Guardian' },
  { value: 'OTHER', label: 'Other' },
];

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
        className: student.divisionId || '',
        admissionNumber: student.admissionNumber || '',
        status: student.status || 'ACTIVE',
        academicSession: student.academicSession || '',
        guardianName: student.guardian?.fullName || '',
        relationship: student.guardian?.relationship || 'OTHER',
        guardianPhone: student.guardian?.phone || '',
        guardianSecondaryPhone: student.guardian?.secondaryPhone || '',
        guardianEmail: student.guardian?.email || '',
        guardianAddress: student.guardian?.address || '',
      });
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
  if (form.dateOfBirth && !isValidDate(form.dateOfBirth)) {
    errors.dateOfBirth = 'Invalid date format';
  }

  return Object.keys(errors).length === 0;
}

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
    className: form.className,
    status: form.status as StudentStatus,
    academicSession: form.academicSession || undefined,
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
