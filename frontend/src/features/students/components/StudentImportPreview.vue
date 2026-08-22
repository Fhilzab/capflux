<template>
  <div class="space-y-4">
    <!-- Summary -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div class="rounded-input bg-surface/30 px-3 py-2 text-center">
        <div class="text-2xl font-semibold text-text-primary">{{ summary.total }}</div>
        <div class="text-xs text-text-muted">Total records</div>
      </div>
      <div class="rounded-input bg-success/10 px-3 py-2 text-center">
        <div class="text-2xl font-semibold text-success">{{ summary.ready }}</div>
        <div class="text-xs text-text-muted">Ready to import</div>
      </div>
      <div class="rounded-input bg-warning/10 px-3 py-2 text-center">
        <div class="text-2xl font-semibold text-warning">{{ summary.warnings }}</div>
        <div class="text-xs text-text-muted">Warnings</div>
      </div>
      <div class="rounded-input bg-danger/10 px-3 py-2 text-center">
        <div class="text-2xl font-semibold text-danger">{{ summary.errors }}</div>
        <div class="text-xs text-text-muted">Errors</div>
      </div>
    </div>

    <!-- Row preview -->
    <div class="border border-border rounded-input overflow-hidden">
      <div class="max-h-72 overflow-y-auto">
        <table class="min-w-full divide-y divide-divider">
          <thead class="bg-surface/50 sticky top-0">
            <tr>
              <th class="px-3 py-2 text-left text-xs font-medium uppercase text-text-muted">
                Row
              </th>
              <th class="px-3 py-2 text-left text-xs font-medium uppercase text-text-muted">
                First name
              </th>
              <th class="px-3 py-2 text-left text-xs font-medium uppercase text-text-muted">
                Last name
              </th>
              <th class="px-3 py-2 text-left text-xs font-medium uppercase text-text-muted">
                Admission #
              </th>
              <th class="px-3 py-2 text-left text-xs font-medium uppercase text-text-muted">
                Guardian
              </th>
              <th class="px-3 py-2 text-left text-xs font-medium uppercase text-text-muted">
                Status
              </th>
              <th class="px-3 py-2 text-left text-xs font-medium uppercase text-text-muted">
                Issues
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-divider/50 bg-card">
            <tr
              v-for="row in paginatedRows"
              :key="row.rowIndex"
              :class="rowClass(row)"
            >
              <td class="px-3 py-1.5 text-sm">{{ row.rowIndex }}</td>
              <td class="px-3 py-1.5 text-sm text-text-primary">{{ row.mapped.firstName || '&mdash;' }}</td>
              <td class="px-3 py-1.5 text-sm text-text-primary">{{ row.mapped.lastName || '&mdash;' }}</td>
              <td class="px-3 py-1.5 text-sm text-text-muted">{{ row.mapped.admissionNumber || '&mdash;' }}</td>
              <td class="px-3 py-1.5 text-sm text-text-muted">{{ row.mapped.guardianName || '&mdash;' }}</td>
              <td class="px-3 py-1.5">
                <span
                  :class="statusPillClass(row)"
                  class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                >
                  {{ row.valid ? (row.exists ? 'Exists' : 'Valid') : 'Invalid' }}
                  <span
                    v-if="row.warnings.length > 0 && row.valid"
                    class="ml-1 text-warning"
                  >(warn)</span>
                </span>
              </td>
              <td class="px-3 py-1.5">
                <span
                  v-if="row.errors.length > 0"
                  class="text-xs text-danger"
                  title="Click to expand"
                >
                  <AlertCircle class="inline h-3 w-3 mr-1" />
                  {{ row.errors.length }} error(s)
                </span>
                <span
                  v-else-if="row.warnings.length > 0"
                  class="text-xs text-warning"
                >
                  <AlertCircle class="inline h-3 w-3 mr-1" />
                  {{ row.warnings.length }} warning(s)
                </span>
                <span v-else class="text-xs text-text-muted">OK</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Pagination -->
    <div
      v-if="totalPages > 1"
      class="flex items-center justify-between text-sm"
    >
      <span class="text-text-muted">
        Showing {{ startIndex + 1 }}&ndash;{{ endIndex }} of {{ summary.total }} rows
      </span>
      <div class="flex items-center gap-1">
        <button
          :disabled="currentPage === 1"
          @click="currentPage--"
          class="px-2 py-1 text-sm text-text-secondary hover:text-text-primary disabled:opacity-50"
        >
          Prev
        </button>
        <span class="text-text-muted">
          Page {{ currentPage }} of {{ totalPages }}
        </span>
        <button
          :disabled="currentPage === totalPages"
          @click="currentPage++"
          class="px-2 py-1 text-sm text-text-secondary hover:text-text-primary disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>

    <!-- Download error report -->
    <div
      v-if="summary.errors > 0 || summary.warnings > 0"
      class="flex justify-end"
    >
      <button
        @click="downloadReport"
        class="text-sm text-brand hover:text-brand-hover flex items-center gap-1"
      >
        <Download class="h-4 w-4" />
        Download validation report
      </button>
    </div>

    <!-- Invalid rows detail -->
    <div
      v-if="invalidRows.length > 0"
      class="border border-border rounded-input p-3 bg-card"
    >
      <h4 class="text-sm font-medium text-text-primary mb-2">
        Rows with errors ({{ invalidRows.length }})
      </h4>
      <div class="space-y-1 max-h-32 overflow-y-auto">
        <div
          v-for="row in invalidRows"
          :key="row.rowIndex"
          class="text-xs"
        >
          <span class="font-medium text-danger">Row {{ row.rowIndex }}:</span>
          <span class="text-text-secondary">{{ row.errors.join('; ') }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { AlertCircle, Download } from '@lucide/vue';
import type { ValidatedRow, ImportSummary } from '../types';

interface Props {
  validatedRows: ValidatedRow[];
  summary: ImportSummary;
}

const props = defineProps<Props>();

const currentPage = ref(1);
const pageSize = 10;

const paginatedRows = computed(() => {
  const start = (currentPage.value - 1) * pageSize;
  return props.validatedRows.slice(start, start + pageSize);
});

const startIndex = computed(() => (currentPage.value - 1) * pageSize);
const endIndex = computed(() =>
  Math.min(startIndex.value + pageSize, props.validatedRows.length),
);
const totalPages = computed(() =>
  Math.max(1, Math.ceil(props.validatedRows.length / pageSize)),
);

const invalidRows = computed(() =>
  props.validatedRows.filter((r) => !r.valid),
);

function rowClass(row: ValidatedRow): string {
  if (!row.valid) return 'bg-danger/5';
  if (row.warnings.length > 0) return 'bg-warning/5';
  if (row.exists) return 'bg-info/5';
  return '';
}

function statusPillClass(row: ValidatedRow): string {
  if (!row.valid) return 'bg-danger/10 text-danger';
  if (row.exists) return 'bg-info/10 text-info';
  if (row.warnings.length > 0) return 'bg-warning/10 text-warning';
  return 'bg-success/10 text-success';
}

function downloadReport() {
  const lines: string[] = ['Row,Status,First Name,Last Name,Admission Number,Guardian,Errors,Warnings'];

  props.validatedRows.forEach((row) => {
    const status = row.valid ? (row.exists ? 'Exists' : 'Valid') : 'Invalid';
    const cells = [
      row.rowIndex,
      status,
      row.mapped.firstName || '',
      row.mapped.lastName || '',
      row.mapped.admissionNumber || '',
      row.mapped.guardianName || '',
      `"${row.errors.join('; ')}"`,
      `"${row.warnings.join('; ')}"`,
    ];
    lines.push(cells.map((c) => `"${c}"`).join(','));
  });

  const csvContent = lines.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'import-validation-report.csv';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Reset to page 1 when validated rows change
watch(
  () => props.validatedRows,
  () => {
    currentPage.value = 1;
  },
);
</script>
