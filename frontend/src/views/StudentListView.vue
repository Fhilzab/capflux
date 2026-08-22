<template>
  <div class="flex min-h-[calc(100vh-56px)] flex-col bg-background">
    <StudentPageHeader @import="openImportDialog" @add="management.addStudent" />

    <div class="flex-1 overflow-y-auto">
      <div class="p-6">
        <!-- Loading -->
        <div v-if="management.loading" class="flex justify-center py-12">
          <CmLoading :text="'Loading students...'" />
        </div>

        <!-- Error -->
        <CmAlert
          v-else-if="management.error"
          variant="danger"
          title="Error loading students"
          :description="management.error"
          :dismissible="true"
          @dismiss="clearError"
        />

        <!-- Empty state -->
        <StudentEmptyState
          v-else-if="management.students.length === 0"
          @action="management.addStudent"
          @secondary-action="openImportDialog"
        />

        <!-- Student management workspace -->
        <div v-else class="space-y-4">
          <StudentStats :stats="management.stats" />

          <StudentToolbar
            :search-query="management.searchQuery"
            @update:search-query="setSearchQuery"
            :filters="management.filters"
            :sort-field="management.sortField"
            :sort-order="management.sortOrder"
            :class-options="management.classOptions"
            :gender-options="management.genderOptions"
            :status-options="management.statusFilterOptions"
            :session-options="management.sessionOptions"
            :relationship-options="management.relationshipOptions"
            :sort-field-options="management.sortOptions"
            :selected-count="management.selectedCount"
            @filter-change="updateFilters"
            @clear-filters="management.clearFilters"
            @sort-change="handleSortChange"
            @export="openExportDialog"
            @export-selected="openExportDialog"
            @import="openImportDialog"
            @add="management.addStudent"
            @archive-selected="management.archiveSelected"
            @clear-selection="management.clearSelection"
          />

          <StudentTable
            :students="management.paginatedStudents"
            :sort-field="management.sortField"
            :sort-order="management.sortOrder"
            :selected-ids="management.selectedIds"
            :loading="management.loading"
            :current-page="management.currentPage"
            :total-pages="management.totalPages"
            :total-items="management.totalFiltered"
            @sort="handleSortChange"
            @toggle-select="management.toggleSelection"
            @toggle-select-all="management.toggleSelectAll"
            @view="management.viewStudent"
            @edit="management.editStudent"
            @archive="handleArchive"
            @financial-record="management.viewFinancialRecord"
            @page-change="setPage"
          />
        </div>
      </div>
    </div>

    <!-- Student Form (modal) -->
    <CmModal
      :model-value="management.showForm"
      @update:model-value="setShowForm"
      :title="management.editingStudent ? 'Edit Student' : 'Add Student'"
      size="lg"
    >
      <StudentForm
        :student="management.editingStudent"
        :loading="formSubmitting"
        :divisions="management.classOptions"
        @submit="handleFormSubmit"
        @cancel="management.closeForm"
      />
    </CmModal>

    <!-- Import Dialog -->
    <StudentImportDialog
      :model-value="management.showImportDialog"
      @update:model-value="setShowImportDialog"
      :school-id="management.schoolId"
      :divisions="management.divisions"
      :existing-students="management.students"
      @imported="handleImportComplete"
      @view-imported="handleViewImported"
    />

    <!-- Export Dialog -->
    <StudentExportDialog
      :model-value="management.showExportDialog"
      @update:model-value="setShowExportDialog"
      :all-students="management.students"
      :filtered-students="management.filteredStudents"
      :selected-students="management.selectedStudents"
      @export-done="handleExportComplete"
    />

    <!-- Toast -->
    <CmToast
      v-if="toast"
      :variant="toast.variant"
      :title="toast.title"
      :description="toast.description"
      :duration="toast.duration"
      @close="toast = null"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useStudentManagement } from '@/features/students/composables/useStudentManagement';
import StudentPageHeader from '@/features/students/components/StudentPageHeader.vue';
import StudentStats from '@/features/students/components/StudentStats.vue';
import StudentToolbar from '@/features/students/components/StudentToolbar.vue';
import StudentTable from '@/features/students/components/StudentTable.vue';
import StudentForm from '@/features/students/components/StudentForm.vue';
import StudentImportDialog from '@/features/students/components/StudentImportDialog.vue';
import StudentExportDialog from '@/features/students/components/StudentExportDialog.vue';
import StudentEmptyState from '@/features/students/components/StudentEmptyState.vue';
import CmModal from '@/components/ui/CmModal.vue';
import CmLoading from '@/components/ui/CmLoading.vue';
import CmAlert from '@/components/ui/CmAlert.vue';
import CmToast from '@/components/ui/CmToast.vue';
import type { StudentSortField, FilterState, NormalizedStudent } from '@/features/students/types';

const management = useStudentManagement();
const formSubmitting = ref(false);

const toast = ref<{
  variant: 'success' | 'warning' | 'danger' | 'info';
  title: string;
  description: string;
  duration: number;
} | null>(null);

function showToast(
  variant: 'success' | 'warning' | 'danger' | 'info',
  title: string,
  description: string,
  duration = 4000,
) {
  toast.value = { variant, title, description, duration };
}

function setShowForm(value: boolean) {
  management.showForm.value = value;
}
function setShowImportDialog(value: boolean) {
  management.showImportDialog.value = value;
}
function setShowExportDialog(value: boolean) {
  management.showExportDialog.value = value;
}

function openImportDialog() {
  management.showImportDialog.value = true;
}
function openExportDialog() {
  management.showExportDialog.value = true;
}

function setSearchQuery(query: string) {
  management.searchQuery.value = query;
}

function setPage(page: number) {
  management.currentPage.value = page;
}

function handleSortChange(field: string, order: 'asc' | 'desc') {
  management.sortField.value = field as StudentSortField;
  management.sortOrder.value = order;
}

function updateFilters(partial: Partial<FilterState>) {
  Object.assign(management.filters, partial);
  management.currentPage.value = 1;
}

function clearError() {
  management.error.value = null;
}

function handleArchive(student: NormalizedStudent) {
  management.archiveStudent(student.id);
}

async function handleFormSubmit(data: Record<string, any>) {
  formSubmitting.value = true;
  try {
    await management.submitStudent(data);
    showToast(
      'success',
      'Success',
      management.editingStudent.value
        ? 'Student updated successfully'
        : 'Student registered successfully',
    );
    management.closeForm();
    await management.refresh();
  } catch (err: any) {
    showToast('danger', 'Error', err.message || 'Failed to save student');
  } finally {
    formSubmitting.value = false;
  }
}

function handleImportComplete() {
  showToast('success', 'Import Complete', 'Students imported successfully');
  management.refresh();
}

function handleViewImported() {
  management.refresh();
}

function handleExportComplete() {
  showToast('success', 'Export Complete', 'Student data exported successfully');
}

onMounted(() => {
  management.load();
});
</script>

<style scoped>
/* Students page specific overrides — uses existing CEMDS design tokens */
</style>
