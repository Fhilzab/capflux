/**
 * StudentListView interaction wiring regressions.
 *
 * The view consumes `useStudentManagement()`, which returns a
 * `reactive({...})` object (refs auto-unwrapped). Handlers must therefore
 * assign state directly (`management.searchQuery = q`), not through
 * `.value` — the latter throws `Cannot create property 'value' on ...`
 * at runtime and silently breaks search, sort, pagination and dialogs.
 *
 * These tests mount the real view + real composable (stores mocked at the
 * module boundary) and drive the actual DOM controls.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';

const hoisted = vi.hoisted(() => {
  const pushMock = vi.fn();
  const getStudentsWithGuardiansMock = vi.fn();
  const loadDivisionsMock = vi.fn(async () => undefined);
  const academicInitMock = vi.fn(async () => undefined);
  const getActiveEnrollmentMock = vi.fn(async () => null);
  const installSandboxModeMock = vi.fn(async () => ({ seeded: null }));
  const loadSchoolMock = vi.fn(async () => undefined);
  const schoolMock = {
    currentSchoolId: 'demo-school' as string | null,
    currentSchool: { name: 'Demo Academy' } as { name: string } | null,
    initialized: true,
    error: null as string | null,
    loadSchool: loadSchoolMock,
  };
  return {
    pushMock,
    getStudentsWithGuardiansMock,
    loadDivisionsMock,
    academicInitMock,
    getActiveEnrollmentMock,
    installSandboxModeMock,
    loadSchoolMock,
    schoolMock,
    studentMock: { getStudentsWithGuardians: getStudentsWithGuardiansMock },
    divisionMock: { loadDivisions: loadDivisionsMock, activeDivisions: [], divisions: [] as unknown[] },
    academicMock: { initialize: academicInitMock, sessions: [] as unknown[], levels: [] as unknown[] },
  };
});

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: hoisted.pushMock }),
  useRoute: () => ({ params: {}, query: {}, path: '/students' }),
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

import StudentListView from '../StudentListView.vue';

const RAW = [
  { id: 'stu-1', first_name: 'Ada', last_name: 'Obi', status: 'ACTIVE', gender: 'Female' },
  { id: 'stu-2', first_name: 'Emeka', last_name: 'Okafor', status: 'ACTIVE', gender: 'Male' },
];

const rowNames = (wrapper: ReturnType<typeof mount>) =>
  wrapper.findAll('[data-testid="student-name"]').map((e) => e.text());

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('StudentListView interaction wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.getStudentsWithGuardiansMock.mockResolvedValue(RAW);
  });

  async function mountReady() {
    const wrapper = mount(StudentListView);
    await vi.waitFor(async () => {
      await flushPromises();
      expect(rowNames(wrapper)).toHaveLength(2);
    });
    return wrapper;
  }

  it('renders seeded rows with count and filters', async () => {
    const wrapper = await mountReady();
    expect(wrapper.find('[data-testid="students-count"]').text()).toBe('2');
    expect(wrapper.find('[data-testid="student-filters"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="students-table-container"]').exists()).toBe(true);
  });

  it('search filters rows without throwing (debounced)', async () => {
    const wrapper = await mountReady();
    await wrapper.find('[data-testid="student-search-input"]').setValue('Ada');
    await sleep(450);
    await flushPromises();
    expect(rowNames(wrapper)).toEqual(['Ada Obi']);
    expect(wrapper.find('[data-testid="students-count"]').text()).toBe('2');
  });

  it('gender filter narrows rows and resets to page one', async () => {
    const wrapper = await mountReady();
    await wrapper.find('[data-testid="filter-gender"] select').setValue('Female');
    await flushPromises();
    expect(rowNames(wrapper)).toEqual(['Ada Obi']);
  });

  it('table sort event updates ordering without throwing', async () => {
    const wrapper = await mountReady();
    const table = wrapper.findComponent({ name: 'StudentTable' });
    expect(table.exists()).toBe(true);
    await table.vm.$emit('sort', 'name', 'desc');
    await flushPromises();
    expect(rowNames(wrapper)).toEqual(['Emeka Okafor', 'Ada Obi']);
  });

  it('select-all reveals bulk actions and selection count', async () => {
    const wrapper = await mountReady();
    await wrapper.find('[data-testid="select-all-students"]').setValue(true);
    await flushPromises();
    expect(wrapper.find('[data-testid="move-selected"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="archive-selected"]').exists()).toBe(true);
  });

  it('paginates across pages without throwing', async () => {
    const many = Array.from({ length: 21 }, (_, i) => ({
      id: `stu-${i + 1}`,
      first_name: `First${i + 1}`,
      last_name: `Last${i + 1}`,
      status: 'ACTIVE',
      gender: i % 2 === 0 ? 'Female' : 'Male',
    }));
    hoisted.getStudentsWithGuardiansMock.mockResolvedValue(many);
    const wrapper = mount(StudentListView);
    await vi.waitFor(async () => {
      await flushPromises();
      expect(wrapper.find('[data-testid="students-pagination"]').exists()).toBe(true);
    });
    expect(wrapper.find('[data-testid="students-pagination"]').text()).toMatch(/Page 1 of 2/);
    expect(rowNames(wrapper)).toHaveLength(20);
    await wrapper.find('button[aria-label="Next page"]').trigger('click');
    await flushPromises();
    expect(wrapper.find('[data-testid="students-pagination"]').text()).toMatch(/Page 2 of 2/);
    expect(rowNames(wrapper)).toHaveLength(1);
  });
});
