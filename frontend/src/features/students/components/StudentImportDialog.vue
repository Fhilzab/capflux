<template>
  <CmModal
    :model-value="modelValue"
    :title="currentStepTitle"
    size="xl"
    :closable="canCancel"
    @update:model-value="handleClose"
  >
    <template #header>
      <h3 class="text-lg font-semibold text-text-primary">{{ currentStepTitle }}</h3>
      <p v-if="stepDescription" class="text-sm text-text-secondary">{{ stepDescription }}</p>
    </template>

    <!-- Step indicator -->
    <nav class="mb-4 flex items-center justify-between" aria-label="Import progress">
      <div class="flex items-center gap-2">
        <div
          v-for="(step, idx) in stepList"
          :key="step.value"
          class="flex items-center gap-2"
        >
          <div
            :class="[
              'flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium',
              isStepComplete(idx)
                ? 'bg-success text-white'
                : isActiveStep(idx)
                ? 'bg-brand text-background'
                : 'bg-surface text-text-muted',
            ]"
          >
            {{ idx + 1 }}
          </div>
          <span
            :class="[
              'text-xs',
              isStepComplete(idx) || isActiveStep(idx)
                ? 'text-text-primary'
                : 'text-text-muted',
            ]"
          >
            {{ step.label }}
          </span>
        </div>
      </div>
    </nav>

    <!-- Step content -->
    <div class="min-h-[280px]">
      <!-- Step: Source selection -->
      <div v-if="step === 'source'" class="space-y-4">
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <button
            v-for="option in sourceOptions"
            :key="option.value"
            type="button"
            @click="selectSource(option.value)"
            class="flex flex-col items-center gap-3 rounded-card border-2 border-border bg-surface p-4 text-center transition-all hover:border-brand hover:bg-surface/80"
          >
            <component :is="option.icon" class="h-8 w-8 text-brand" />
            <span class="text-sm font-medium text-text-primary">{{ option.label }}</span>
            <span class="text-xs text-text-muted">{{ option.subtext }}</span>
          </button>
        </div>

        <div class="border-t border-divider pt-4">
          <CmButton variant="link" @click="downloadCsvTemplate">
            <Download class="mr-2 h-4 w-4" />
            Download CSV template
          </CmButton>
          <CmButton variant="link" @click="downloadXlsxTemplate">
            <Download class="ml-4 mr-2 h-4 w-4" />
            Download Excel template
          </CmButton>
        </div>
      </div>

      <!-- Step: Upload -->
      <div v-if="step === 'upload'" class="space-y-4">
        <!-- File upload (CSV / Excel) -->
        <div v-if="source !== 'google'">
          <div
            class="border-2 border-dashed border-border rounded-card p-8 text-center cursor-pointer transition-all"
            :class="isDragging ? 'border-brand bg-surface/50' : 'hover:border-brand'"
            @dragover.prevent="isDragging = true"
            @dragleave.prevent="isDragging = false"
            @drop.prevent="handleDrop"
          >
            <FileUp class="mx-auto h-12 w-12 text-text-muted" />
            <p class="mt-2 text-sm text-text-secondary">
              Drag & drop your file here, or <span class="text-brand font-medium">click to browse</span>
            </p>
            <p class="mt-1 text-xs text-text-muted">
              Supports .csv, .xlsx, .xls (max 10MB)
            </p>
            <input
              type="file"
              ref="fileInput"
              :accept="source === 'csv' ? '.csv' : '.xlsx,.xls,.csv'"
              @change="handleFileSelect"
              class="hidden"
            />
          </div>
          <button
            v-if="file"
            type="button"
            @click="document.getElementById('fileInput')?.click()"
            class="text-sm text-brand hover:text-brand-hover"
          >
            Change file: {{ file.name }}
          </button>
        </div>

        <!-- Google Sheets upload -->
        <div v-else class="space-y-3">
          <div v-if="googleError" class="rounded-card border border-danger/30 bg-danger/5 p-3 text-sm text-danger">
            {{ googleError }}
          </div>

          <div v-if="!googleSheets" class="space-y-3">
            <CmInput
              v-model="googleUrl"
              label="Google Sheets URL"
              placeholder="https://docs.google.com/spreadsheets/d/..."
              :error="googleUrlError"
            />
            <CmButton
              variant="primary"
              :disabled="!googleUrl || connecting"
              @click="connectGoogleSheet"
            >
              <span v-if="connecting">
                <span class="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></span>
                Connecting...
              </span>
              <span v-else>Connect Google Sheets</span>
            </CmButton>
          </div>

          <div v-else class="space-y-3">
            <p class="text-sm text-text-secondary">
              Connected to sheet: {{ googleSheets.title }}
            </p>
            <CmSelect
              v-model="googleSheetName"
              :options="googleSheetOptions"
              placeholder="Select a worksheet"
            />
            <CmButton
              variant="primary"
              :disabled="!googleSheetName || fetching"
              @click="fetchGoogleSheetData"
            >
              <span v-if="fetching">
                <span class="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></span>
                Loading...
              </span>
              <span v-else>Load sheet data</span>
            </CmButton>
          </div>
        </div>

        <div v-if="file || parsedData" class="border-t border-divider pt-4">
          <CmButton
            variant="secondary"
            @click="downloadCsvTemplate"
          >
            <Download class="mr-2 h-4 w-4" />
            Download template for reference
          </CmButton>
        </div>
      </div>

      <!-- Step: Column mapping -->
      <div v-if="step === 'mapping'" class="space-y-4">
        <StudentColumnMapper
          :headers="parsedData?.headers || []"
          :initial-mapping="columnMapping"
          @update:mapping="columnMapping = $event"
        />
      </div>

      <!-- Step: Validation -->
      <div v-if="step === 'validation'" class="space-y-4">
        <StudentImportPreview
          :validated-rows="validatedRows"
          :summary="validationSummary"
        />
        <div v-if="validationSummary.errors > 0 || validationSummary.warnings > 0">
          <CmButton variant="secondary" size="sm" @click="handleDownloadReport">
            <Download class="mr-2 h-4 w-4" />
            Download validation report
          </CmButton>
        </div>
      </div>

      <!-- Step: Duplicate handling -->
      <div v-if="step === 'duplicates'" class="space-y-4">
        <div class="rounded-card border border-border bg-card p-4">
          <p class="text-sm text-text-secondary">
            {{ duplicateCount }} duplicate record(s) were detected during validation.
            Choose how to handle them:
          </p>
        </div>
        <div class="space-y-2">
          <label class="flex items-start gap-3 cursor-pointer">
            <input
              type="radio"
              value="SKIP"
              v-model="duplicateHandling"
              class="mt-1 text-success focus:ring-success"
            />
            <div>
              <span class="block text-sm font-medium text-text-primary">Skip duplicates</span>
              <span class="text-xs text-text-muted">Do not import records that already exist. Their existing data will be preserved.</span>
            </div>
          </label>
          <label class="flex items-start gap-3 cursor-pointer">
            <input
              type="radio"
              value="UPDATE"
              v-model="duplicateHandling"
              class="mt-1 text-success focus:ring-success"
            />
            <div>
              <span class="block text-sm font-medium text-text-primary">Update existing students</span>
              <span class="text-xs text-text-muted">Overwrite existing student records with the imported data. Financial history is preserved.</span>
            </div>
          </label>
          <label class="flex items-start gap-3 cursor-pointer">
            <input
              type="radio"
              value="IMPORT_AS_NEW"
              v-model="duplicateHandling"
              class="mt-1 text-success focus:ring-success"
            />
            <div>
              <span class="block text-sm font-medium text-text-primary">Import as new records</span>
              <span class="text-xs text-text-muted">Create new student records even if a match exists.</span>
            </div>
          </label>
        </div>
      </div>

      <!-- Step: Confirmation -->
      <div v-if="step === 'confirm'" class="space-y-4">
        <div class="rounded-card border border-border bg-card p-4 space-y-2">
          <p class="text-sm text-text-secondary">
            You are about to import
            <span class="font-medium text-text-primary">{{ readyToImportCount }}</span>
            students into
            <span class="font-medium text-text-primary">{{ schoolName }}</span>.
          </p>
          <p v-if="duplicateHandling === 'SKIP'" class="text-sm text-text-secondary">
            Duplicate records will be skipped.
          </p>
          <p v-if="duplicateHandling === 'UPDATE'" class="text-sm text-text-secondary">
            Existing records will be updated with new data.
          </p>
          <p v-if="duplicateHandling === 'IMPORT_AS_NEW'" class="text-sm text-text-secondary">
            All records will be imported as new students.
          </p>
          <p class="text-xs text-text-muted">
            This operation cannot be undone. Hard deletion of student records is not supported.
          </p>
        </div>
      </div>

      <!-- Step: Results / Importing -->
      <div v-if="step === 'results'" class="space-y-4">
        <div v-if="importing" class="space-y-3">
          <CmLoading variant="spinner" size="lg" />
          <div class="text-center">
            <p class="text-sm font-medium text-text-primary">
              Importing students...
            </p>
            <p class="text-xs text-text-secondary">
              {{ importProgress.imported }} of {{ importProgress.total }} processed
            </p>
            <div class="mt-2 w-full bg-surface rounded-full h-2">
              <div
                class="bg-brand h-2 rounded-full transition-all duration-300"
                :style="{ width: progressPercent + '%' }"
              />
            </div>
          </div>
        </div>

        <StudentImportResult v-if="importResult && !importing" :result="importResult" @view-imported="$emit('view-imported')" @download-errors="handleDownloadReport" />
      </div>
    </div>

    <!-- Footer -->
    <template #footer>
      <div class="flex items-center justify-between">
        <CmButton
          v-if="step !== 'source' && step !== 'results'"
          variant="secondary"
          @click="goBack"
        >
          Back
        </CmButton>
        <div v-else></div>

        <div class="flex items-center gap-3">
          <CmButton
            v-if="step !== 'results'"
            variant="secondary"
            :disabled="importing"
            @click="handleClose"
          >
            Cancel
          </CmButton>
          <CmButton
            v-if="step === 'source' || step === 'upload'"
            variant="primary"
            :disabled="importing"
            @click="goNext"
          >
            Next
          </CmButton>
          <CmButton
            v-else-if="step === 'mapping'"
            variant="primary"
            :disabled="importing"
            @click="goNext"
          >
            Validate
          </CmButton>
          <CmButton
            v-else-if="step === 'validation' || step === 'duplicates'"
            variant="primary"
            :disabled="importing || !canProceed"
            @click="goNext"
          >
            Continue
          </CmButton>
          <CmButton
            v-if="step === 'confirm'"
            variant="success"
            :disabled="importing"
            @click="startImport"
          >
            Confirm &amp; Import
          </CmButton>
        </div>
      </div>
    </template>
  </CmModal>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import {
  FileSpreadsheet, FileText, Globe, FileUp, Download,
} from '@lucide/vue';
import CmModal from '@/components/ui/CmModal.vue';
import CmButton from '@/components/ui/CmButton.vue';
import CmInput from '@/components/ui/CmInput.vue';
import CmSelect from '@/components/ui/CmSelect.vue';
import CmLoading from '@/components/ui/CmLoading.vue';
import StudentColumnMapper from './StudentColumnMapper.vue';
import StudentImportPreview from './StudentImportPreview.vue';
import StudentImportResult from './StudentImportResult.vue';

import { studentService } from '@/shared/students/StudentService';
import { GuardianService } from '@/shared/services/GuardianService';
import { useSchoolStore } from '@/stores/schoolStore';

import {
  parseFile,
  detectColumns,
  validateAllRows,
  batchImport,
  downloadCsvTemplate,
  downloadXlsxTemplate,
  SUPPORTED_IMPORT_EXTENSIONS,
} from '../services/StudentImportService';
import {
  getGoogleSheetsConfig,
  authenticate,
  getSheetInfo,
  fetchSheetData,
  extractSpreadsheetId,
} from '../services/GoogleSheetsImportService';
import type {
  ColumnMapping,
  ValidatedRow,
  ImportSummary,
  ImportResult,
  ImportStepName,
  NormalizedStudent,
} from '../types';
import type { SchoolDivision } from '@/shared/divisions/types';
import type {
  ImportBatchContext,
  BatchImportOptions,
  DuplicateHandling,
} from '../services/StudentImportService';
import { EnrollmentService } from '@/shared/enrollment/EnrollmentService';
import { useAcademicStore } from '@/stores/academicStore';
import { db } from '@/offline/localDb';

interface Props {
  modelValue: boolean;
  schoolId: string;
  divisions: SchoolDivision[];
  existingStudents: NormalizedStudent[];
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void;
  (e: 'imported'): void;
  (e: 'view-imported'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();
const academicStore = useAcademicStore();

/** Academic structure snapshot used for column validation + placement. */
const academicStructure = ref<{
  sessions: Array<{ id: string; name: string }>;
  sections: Array<{ id: string; name: string }>;
  levels: Array<{ id: string; name: string; sectionId?: string }>;
  defaultSessionId?: string;
} | undefined>(undefined);

async function loadAcademicStructure() {
  try {
    await academicStore.initialize();
    const divisions = await db.school_divisions.toArray();
    const levels = (await db.academic_levels.toArray()).filter((l) => l.status === 'ACTIVE');
    academicStructure.value = {
      sessions: academicStore.sessions.map((s) => ({ id: s.id, name: s.name })),
      sections: divisions
        .filter((d) => d.status === 'ACTIVE')
        .map((d) => ({ id: d.id, name: d.name })),
      levels: levels.map((l) => ({ id: l.id, name: l.name, sectionId: l.section_id })),
      defaultSessionId:
        academicStore.sessions.find((s) => s.is_current && s.status === 'ACTIVE')?.id,
    };
  } catch {
    academicStructure.value = undefined;
  }
}

onMounted(loadAcademicStructure);
watch(
  () => props.modelValue,
  (open) => {
    if (open) void loadAcademicStructure();
  }
);

// State
const step = ref<ImportStepName>('source');
const source = ref<'excel' | 'csv' | 'google'>('csv');
const file = ref<File | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);
const isDragging = ref(false);
const parsedData = ref<{ fileName: string; headers: string[]; rows: Record<string, string>[] } | null>(null);
const columnMapping = ref<ColumnMapping>({});
const validatedRows = ref<ValidatedRow[]>([]);
const validationSummary = ref<ImportSummary>({ total: 0, ready: 0, warnings: 0, errors: 0 });
const duplicateHandling = ref<DuplicateHandling>('SKIP');
const importResult = ref<ImportResult | null>(null);
const importing = ref(false);
const importProgress = ref({ imported: 0, skipped: 0, failed: 0, total: 0 });
const progressPercent = ref(0);
const googleUrl = ref('');
const googleUrlError = ref('');
const googleSheetName = ref('');
const googleSheets = ref<any>(null);
const connecting = ref(false);
const fetching = ref(false);
const googleError = ref<string | null>(null);

const schoolStore = useSchoolStore();

const schoolName = computed(() => schoolStore.currentSchool?.name || schoolStore.currentSchoolId || 'this school');

const stepList = [
  { value: 'source', label: 'Source' },
  { value: 'upload', label: 'Upload' },
  { value: 'mapping', label: 'Column mapping' },
  { value: 'validation', label: 'Validation' },
  { value: 'duplicates', label: 'Duplicates' },
  { value: 'confirm', label: 'Confirm' },
  { value: 'results', label: 'Results' },
];

const sourceOptions = [
  { value: 'csv', icon: FileText, label: 'CSV', subtext: '.csv files' },
  { value: 'excel', icon: FileSpreadsheet, label: 'Excel', subtext: '.xlsx, .xls files' },
  { value: 'google', icon: Globe, label: 'Google Sheets', subtext: 'From Google Sheets' },
];

const currentStepTitle = computed(() => {
  const stepItem = stepList.find((s) => s.value === step.value);
  return stepItem ? stepItem.label : '';
});

const stepDescription = computed(() => {
  const descriptions: Record<string, string> = {
    source: 'Choose where your student data is stored.',
    upload: 'Upload your file or connect to Google Sheets.',
    mapping: 'Map your file columns to student fields.',
    validation: 'Review validation results before importing.',
    duplicates: 'How should existing students be handled?',
    confirm: 'Review and confirm the import.',
    results: 'Import complete. Review the results.',
  };
  return descriptions[step.value] || '';
});

const canCancel = computed(() => !importing.value);

const duplicateCount = computed(() => {
  return validatedRows.value.filter((r) => r.exists).length;
});

const readyToImportCount = computed(() => {
  const rows = validatedRows.value;
  if (duplicateHandling.value === 'SKIP') {
    return rows.filter((r) => r.valid && !r.exists).length;
  }
  return rows.filter((r) => r.valid).length;
});

const googleSheetOptions = computed(() => {
  if (!googleSheets.value?.sheetNames) return [];
  return googleSheets.value.sheetNames.map((name: string) => ({ value: name, label: name }));
});

// Helpers
function isStepComplete(idx: number): boolean {
  return idx < stepList.findIndex((s) => s.value === step.value);
}
function isActiveStep(idx: number): boolean {
  return stepList[idx]?.value === step.value;
}

const canProceed = computed(() => {
  switch (step.value) {
    case 'source':
      return true;
    case 'upload':
      return !!file || (!!googleSheets && !!googleSheetName);
    case 'mapping':
      return true;
    case 'validation':
      return true;
    case 'duplicates':
      return true;
    case 'confirm':
      return readyToImportCount.value > 0;
    default:
      return false;
  }
});

// Step navigation
function selectSource(value: string) {
  source.value = value as 'excel' | 'csv' | 'google';
  step.value = 'upload';
}

function handleFileSelect(e: Event) {
  const input = e.target as HTMLInputElement;
  if (input.files && input.files[0]) {
    handleFile(input.files[0]);
  }
}

function handleDrop(e: DragEvent) {
  if (e.dataTransfer && e.dataTransfer.files.length > 0) {
    handleFile(e.dataTransfer.files[0]);
  }
}

async function handleFile(f: File) {
  googleError.value = null;
  // Validate extension
  const ext = f.name.substring(f.name.lastIndexOf('.')).toLowerCase();
  if (!SUPPORTED_IMPORT_EXTENSIONS.includes(ext as any)) {
    googleError.value = `Unsupported file type: ${ext}. Supported: ${SUPPORTED_IMPORT_EXTENSIONS.join(', ')}`;
    return;
  }
  if (f.size > 10 * 1024 * 1024) {
    googleError.value = 'File is too large. Maximum size is 10MB.';
    return;
  }
  file.value = f;
  // Parse file
  try {
    parsedData.value = await parseFile(f);
    // Auto-detect columns
    columnMapping.value = detectColumns(parsedData.value.headers);
    step.value = 'mapping';
  } catch (err: any) {
    googleError.value = err.message || 'Failed to parse file.';
  }
}

async function validateAndPreview() {
  if (!parsedData.value) return;
  const { validatedRows: rows, summary } = validateAllRows(
    parsedData.value.rows,
    columnMapping.value,
    {
      existingStudents: props.existingStudents,
      divisions: props.divisions,
      academicStructure: academicStructure.value,
    },
  );
  validatedRows.value = rows;
  validationSummary.value = summary;
  step.value = 'validation';
}

async function connectGoogleSheet() {
  if (!googleUrl.value) {
    googleUrlError.value = 'Please enter a Google Sheets URL.';
    return;
  }
  googleUrlError.value = '';

  const config = getGoogleSheetsConfig();
  if (!config.configured) {
    googleError.value = config.error || 'Google Sheets is not configured.';
    return;
  }

  const url = extractSpreadsheetId(googleUrl.value);
  if (!url) {
    googleUrlError.value = 'Could not extract spreadsheet ID from the URL. Please check the URL.';
    return;
  }

  connecting.value = true;
  googleError.value = null;
  try {
    const authResult = await authenticate();
    if (authResult.error) {
      googleError.value = authResult.error;
      return;
    }
    const { info, error } = await getSheetInfo(url);
    if (error) {
      googleError.value = error;
      return;
    }
    googleSheets.value = info;
    googleSheetName.value = info.sheetNames?.[0] || '';
  } finally {
    connecting.value = false;
  }
}

async function fetchGoogleSheetData() {
  if (!googleSheets.value || !googleSheetName.value) return;

  fetching.value = true;
  googleError.value = null;
  try {
    const { result, error } = await fetchSheetData(
      googleSheets.value.spreadsheetId,
      googleSheetName.value,
    );
    if (error) {
      googleError.value = error;
      return;
    }
    if (result) {
      parsedData.value = result;
      columnMapping.value = detectColumns(result.headers);
      file.value = null;
      step.value = 'mapping';
    }
  } finally {
    fetching.value = false;
  }
}

async function handleDownloadReport() {
  // Download the validation rows as a CSV report
  const rows = validatedRows.value;
  const headerRow = ['Row', 'Status', 'Name', 'Guardian', 'Errors', 'Warnings'].join(',');
  const lines = [headerRow];
  for (const r of rows) {
    const status = r.valid ? 'Valid' : 'Invalid';
    const name = `${r.mapped.firstName || ''} ${r.mapped.lastName || ''}`.trim();
    const guardian = r.mapped.guardianName || '';
    const errors = r.errors.join('; ');
    const warnings = r.warnings.join('; ');
    lines.push(`"${r.rowIndex}","${status}","${name}","${guardian}","${errors}","${warnings}"`);
  }
  const csvContent = lines.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'validation-report.csv';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function goBack() {
  const idx = stepList.findIndex((s) => s.value === step.value);
  if (idx > 0) {
    step.value = stepList[idx - 1].value as ImportStepName;
  }
}

function goNext() {
  if (!canProceed.value) return;

  if (step.value === 'source') {
    step.value = 'upload';
  } else if (step.value === 'upload') {
    if (!parsedData.value) return;
    if (!columnMapping.value || Object.keys(columnMapping.value).length === 0) {
      columnMapping.value = detectColumns(parsedData.value.headers);
    }
    step.value = 'mapping';
  } else if (step.value === 'mapping') {
    void validateAndPreview();
  } else if (step.value === 'validation') {
    step.value = 'duplicates';
  } else if (step.value === 'duplicates') {
    step.value = 'confirm';
  }
}

async function startImport() {
  if (!parsedData.value || !validatedRows.value.length) return;

  importing.value = true;
  importProgress.value = { imported: 0, skipped: 0, failed: 0, total: readyToImportCount.value };
  progressPercent.value = 0;

  const ctx: ImportBatchContext = {
    schoolId: props.schoolId,
    divisions: props.divisions,
    academicStructure: academicStructure.value,
    enrollStudent: async (input) =>
      EnrollmentService.enrollStudent({ ...input, reason: 'IMPORT', source: 'IMPORT' }),
    createStudent: (data) => studentService.createStudent(data as any) as any,
    getOrCreateGuardian: (schoolId, data) => GuardianService.getOrCreateGuardian(schoolId, data),
  };

  const options: BatchImportOptions = {
    batchSize: 10,
    duplicateHandling: duplicateHandling.value,
    onProgress: (progress) => {
      importProgress.value = {
        ...progress,
        total: readyToImportCount.value + duplicateCount.value,
      };
      const total = importProgress.value.total;
      progressPercent.value = total > 0 ? Math.round(((progress.imported + progress.skipped + progress.failed) / total) * 100) : 0;
    },
  };

  try {
    const result = await batchImport(
      validatedRows.value.filter(
        (r) => r.valid && !(r.exists && duplicateHandling.value === 'SKIP'),
      ),
      ctx,
      options,
    );
    importResult.value = result;
    emit('imported');
  } catch (err: any) {
    importResult.value = {
      imported: 0,
      updated: 0,
      skipped: 0,
      failed: validatedRows.value.length,
      failures: [{ row: 0, message: err.message || 'Import failed' }],
      importedIds: [],
    };
  } finally {
    importing.value = false;
  }
}

function handleClose() {
  // Reset state
  step.value = 'source';
  source.value = 'csv';
  file.value = null;
  parsedData.value = null;
  columnMapping.value = {};
  validatedRows.value = [];
  validationSummary.value = { total: 0, ready: 0, warnings: 0, errors: 0 };
  duplicateHandling.value = 'SKIP';
  importResult.value = null;
  importing.value = false;
  importProgress.value = { imported: 0, skipped: 0, failed: 0, total: 0 };
  progressPercent.value = 0;
  googleUrl.value = '';
  googleUrlError.value = '';
  googleSheetName.value = '';
  googleSheets.value = null;
  connecting.value = false;
  fetching.value = false;
  googleError.value = null;
  emit('update:modelValue', false);
}
</script>
