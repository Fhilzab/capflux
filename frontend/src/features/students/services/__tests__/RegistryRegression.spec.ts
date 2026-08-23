/**
 * Regression tests for the six bugs fixed during the registry refactor:
 * 1. Guardian field mapping (form → submit)
 * 2. Edit updates instead of creating
 * 3. Class filter matches division IDs against names
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// --- Hoisted mocks -------------------------------------------------------

const { guardianCreateMock } = vi.hoisted(() => ({
  guardianCreateMock: vi.fn(),
}));

const { studentServiceMock } = vi.hoisted(() => ({
  studentServiceMock: {
    createStudent: vi.fn(),
    updateStudent: vi.fn(),
    loadStudents: vi.fn(),
    searchStudents: vi.fn(),
    activateStudent: vi.fn(),
    deactivateStudent: vi.fn(),
    createGuardian: vi.fn(),
    updateGuardian: vi.fn(),
    loadGuardians: vi.fn(),
    searchGuardians: vi.fn(),
    getGuardianStudents: vi.fn(),
  },
}));

vi.mock('@/shared/services/GuardianService', () => ({
  GuardianService: { getOrCreateGuardian: guardianCreateMock },
}));

vi.mock('@/shared/students/StudentService', () => ({
  studentService: studentServiceMock,
}));

vi.mock('@/stores/studentStore', () => ({
  useStudentStore: () => ({
    getStudentsWithGuardians: vi.fn().mockResolvedValue([]),
    deactivateStudent: vi.fn().mockResolvedValue(true),
    activateStudent: vi.fn().mockResolvedValue(true),
    updateStudent: studentServiceMock.updateStudent,
  }),
}));

vi.mock('@/stores/schoolStore', () => ({
  useSchoolStore: () => ({ currentSchoolId: 'school-1' }),
}));

vi.mock('@/stores/divisionStore', () => ({
  useDivisionStore: () => ({
    divisions: [{ id: 'sec-1', name: 'Primary', code: 'PRI', displayOrder: 1, status: 'ACTIVE' }],
    activeDivisions: [{ id: 'sec-1', name: 'Primary', code: 'PRI', displayOrder: 1, status: 'ACTIVE' }],
    loadDivisions: vi.fn().mockResolvedValue([]),
    initialize: vi.fn(),
  }),
}));

vi.mock('@/stores/academicStore', () => ({
  useAcademicStore: () => ({
    sessions: [
      { id: 'session-1', school_id: 'school-1', name: '2026/2027', is_current: true, status: 'ACTIVE' },
      { id: 'session-2', school_id: 'school-1', name: '2025/2026', is_current: false, status: 'COMPLETED' },
    ],
    levels: [],
    initialize: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock('@/offline/localDb', async () => {
  const { createFakeDb } = await import('./helpers/fakeDexie');
  const fake = createFakeDb(['students', 'school_divisions', 'academic_levels']);
  return {
    db: fake.db as any,
    LocalRepository: {},
  };
});

vi.mock('vue-router', () => ({
  useRouter: () => vi.fn(),
}));

import { useStudentManagement } from '@/features/students/composables/useStudentManagement';
import { normalizeStudent } from '@/features/students/utils/normalizeStudent';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Bug regression #1 — guardian fields reach the guardian service', () => {
  it('passes flat guardianName/Phone/Email from the form to getOrCreateGuardian', async () => {
    guardianCreateMock.mockResolvedValue({ id: 'g-1' });
    studentServiceMock.createStudent.mockResolvedValue({ data: { id: 'stu-1' }, error: null });

    const mgmt: any = useStudentManagement();
    await mgmt.submitStudent({
      firstName: 'Ada',
      lastName: 'Obi',
      guardianMode: 'new',
      guardianName: 'Mrs. Obi',
      guardianPhone: '08012345678',
      guardianSecondaryPhone: '08087654321',
      guardianEmail: 'obi@example.com',
      relationship: 'MOTHER',
    });

    expect(guardianCreateMock).toHaveBeenCalledWith(
      'school-1',
      expect.objectContaining({
        full_name: 'Mrs. Obi',
        primary_phone: '08012345678',
        secondary_phone: '08087654321',
        email: 'obi@example.com',
        relationship: 'MOTHER',
      }),
    );
  });

  it('links the existing guardian without calling create when guardianMode=existing', async () => {
    studentServiceMock.createStudent.mockResolvedValue({ data: { id: 'stu-1' }, error: null });

    const mgmt: any = useStudentManagement();
    await mgmt.submitStudent({
      firstName: 'Ada',
      lastName: 'Obi',
      guardianMode: 'existing',
      existingGuardianId: 'g-existing',
      guardianName: '',
      guardianPhone: '',
    });

    expect(guardianCreateMock).not.toHaveBeenCalled();
    expect(studentServiceMock.createStudent).toHaveBeenCalledWith(
      expect.objectContaining({ guardianId: 'g-existing' }),
    );
  });
});

describe('Bug regression #2 — edit path updates instead of creating', () => {
  it('calls updateStudent when editing an existing student', async () => {
    studentServiceMock.updateStudent.mockResolvedValue({ data: {}, error: null });

    const mgmt: any = useStudentManagement();
    mgmt.editStudent({
      id: 'stu-1',
      firstName: 'Ada',
      lastName: 'Obi',
      class: '',
      guardian: null,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await mgmt.submitStudent({
      firstName: 'Ada-Maria',
      lastName: 'Obi',
      guardianMode: 'existing',
      existingGuardianId: 'g-1',
    });

    expect(studentServiceMock.updateStudent).toHaveBeenCalledWith(
      'stu-1',
      expect.objectContaining({ firstName: 'Ada-Maria', lastName: 'Obi' }),
    );
    expect(studentServiceMock.createStudent).not.toHaveBeenCalled();
  });
});

describe('Bug regression #3 — class filter matches IDs to display names', () => {
  it('filters students whose resolved class name matches the selected division ID', async () => {
    // Two raw rows: one in Primary (sec-1), one without a class.
    const primary = normalizeStudent(
      {
        id: 'stu-in-primary',
        school_id: 'school-1',
        first_name: 'Ada',
        last_name: 'One',
        division_id: 'sec-1',
        class_name: 'Primary',
        status: 'ACTIVE',
        created_at: new Date().toISOString(),
      },
      [{ id: 'sec-1', name: 'Primary', code: 'PRI' } as any],
    );

    // Simulate the composable's internal list via filteredStudents logic:
    // load() is store-mocked to return [], so exercise the filter predicate
    // through a direct composable instance with injected data.
    const mgmt: any = useStudentManagement();
    mgmt.students.splice(0, mgmt.students.length, primary);
    mgmt.filters.class = 'sec-1'; // toolbar passes the division ID

    expect(mgmt.filteredStudents.map((s: any) => s.id)).toContain('stu-in-primary');
  });

  it('excludes students from other sections', async () => {
    const other = normalizeStudent(
      {
        id: 'stu-other',
        school_id: 'school-1',
        first_name: 'Bola',
        last_name: 'Two',
        division_id: 'sec-9',
        class_name: 'Secondary',
        status: 'ACTIVE',
        created_at: new Date().toISOString(),
      },
      [],
    );
    const mgmt: any = useStudentManagement();
    mgmt.students.splice(0, mgmt.students.length, other);
    mgmt.filters.class = 'sec-1';

    expect(mgmt.filteredStudents.map((s: any) => s.id)).not.toContain('stu-other');
  });
});
