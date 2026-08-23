import { ref, computed, reactive, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useStudentStore } from '@/stores/studentStore';
import { useSchoolStore } from '@/stores/schoolStore';
import { useDivisionStore } from '@/stores/divisionStore';
import { studentService } from '@/shared/students/StudentService';
import { GuardianService } from '@/shared/services/GuardianService';
import { EnrollmentService } from '@/shared/enrollment/EnrollmentService';
import { useAcademicStore } from '@/stores/academicStore';
import { db } from '@/offline/localDb';
import { normalizeStudent, isStudentActive, isStudentArchived, sortStudents } from '../utils/normalizeStudent';
import {
  GUARDIAN_RELATIONSHIP_OPTIONS,
  guardianRelationshipLabel,
} from '@/shared/guardians/relationshipTypes';
import type { NormalizedStudent, StudentSortField, FilterState } from '../types';

const DEBOUNCE_MS = 300;

export function useStudentManagement() {
  const router = useRouter();
  const studentStore = useStudentStore();
  const schoolStore = useSchoolStore();
  const divisionStore = useDivisionStore();
  const academicStore = useAcademicStore();

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
      return GUARDIAN_RELATIONSHIP_OPTIONS;
    }
    return Array.from(rels).map(r => ({ value: r, label: guardianRelationshipLabel(r) }));
  });

  const sortOptions = [
    { value: 'name', label: 'Name' },
    { value: 'admissionNumber', label: 'Admission number' },
    { value: 'class', label: 'Class' },
    { value: 'dateRegistered', label: 'Date registered' },
    { value: 'status', label: 'Status' },
  ];

  // Academic session filter options come from the local academic cache.
  const sessionOptions = computed(() => {
    void academicStore.sessions;
    return academicStore.sessions
      .slice()
      .sort((a, b) => (b.start_date ?? '').localeCompare(a.start_date ?? ''))
      .map((s) => ({ value: s.name, label: s.name }));
  });

  // Statistics — shaped for the MetricCard grid on the Students page.
  const stats = computed(() => {
    const all = students.value;
    const uniqueLevels = new Set(
      all.map((s) => s.levelName || s.class).filter((c) => c && c !== '—')
    );
    const uniqueGuardians = new Set<string>();
    for (const s of all) {
      if (s.guardian?.phone) uniqueGuardians.add(s.guardian.phone);
      else if (s.guardian?.id) uniqueGuardians.add(s.guardian.id);
    }
    const active = all.filter((s) => isStudentActive(s.status)).length;
    const archived = all.filter((s) => isStudentArchived(s.status)).length;
    return [
      {
        key: 'total',
        label: 'Total Students',
        value: all.length,
        description: 'All registered students',
        icon: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z',
      },
      {
        key: 'active',
        label: 'Active Students',
        value: active,
        description: 'Currently enrolled',
        icon: 'M12 22C6.48 22 2 17.52 2 12S6.48 2 12 2s10 4.48 10 10-4.48 10-10 10zm0-18c-4.41 0-8 3.59-8 8s3.59 8 8 8 8-3.59 8-8-3.59-8-8-8z',
      },
      {
        key: 'archived',
        label: 'Archived Students',
        value: archived,
        description: 'Inactive / left',
        icon: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z',
      },
      {
        key: 'levels',
        label: 'Academic Levels',
        value: uniqueLevels.size,
        description: 'Levels in use',
        icon: 'M4 6h16v2H4V6zm0 4h16v2H4v-2zm0 4h10v2H4v-2z',
      },
      {
        key: 'guardians',
        label: 'Guardians',
        value: uniqueGuardians.size,
        description: 'Unique guardians',
        icon: 'M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-5.8 2.6-5.8 5.8V22h11.6v-1.8c0-3.2-2.6-5.8-5.8-5.8z',
      },
    ];
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
      // classOptions hold division IDs; students carry the resolved display
      // name (or divisionId fallback). Match either against the filter ID.
      const division = divisions.value.find((d) => d.id === filters.class);
      const divisionName = division?.name || division?.code || '';
      result = result.filter(
        (s) => s.divisionId === filters.class || (divisionName && s.class === divisionName)
      );
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
      void academicStore.initialize();
      const result = await studentStore.getStudentsWithGuardians(schoolId.value, true);
      const rawList = Array.isArray(result) ? result : [];
      const normalized = rawList.map((s) => normalizeStudent(s, divisions.value));

      // Hydrate current academic placement (session/section/level) per student.
      for (const student of normalized) {
        try {
          const enrollment = await EnrollmentService.getActiveEnrollment(student.id);
          if (enrollment) {
            (student as any).sessionId = enrollment.academic_session_id;
            (student as any).sectionId = enrollment.section_id;
            (student as any).levelId = enrollment.level_id;
            const [section, level] = await Promise.all([
              db.school_divisions.get(enrollment.section_id),
              db.academic_levels.get(enrollment.level_id),
            ]);
            if (level) (student as any).levelName = level.name;
            if (section) {
              (student as any).sectionName = section.name;
              if (!student.divisionId) student.divisionId = section.id;
            }
          }
        } catch {
          // Placement hydration is best-effort.
        }
      }

      students.value = normalized;
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

    // Resolve the guardian: link an existing one, or create/reuse by phone.
    let guardianId: string;
    if (data.guardianMode === 'existing' && data.existingGuardianId) {
      guardianId = data.existingGuardianId;
    } else {
      const guardian = await GuardianService.getOrCreateGuardian(schoolId, {
        full_name: data.guardianName || data.guardian?.fullName || '',
        primary_phone: data.guardianPhone || data.guardian?.phone || '',
        secondary_phone: data.guardianSecondaryPhone || data.guardian?.secondaryPhone || '',
        email: data.guardianEmail || data.guardian?.email || '',
        relationship: data.relationship || data.guardian?.relationship || 'OTHER',
      });
      guardianId = guardian.id;
    }

    const payload = {
      schoolId,
      divisionId: data.sectionId || data.className || '',
      guardianId,
      firstName: data.firstName,
      lastName: data.lastName,
      middleName: data.middleName,
      gender: data.gender,
      dateOfBirth: data.dateOfBirth,
      admissionNumber: data.admissionNumber,
      admissionDate: data.dateOfAdmission || new Date().toISOString(),
      registeredAt: new Date().toISOString(),
      relationshipToGuardian: data.relationship || 'OTHER',
      discountRate: 0,
      status: data.status || 'ACTIVE',
      academicSession: undefined as string | undefined,
    };

    if (editingStudent.value) {
      const result = await studentService.updateStudent(editingStudent.value.id, payload);
      if (result.error) {
        throw new Error(result.error.message || 'Failed to update student');
      }
    } else {
      const result = await studentService.createStudent(payload);
      if (result.error) {
        throw new Error(result.error.message || 'Failed to create student');
      }
    }

    // Create the academic placement record when structure info was provided.
    // Student creation is offline-first; the created student id comes from the
    // refreshed local cache (admission number + name match).
    if (!editingStudent.value && data.academicSessionId && data.sectionId && data.levelId) {
      await enrollCreatedStudent(data);
    }

    await refresh();
  }

  /** Find the just-created student locally and attach its initial enrollment. */
  async function enrollCreatedStudent(data: Record<string, any>): Promise<void> {
    try {
      const schoolId = schoolStore.currentSchoolId;
      const rows = (await db.students.where('school_id').equals(schoolId).toArray()) as any[];
      const candidates = rows.filter(
        (s) =>
          s.first_name === data.firstName &&
          s.last_name === data.lastName &&
          (!data.admissionNumber || s.admission_number === data.admissionNumber)
      );
      const newest = candidates.sort((a, b) =>
        (b.created_at ?? '').localeCompare(a.created_at ?? '')
      )[0];
      if (!newest) return;
      await EnrollmentService.enrollStudent({
        schoolId,
        studentId: newest.id,
        sessionId: data.academicSessionId,
        sectionId: data.sectionId,
        levelId: data.levelId,
        reason: 'INITIAL',
        source: 'MANUAL',
      });
    } catch {
      // Placement is optional at registration; never block creation on it.
    }
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
