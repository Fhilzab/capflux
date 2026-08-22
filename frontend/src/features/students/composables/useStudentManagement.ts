import { ref, computed, reactive, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useStudentStore } from '@/stores/studentStore';
import { useSchoolStore } from '@/stores/schoolStore';
import { useDivisionStore } from '@/stores/divisionStore';
import { studentService } from '@/shared/students/StudentService';
import { GuardianService } from '@/shared/services/GuardianService';
import { normalizeStudent, isStudentActive, isStudentArchived, sortStudents } from '../utils/normalizeStudent';
import type { NormalizedStudent, StudentSortField, FilterState } from '../types';

const DEBOUNCE_MS = 300;

export function useStudentManagement() {
  const router = useRouter();
  const studentStore = useStudentStore();
  const schoolStore = useSchoolStore();
  const divisionStore = useDivisionStore();

  // Core data
  const students = ref<NormalizedStudent[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // Search
  const searchQuery = ref('');

  // Filters
  const filters = reactive<FilterState>({
    class: '',
    gender: '',
    status: 'ALL',
    academicSession: '',
    relationship: '',
  });

  // Sort
  const sortField = ref<StudentSortField>('name');
  const sortOrder = ref<'asc' | 'desc'>('asc');

  // Selection
  const selectedIds = ref<Set<string>>(new Set());

  // Pagination
  const currentPage = ref(1);
  const itemsPerPage = ref(20);

  // Editing
  const editingStudent = ref<NormalizedStudent | null>(null);
  const showForm = ref(false);

  // Export/import dialogs
  const showExportDialog = ref(false);
  const showImportDialog = ref(false);

  // Search debounce
  let searchDebounce: ReturnType<typeof setTimeout> | null = null;

  // --- Derived state ---

  const schoolId = computed(() => schoolStore.currentSchoolId);
  const divisions = computed(() => divisionStore.activeDivisions);
  const currentSchool = computed(() => schoolStore.currentSchool?.name || '');

  const classOptions = computed(() => {
    return divisions.value.map(d => ({
      value: d.id,
      label: d.name || d.code,
    }));
  });

  const genderOptions = [
    { value: 'Male', label: 'Male' },
    { value: 'Female', label: 'Female' },
    { value: 'Other', label: 'Other' },
  ];

  const statusFilterOptions = [
    { value: 'ALL', label: 'All statuses' },
    { value: 'ACTIVE', label: 'Active' },
    { value: 'ARCHIVED', label: 'Archived' },
  ];

  const relationshipOptions = computed(() => {
    const rels = new Set<string>();
    for (const s of students.value) {
      if (s.guardian?.relationship) {
        rels.add(s.guardian.relationship);
      }
    }
    if (rels.size === 0) {
      return [
        { value: 'FATHER', label: 'Father' },
        { value: 'MOTHER', label: 'Mother' },
        { value: 'GUARDIAN', label: 'Guardian' },
        { value: 'OTHER', label: 'Other' },
      ];
    }
    return Array.from(rels).map(r => ({ value: r, label: r }));
  });

  const sortOptions = [
    { value: 'name', label: 'Name' },
    { value: 'admissionNumber', label: 'Admission number' },
    { value: 'class', label: 'Class' },
    { value: 'dateRegistered', label: 'Date registered' },
    { value: 'status', label: 'Status' },
  ];

  const sessionOptions: { value: string; label: string }[] = [];

  // Statistics
  const stats = computed(() => {
    const all = students.value;
    const uniqueClasses = new Set(all.map(s => s.class).filter(c => c && c !== '—'));
    const uniqueGuardians = new Set<string>();
    for (const s of all) {
      if (s.guardian?.phone) {
        uniqueGuardians.add(s.guardian.phone);
      } else if (s.guardian?.id) {
        uniqueGuardians.add(s.guardian.id);
      }
    }
    return {
      total: all.length,
      active: all.filter(s => isStudentActive(s.status)).length,
      archived: all.filter(s => isStudentArchived(s.status)).length,
      classes: uniqueClasses.size,
      guardians: uniqueGuardians.size,
    };
  });

  // Filtered + sorted students
  const sortedStudents = computed(() => {
    return sortStudents(students.value, sortField.value, sortOrder.value);
  });

  const filteredStudents = computed(() => {
    let result = sortedStudents.value;
    const q = searchQuery.value.trim().toLowerCase();

    if (q) {
      result = result.filter(student => {
        const fullName = `${student.firstName} ${student.middleName ? student.middleName + ' ' : ''}${student.lastName}`.toLowerCase();
        if (fullName.includes(q)) return true;
        if ((student.firstName || '').toLowerCase().includes(q)) return true;
        if ((student.lastName || '').toLowerCase().includes(q)) return true;
        if ((student.admissionNumber || '').toLowerCase().includes(q)) return true;
        if ((student.studentId || '').toLowerCase().includes(q)) return true;
        if (student.guardian?.fullName && student.guardian.fullName.toLowerCase().includes(q)) return true;
        if (student.guardian?.phone && student.guardian.phone.toLowerCase().includes(q)) return true;
        if (student.guardian?.email && student.guardian.email.toLowerCase().includes(q)) return true;
        return false;
      });
    }

    if (filters.class) {
      result = result.filter(s => s.class === filters.class);
    }
    if (filters.gender) {
      result = result.filter(s => (s.gender || '').toLowerCase() === filters.gender.toLowerCase());
    }
    if (filters.status !== 'ALL') {
      if (filters.status === 'ACTIVE') {
        result = result.filter(s => isStudentActive(s.status));
      } else {
        result = result.filter(s => isStudentArchived(s.status));
      }
    }
    if (filters.academicSession) {
      result = result.filter(s => {
        const session = s.academicSession || '';
        return session.toLowerCase().includes(filters.academicSession.toLowerCase());
      });
    }
    if (filters.relationship) {
      result = result.filter(s => {
        const rel = s.guardian?.relationship || '';
        return rel.toLowerCase() === filters.relationship.toLowerCase();
      });
    }

    return result;
  });

  const totalFiltered = computed(() => filteredStudents.value.length);
  const totalPages = computed(() => Math.ceil(totalFiltered.value / itemsPerPage.value) || 1);

  const paginatedStudents = computed(() => {
    const start = (currentPage.value - 1) * itemsPerPage.value;
    return filteredStudents.value.slice(start, start + itemsPerPage.value);
  });

  // Selection helpers
  const hasSelection = computed(() => selectedIds.value.size > 0);
  const selectedCount = computed(() => selectedIds.value.size);

  const selectedStudents = computed(() => {
    const set = selectedIds.value;
    return students.value.filter(s => set.has(s.id));
  });

  const isAllSelectedOnPage = computed(() => {
    if (paginatedStudents.value.length === 0) return false;
    return paginatedStudents.value.every(s => selectedIds.value.has(s.id));
  });

  const isSomeSelectedOnPage = computed(() => {
    return paginatedStudents.value.some(s => selectedIds.value.has(s.id));
  });

  // --- Actions ---

  async function load() {
    if (!schoolId.value) return;
    loading.value = true;
    error.value = null;
    try {
      await divisionStore.loadDivisions();
      const result = await studentStore.getStudentsWithGuardians(schoolId.value, true);
      if (Array.isArray(result)) {
        students.value = result.map(s => normalizeStudent(s, divisions.value));
      } else {
        students.value = [];
      }
    } catch (err: any) {
      error.value = err?.message || 'Failed to load students';
    } finally {
      loading.value = false;
    }
  }

  async function refresh() {
    searchQuery.value = '';
    filters.class = '';
    filters.gender = '';
    filters.status = 'ALL';
    filters.academicSession = '';
    filters.relationship = '';
    selectedIds.value.clear();
    await load();
  }

  function setSearchQuery(query: string) {
    if (searchDebounce) clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      searchQuery.value = query;
      currentPage.value = 1;
    }, DEBOUNCE_MS);
  }

  function setFilter<K extends keyof FilterState>(key: K, value: FilterState[K]) {
    filters[key] = value;
    currentPage.value = 1;
  }

  function clearFilters() {
    filters.class = '';
    filters.gender = '';
    filters.status = 'ALL';
    filters.academicSession = '';
    filters.relationship = '';
  }

  function setSort(field: StudentSortField) {
    if (sortField.value === field) {
      sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc';
    } else {
      sortField.value = field;
      sortOrder.value = 'asc';
    }
  }

  function toggleSortDirection() {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc';
  }

  function toggleSelection(id: string) {
    if (selectedIds.value.has(id)) {
      selectedIds.value.delete(id);
    } else {
      selectedIds.value.add(id);
    }
  }

  function toggleSelectAll(checked: boolean) {
    if (checked) {
      for (const s of paginatedStudents.value) {
        selectedIds.value.add(s.id);
      }
    } else {
      for (const s of paginatedStudents.value) {
        selectedIds.value.delete(s.id);
      }
    }
  }

  function clearSelection() {
    selectedIds.value.clear();
  }

  async function archiveStudent(id: string) {
    try {
      await studentStore.deactivateStudent(id);
      await load();
    } catch (err: any) {
      error.value = err?.message || 'Failed to archive student';
    }
  }

  async function archiveSelected() {
    const ids = Array.from(selectedIds.value);
    for (const id of ids) {
      try {
        await studentStore.deactivateStudent(id);
      } catch {
        // Individual failures are okay — continue with others
      }
    }
    selectedIds.value.clear();
    await load();
  }

  function viewStudent(student: NormalizedStudent) {
    router.push({ name: 'StudentDetail', params: { id: student.id } });
  }

  function editStudent(student: NormalizedStudent) {
    editingStudent.value = student;
  }

  function addStudent() {
    editingStudent.value = null;
    showForm.value = true;
  }

  function closeForm() {
    editingStudent.value = null;
    showForm.value = false;
  }

  function viewFinancialRecord(student: NormalizedStudent) {
    router.push({ name: 'BillingView', query: { student: student.id } });
  }

  function openExportDialog() {
    showExportDialog.value = true;
  }

  function openImportDialog() {
    showImportDialog.value = true;
  }

  async function submitStudent(data: Record<string, any>): Promise<void> {
    const schoolId = schoolStore.currentSchoolId;

    const guardian = await GuardianService.getOrCreateGuardian(schoolId, {
      full_name: data.guardian?.fullName || data.guardianFullName || '',
      primary_phone: data.guardian?.phone || data.guardianPhone || '',
      secondary_phone: data.guardian?.secondaryPhone || '',
      email: data.guardian?.email || '',
      relationship: data.guardian?.relationship || data.relationship || 'OTHER',
    });

    const result = await studentService.createStudent({
      schoolId,
      divisionId: data.className || '',
      guardianId: guardian.id,
      firstName: data.firstName,
      lastName: data.lastName,
      middleName: data.middleName,
      gender: data.gender,
      dateOfBirth: data.dateOfBirth,
      admissionNumber: data.admissionNumber,
      admissionDate: data.dateOfAdmission || new Date().toISOString(),
      registeredAt: new Date().toISOString(),
      relationshipToGuardian: data.guardian?.relationship || data.relationship || 'OTHER',
      discountRate: 0,
      status: data.status || 'ACTIVE',
      academicSession: data.academicSession || undefined,
    });

    if (result.error) {
      throw new Error(result.error.message || 'Failed to create student');
    }

    await refresh();
  }

  // Returned as a reactive object so refs/computeds auto-unwrap when accessed
  // as properties (management.loading) in templates and handlers.
  return reactive({
    // State
    students,
    loading,
    error,
    searchQuery,
    filters,
    sortField,
    sortOrder,
    selectedIds,
    currentPage,
    itemsPerPage,
    editingStudent,
    showForm,
    showExportDialog,
    showImportDialog,

    // Derived
    schoolId,
    schoolName: currentSchool,
    divisions,
    classOptions,
    genderOptions,
    statusFilterOptions,
    relationshipOptions,
    sortOptions,
    sessionOptions,
    stats,
    sortedStudents,
    filteredStudents,
    totalFiltered,
    totalPages,
    paginatedStudents,
    hasSelection,
    selectedCount,
    selectedStudents,
    isAllSelectedOnPage,
    isSomeSelectedOnPage,

    // Actions
    load,
    refresh,
    setSearchQuery,
    setFilter,
    clearFilters,
    setSort,
    toggleSortDirection,
    toggleSelection,
    toggleSelectAll,
    clearSelection,
    archiveStudent,
    archiveSelected,
    viewStudent,
    editStudent,
    addStudent,
    closeForm,
    submitStudent,
    viewFinancialRecord,
    openExportDialog,
    openImportDialog,
  });
}
