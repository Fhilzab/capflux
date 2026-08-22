<template>
  <CmModal
    :model-value="internalVisible"
    title="Export Students"
    size="lg"
    :closable="true"
    @update:model-value="setInternalVisible"
  >
    <div class="space-y-5">
      <!-- Scope -->
      <div>
        <p class="text-sm font-medium text-text-primary mb-2">Export scope</p>
        <div class="space-y-2">
          <label class="flex items-center gap-3 cursor-pointer">
            <input type="radio" value="all" v-model="scope" class="text-brand" />
            <span class="text-sm text-text-primary">All students</span>
            <span class="text-xs text-text-muted">({{ allStudents.length }} students)</span>
          </label>
          <label
            v-if="filteredStudents.length !== allStudents.length"
            class="flex items-center gap-3 cursor-pointer"
          >
            <input type="radio" value="filtered" v-model="scope" class="text-brand" />
            <span class="text-sm text-text-primary">Filtered students</span>
            <span class="text-xs text-text-muted">({{ filteredStudents.length }} students)</span>
          </label>
          <label
            v-if="selectedStudents.length > 0"
            class="flex items-center gap-3 cursor-pointer"
          >
            <input type="radio" value="selected" v-model="scope" class="text-brand" />
            <span class="text-sm text-text-primary">Selected students</span>
            <span class="text-xs text-text-muted">({{ selectedStudents.length }} students)</span>
          </label>
        </div>
      </div>

      <!-- Format -->
      <div>
        <p class="text-sm font-medium text-text-primary mb-2">Format</p>
        <div class="flex gap-4">
          <label class="flex items-center gap-2">
            <input type="radio" value="csv" v-model="format" />
            <span class="text-sm text-text-primary">CSV</span>
          </label>
          <label class="flex items-center gap-2">
            <input type="radio" value="xlsx" v-model="format" />
            <span class="text-sm text-text-primary">Excel (.xlsx)</span>
          </label>
        </div>
      </div>

      <!-- Fields -->
      <div>
        <div class="flex justify-between items-center mb-2">
          <p class="text-sm font-medium text-text-primary">Fields to export</p>
          <div class="flex gap-3 text-xs">
            <button
              @click="selectPageFields"
              class="text-brand hover:text-brand-hover"
              type="button"
              >Select all</button
            >
            <button
              @click="clearPageFields"
              class="text-brand hover:text-brand-hover"
              type="button"
              >Clear all</button
            >
          </div>
        </div>
        <div class="grid grid-cols-2 md:grid-cols-3 gap-2">
          <label
            v-for="field in allFields"
            :key="field.key"
            class="flex items-center gap-2 text-sm"
          >
            <input
              type="checkbox"
              :value="field.key"
              v-model="selectedFields"
              class="text-brand rounded border-border focus:ring-success"
            />
            <span class="text-text-primary">{{ field.label }}</span>
          </label>
        </div>
      </div>

      <!-- Summary -->
      <div class="border-t border-divider pt-3">
        <p class="text-sm text-text-secondary">
          <span class="font-medium text-text-primary">{{ studentsToExport.length }}</span>
          students will be exported as
          <span class="font-medium text-text-primary">{{ formatLabel }}</span>
          with
          <span class="font-medium text-text-primary">{{ selectedFields.length }}</span>
          fields.
        </p>
      </div>
    </div>

    <template #footer>
      <div class="flex justify-end gap-3">
        <CmButton variant="secondary" @click="doClose">Cancel</CmButton>
        <CmButton
          variant="primary"
          :disabled="exporting || studentsToExport.length === 0"
          @click="doExport"
        >
          <Download v-if="!exporting" class="mr-2 h-4 w-4" />
          <span v-else class="mr-2">…</span>
          Export
        </CmButton>
      </div>
    </template>
  </CmModal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { Download } from '@lucide/vue';
import CmModal from '@/components/ui/CmModal.vue';
import CmButton from '@/components/ui/CmButton.vue';
import {
  EXPORT_FIELDS,
  exportToCSV,
  exportToXLSX,
  getExportSummary,
} from '../services/StudentExportService';
import type { ExportField } from '../services/StudentExportService';
import type { NormalizedStudent } from '../types';

interface Props {
  modelValue: boolean;
  allStudents: NormalizedStudent[];
  filteredStudents: NormalizedStudent[];
  selectedStudents: NormalizedStudent[];
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void;
  (e: 'export-done'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const internalVisible = ref(props.modelValue);
watch(
  () => props.modelValue,
  (val) => {
    internalVisible.value = val;
  },
);

function setInternalVisible(value: boolean) {
  internalVisible.value = value;
  emit('update:modelValue', value);
}

function doClose() {
  setInternalVisible(false);
}

const scope = ref<'all' | 'filtered' | 'selected'>('all');
const format = ref<'csv' | 'xlsx'>('csv');
const exporting = ref(false);

const allFields = EXPORT_FIELDS;
const selectedFields = ref<string[]>(allFields.map((f) => f.key));

function selectPageFields() {
  selectedFields.value = allFields.map((f) => f.key);
}

function clearPageFields() {
  selectedFields.value = [];
}

const formatLabel = computed(() => (format.value === 'csv' ? 'CSV' : 'Excel'));

const studentsToExport = computed(() => {
  switch (scope.value) {
    case 'all':
      return props.allStudents;
    case 'filtered':
      return props.filteredStudents;
    case 'selected':
      return props.selectedStudents;
    default:
      return props.allStudents;
  }
});

async function doExport() {
  if (studentsToExport.value.length === 0 || selectedFields.value.length === 0) return;
  exporting.value = true;
  try {
    const fileName = `students-export-${new Date().toISOString().slice(0, 10)}`;
    if (format.value === 'csv') {
      exportToCSV(studentsToExport.value, selectedFields.value, fileName);
    } else {
      await exportToXLSX(studentsToExport.value, selectedFields.value, fileName);
    }
    emit('export-done');
    doClose();
  } finally {
    exporting.value = false;
  }
}
</script>
