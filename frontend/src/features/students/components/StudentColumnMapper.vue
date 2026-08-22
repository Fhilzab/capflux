<template>
  <div class="space-y-4">
    <p class="text-sm text-text-secondary">
      Map the columns from your file to the student fields below.
      <strong class="text-text-primary"> Required fields</strong> are marked with an asterisk.
    </p>

    <div class="overflow-x-auto border border-border rounded-input">
      <table class="min-w-full divide-y divide-divider">
        <thead class="bg-surface">
          <tr>
            <th class="px-3 py-2 text-left text-xs font-medium uppercase text-text-muted">
              Column in file
            </th>
            <th class="px-3 py-2 text-left text-xs font-medium uppercase text-text-muted">
              Student field
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-divider/50 bg-card">
          <tr v-for="header in visibleHeaders" :key="header">
            <td class="px-3 py-2">
              <span class="text-sm text-text-primary">{{ header }}</span>
            </td>
            <td class="px-3 py-2">
              <CmSelect
                :model-value="mapping[header] || ''"
                :options="fieldOptions"
                placeholder="Select field"
                @update:model-value="setMapping(header, $event)"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="unmappedRequired.length > 0" class="rounded-input bg-danger/10 px-3 py-2 text-sm text-danger">
      <AlertCircle class="inline h-4 w-4 mr-1" />
      The following required fields are unmapped:
      {{ unmappedRequired.join(', ') }}
    </div>

    <div v-if="showAllCount <= visibleHeaders.length && allHeaders.length > 10" class="text-center">
      <button
        @click="showAll = true"
        class="text-sm text-brand hover:text-brand-hover"
      >
        Show all {{ allHeaders.length }} columns
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { AlertCircle } from '@lucide/vue';
import CmSelect from '@/components/ui/CmSelect.vue';
import type { ColumnMapping, StudentField } from '../types';

interface Props {
  headers: string[];
  initialMapping: ColumnMapping;
  requiredFields?: string[];
}

const props = withDefaults(defineProps<Props>(), {
  headers: () => [],
  initialMapping: () => ({}),
  requiredFields: () => ['firstName', 'lastName', 'guardianName', 'guardianPhone'],
});

const emit = defineEmits(['update:mapping']);

const mapping = ref<Record<string, string>>(props.initialMapping);
const showAll = ref(false);

const allHeaders = computed(() => props.headers);
const visibleHeaders = computed(() => {
  if (showAll.value || allHeaders.value.length <= 10) {
    return allHeaders.value;
  }
  return allHeaders.value.slice(0, 10);
});

const REQUIRED_FIELDS_SET = new Set(props.requiredFields);

const fieldOptions = [
  { value: '', label: 'Do not import' },
  { value: 'firstName', label: 'First name *' },
  { value: 'lastName', label: 'Last name *' },
  { value: 'middleName', label: 'Middle name' },
  { value: 'gender', label: 'Gender' },
  { value: 'dateOfBirth', label: 'Date of birth' },
  { value: 'admissionNumber', label: 'Admission number / Student ID' },
  { value: 'guardianName', label: 'Guardian name *' },
  { value: 'guardianPhone', label: 'Guardian phone *' },
  { value: 'relationship', label: 'Relationship' },
  { value: 'guardianEmail', label: 'Guardian email' },
  { value: 'guardianSecondaryPhone', label: 'Secondary phone' },
  { value: 'dateOfAdmission', label: 'Admission date' },
  { value: 'status', label: 'Status' },
  { value: 'className', label: 'Class' },
  { value: 'academicSession', label: 'Academic session' },
  { value: 'guardianAddress', label: 'Guardian address' },
  { value: 'previousSchool', label: 'Previous school' },
];

function setMapping(header: string, field: string) {
  mapping.value[header] = field;
  emit('update:mapping', { ...mapping.value });
}

const unmappedRequired = computed(() => {
  const mapped = new Set(Object.values(mapping.value));
  return props.requiredFields.filter((f) => !mapped.has(f));
});
</script>
