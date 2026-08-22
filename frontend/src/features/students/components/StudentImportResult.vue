<template>
  <div class="space-y-4">
    <!-- Summary cards -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div class="rounded-input bg-success/10 px-4 py-3 text-center">
        <div class="text-2xl font-semibold text-success">{{ result.imported }}</div>
        <div class="text-xs text-text-muted">Imported successfully</div>
      </div>
      <div class="rounded-input bg-info/10 px-4 py-3 text-center">
        <div class="text-2xl font-semibold text-info">{{ result.updated }}</div>
        <div class="text-xs text-text-muted">Updated</div>
      </div>
      <div class="rounded-input bg-warning/10 px-4 py-3 text-center">
        <div class="text-2xl font-semibold text-warning">{{ result.skipped }}</div>
        <div class="text-xs text-text-muted">Skipped</div>
      </div>
      <div class="rounded-input bg-danger/10 px-4 py-3 text-center">
        <div class="text-2xl font-semibold text-danger">{{ result.failed }}</div>
        <div class="text-xs text-text-muted">Failed</div>
      </div>
    </div>

    <!-- Total -->
    <div class="text-sm text-text-secondary">
      Processed {{ result.imported + result.updated + result.skipped + result.failed }} record(s).
    </div>

    <!-- Failures list -->
    <div
      v-if="result.failures && result.failures.length > 0"
      class="border border-border rounded-input overflow-hidden"
    >
      <div class="bg-surface/50 px-3 py-2 text-sm font-medium text-text-primary">
        Failed rows ({{ result.failures.length }})
      </div>
      <div class="max-h-48 overflow-y-auto divide-y divide-divider/50">
        <div
          v-for="failure in result.failures"
          :key="failure.row"
          class="px-3 py-2"
        >
          <div class="flex justify-between text-sm">
            <span class="font-medium text-danger">Row {{ failure.row }}</span>
            <span class="text-text-secondary">{{ failure.message }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Actions -->
    <div class="flex flex-col sm:flex-row gap-2 pt-2">
      <CmButton
        v-if="result.imported > 0"
        variant="primary"
        size="sm"
        @click="$emit('view-imported')"
      >
        <Eye class="mr-2 h-4 w-4" />
        View imported students
      </CmButton>
      <CmButton
        v-if="result.failures && result.failures.length > 0"
        variant="secondary"
        size="sm"
        @click="downloadReport"
      >
        <Download class="mr-2 h-4 w-4" />
        Download error report
      </CmButton>
      <CmButton
        variant="secondary"
        size="sm"
        @click="$emit('import-another')"
      >
        <FileUp class="mr-2 h-4 w-4" />
        Import another file
      </CmButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Download, Eye, FileUp } from '@lucide/vue';
import CmButton from '@/components/ui/CmButton.vue';
import type { ImportResult } from '../types';

const props = defineProps<{ result: ImportResult }>();
defineEmits(['view-imported', 'download-errors', 'import-another']);

function downloadReport() {
  const lines = ['Row,Error message'];
  props.result.failures.forEach((f) => {
    lines.push(`"${f.row}","${f.message.replace(/"/g, '""')}"`);
  });
  const csvContent = lines.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'import-errors.csv';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
</script>
