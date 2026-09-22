/**
 * useStudentManagement school-context lifecycle regressions.
 *
 * Covers the sandbox cold-boot blocker: the route guard can resolve school
 * context before the sandbox seed completes, leaving a null school id and a
 * silently stuck empty state. `load()` must ensure seed + school context
 * once (bounded, no retries, no watchers) instead of returning early.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { __resolveRuntimeEnvironmentForTests } from '@/shared/environment/runtimeEnvironment';

const hoisted = vi.hoisted(() => {
  const routerPushMock = vi.fn();
  const getStudentsWithGuardiansMock = vi.fn();
  const loadDivisionsMock = vi.fn(async () => undefined);
  const academicInitMock = vi.fn(async () => undefined);
  const getActiveEnrollmentMock = vi.fn(async () => null);
  const installSandboxModeMock = vi.fn(async () => ({ seeded: null }));
  const loadSchoolMock = vi.fn();
  const schoolMock = {
    currentSchoolId: null as string | null,
    currentSchool: null as { name: string } | null,
    initialized: false,
    error: null as string | null,
    loadSchool: loadSchoolMock,
  };
  const studentMock = { getStudentsWithGuardians: getStudentsWithGuardiansMock };
  const divisionMock = { loadDivisions: loadDivisionsMock, activeDivisions: [] as unknown[] };
  const academicMock = { initialize: academicInitMock };
  return {
    routerPushMock,
    getStudentsWithGuardiansMock,
    loadDivisionsMock,
    academicInitMock,
    getActiveEnrollmentMock,
    installSandboxModeMock,
    loadSchoolMock,
    schoolMock,
    studentMock,
    divisionMock,
    academicMock,
  };
});

const {
  routerPushMock,
  getStudentsWithGuardiansMock,
  installSandboxModeMock,
  loadSchoolMock,
  schoolMock,
} = hoisted;

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: hoisted.routerPushMock }),
}));

vi.mock('@/stores/studentStore', () => ({
  useStudentStore: () => hoisted.studentMock,
}));

vi.mock('@/stores/schoolStore', () => ({
  useSchoolStore: () => hoisted.schoolMock,
}));

vi.mock('@/stores/divisionStore', () => ({
  useDivisionStore: () => hoisted.divisionMock,
}));

vi.mock('@/stores/academicStore', () => ({
  useAcademicStore: () => hoisted.academicMock,
}));

vi.mock('@/shared/enrollment/EnrollmentService', () => ({
  EnrollmentService: { getActiveEnrollment: hoisted.getActiveEnrollmentMock },
}));

vi.mock('@/sandbox', () => ({
  installSandboxMode: hoisted.installSandboxModeMock,
}));

import { useStudentManagement } from '../useStudentManagement';

void routerPushMock;

const RAW_STUDENT = {
  id: 'stu-1',
  first_name: 'Ada',
  last_name: 'Obi',
  status: 'ACTIVE',
  gender: 'Female',
};

describe('useStudentManagement school-context lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    schoolMock.currentSchoolId = null;
    schoolMock.currentSchool = null;
    schoolMock.initialized = false;
    schoolMock.error = null;
    loadSchoolMock.mockImplementation(async () => {
      schoolMock.currentSchoolId = 'demo-school';
      schoolMock.initialized = true;
    });
    getStudentsWithGuardiansMock.mockResolvedValue([RAW_STUDENT]);
    __resolveRuntimeEnvironmentForTests('production');
  });

  afterEach(() => {
    __resolveRuntimeEnvironmentForTests('production');
  });

  it('loads students directly when school context is already available (no extra school fetch)', async () => {
    schoolMock.currentSchoolId = 'demo-school';
    schoolMock.initialized = true;
    const management = useStudentManagement();
    await management.load();
    expect(loadSchoolMock).not.toHaveBeenCalled();
    expect(getStudentsWithGuardiansMock).toHaveBeenCalledTimes(1);
    expect(getStudentsWithGuardiansMock).toHaveBeenCalledWith('demo-school', true);
    expect(management.students).toHaveLength(1);
    expect(management.loading).toBe(false);
    expect(management.error).toBeNull();
  });

  it('resolves missing school context with a single bounded school fetch, then loads', async () => {
    const management = useStudentManagement();
    await management.load();
    expect(loadSchoolMock).toHaveBeenCalledTimes(1);
    expect(getStudentsWithGuardiansMock).toHaveBeenCalledTimes(1);
    expect(getStudentsWithGuardiansMock).toHaveBeenCalledWith('demo-school', true);
    expect(management.students).toHaveLength(1);
    expect(management.error).toBeNull();
  });

  it('ensures the sandbox seed before resolving school in sandbox mode', async () => {
    __resolveRuntimeEnvironmentForTests('sandbox');
    const management = useStudentManagement();
    await management.load();
    expect(installSandboxModeMock).toHaveBeenCalledTimes(1);
    expect(loadSchoolMock).toHaveBeenCalledTimes(1);
    expect(management.students).toHaveLength(1);
  });

  it('does not touch the sandbox installer in production mode', async () => {
    const management = useStudentManagement();
    await management.load();
    expect(installSandboxModeMock).not.toHaveBeenCalled();
    expect(management.students).toHaveLength(1);
  });

  it('keeps a genuine empty school distinguishable: no students, no error', async () => {
    loadSchoolMock.mockImplementation(async () => {
      schoolMock.initialized = true;
      // school genuinely absent: id stays null, no error
    });
    const management = useStudentManagement();
    await management.load();
    expect(management.students).toHaveLength(0);
    expect(management.error).toBeNull();
    expect(management.loading).toBe(false);
  });

  it('surfaces school-resolution failures as a loading error', async () => {
    loadSchoolMock.mockImplementation(async () => {
      schoolMock.initialized = true;
      schoolMock.error = 'school unreachable';
    });
    const management = useStudentManagement();
    await management.load();
    expect(management.students).toHaveLength(0);
    expect(management.error).toBe('school unreachable');
    expect(getStudentsWithGuardiansMock).not.toHaveBeenCalled();
  });
});
