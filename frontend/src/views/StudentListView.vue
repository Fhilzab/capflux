<template>
  <div class="flex min-h-[calc(100vh-56px)] flex-col bg-background">
    <StudentPageHeader @import="openImportDialog" @add="management.addStudent" />
    <StudentsAreaNav />

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
            @move-selected="openBulkMove('MOVEMENT')"
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
        :sessions="academicStore.sessions"
        :sections="divisionRows"
        :levels="academicStore.levels"
        :known-guardians="knownGuardians"
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

    <!-- Bulk movement / promotion (selection-scoped cohort move) -->
    <BulkStudentMovementModal
      v-if="bulkMoveLevelId"
      :model-value="showBulkMove"
      @update:model-value="showBulkMove = $event"
      mode="MOVEMENT"
      :from-level-id="bulkMoveLevelId"
      :sections="divisionRows"
      :selected-student-ids="Array.from(management.selectedIds.value ?? [])"
      @applied="onBulkApplied"
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
import { ref, computed, defineAsyncComponent, onMounted } from 'vue';
import { useStudentManagement } from '@/features/students/composables/useStudentManagement';
import StudentPageHeader from '@/features/students/components/StudentPageHeader.vue';
import StudentsAreaNav from '@/features/students/components/StudentsAreaNav.vue';
import StudentStats from '@/features/students/components/StudentStats.vue';
import StudentToolbar from '@/features/students/components/StudentToolbar.vue';
import StudentTable from '@/features/students/components/StudentTable.vue';
import StudentForm from '@/features/students/components/StudentForm.vue';
import StudentEmptyState from '@/features/students/components/StudentEmptyState.vue';
import CmModal from '@/components/ui/CmModal.vue';
import CmLoading from '@/components/ui/CmLoading.vue';
import CmAlert from '@/components/ui/CmAlert.vue';
import CmToast from '@/components/ui/CmToast.vue';
import { useAcademicStore } from '@/stores/academicStore';
import { useDivisionStore } from '@/stores/divisionStore';
import { db } from '@/offline/localDb';
import type { SchoolDivisionRow } from '@/offline/localDb';
import type { GuardianRowLike } from '@/features/students/formTypes';
import type { StudentSortField, FilterState, NormalizedStudent } from '@/features/students/types';

// Import/export dialogs pull in SheetJS — load them only when opened.
const StudentImportDialog = defineAsyncComponent(
  () => import('@/features/students/components/StudentImportDialog.vue')
);
const StudentExportDialog = defineAsyncComponent(
  () => import('@/features/students/components/StudentExportDialog.vue')
);
const BulkStudentMovementModal = defineAsyncComponent(
  () => import('@/features/students/components/BulkStudentMovementModal.vue')
);

const management = useStudentManagement();
const academicStore = useAcademicStore();
const divisionStore = useDivisionStore();
const formSubmitting = ref(false);

/** Divisions in the snake_case row shape the form expects. */
const divisionRows = computed<SchoolDivisionRow[]>(() =>
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

/** Known guardians for the existing-guardian picker (local cache). */
const knownGuardians = ref<GuardianRowLike[]>([]);

async function loadKnownGuardians() {
  const schoolId = management.schoolId;
  if (!schoolId) return;
  try {
    knownGuardians.value = await db.guardians.where('school_id').equals(schoolId).toArray();
  } catch {
    knownGuardians.value = [];
  }
}

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

// ── Bulk movement / promotion (selection-scoped) ────────────────────
const showBulkMove = ref(false);
const bulkMoveLevelId = ref('');
const bulkMoveMode = ref<'MOVEMENT' | 'PROMOTION'>('MOVEMENT');

async function openBulkMove(mode: 'MOVEMENT' | 'PROMOTION') {
  // Derive the source level from the selection's current placements.
  const ids = Array.from(management.selectedIds.value ?? []);
  if (ids.length === 0) return;
  try {
    const enrollments = await db.student_enrollments
      .where('student_id')
      .anyOf(ids)
      .toArray();
    const activeByRecency = enrollments
      .filter((e) => e.status === 'ACTIVE')
      .sort((a, b) => (b.effective_date ?? '').localeCompare(a.effective_date ?? ''));
    const levelCounts = new Map<string, number>();
    for (const e of activeByRecency) {
      levelCounts.set(e.level_id, (levelCounts.get(e.level_id) ?? 0) + 1);
    }
    const dominant = [...levelCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    if (!dominant) {
      showToast('warning', 'No placement', 'Selected students have no active academic placement to move from.');
      return;
    }
    if (levelCounts.size > 1) {
      showToast(
        'info',
        'Mixed levels',
        `Selection spans ${levelCounts.size} levels; using the most common one.`,
      );
    }
    bulkMoveLevelId.value = dominant[0];
    bulkMoveMode.value = mode;
    showBulkMove.value = true;
  } catch (e: any) {
    showToast('danger', 'Error', e?.message || 'Failed to plan bulk movement');
  }
}

async function onBulkApplied(result: { moved: number; failed: number }) {
  management.clearSelection();
  await management.refresh();
  showToast(
    result.failed > 0 ? 'warning' : 'success',
    result.failed > 0 ? 'Completed with failures' : 'Students moved',
    `${result.moved} moved, ${result.failed} failed.`,
  );
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

onMounted(async () => {
  management.load();
  void academicStore.initialize();
  void loadKnownGuardians();
});
</script>

<style scoped>
/* Students page specific overrides — uses existing CEMDS design tokens */
</style>
