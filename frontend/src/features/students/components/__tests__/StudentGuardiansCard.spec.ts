/**
 * StudentGuardiansCard.spec.ts — Student Detail guardians tab flows.
 * vi.hoisted + fake Dexie; store mocked at the module boundary.
 */
import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';

const fakeReady = vi.hoisted(async () => {
  const { createFakeDb } = await import('../../services/__tests__/helpers/fakeDexie');
  return createFakeDb(['students', 'guardians', 'student_guardians', 'sync_queue']);
});

vi.mock('@/offline/localDb', async () => {
  const fake = await fakeReady;
  const d = fake.db as any;
  const repo = {
    saveGuardian: async (row: any) => d.guardians.put(row),
    saveStudentGuardian: async (row: any) => d.student_guardians.put(row),
    deleteStudentGuardian: (id: string) => d.student_guardians.delete(id),
    getGuardianLinksForStudent: (studentId: string) =>
      d.student_guardians.where('student_id').equals(studentId).toArray(),
    getStudentsForGuardian: (guardianId: string) =>
      d.student_guardians.where('guardian_id').equals(guardianId).toArray(),
    findGuardianByPhone: async (schoolId: string, phone: string) =>
      (await d.guardians.where('school_id').equals(schoolId).toArray())
        .find((g: any) => g.primary_phone === phone),
    getGuardiansBySchool: (schoolId: string) => d.guardians.where('school_id').equals(schoolId).toArray(),
    enqueueSyncItem: async (item: any) => d.sync_queue.put({ id: crypto.randomUUID(), ...item }),
  };
  return {
    default: d,
    db: d,
    LocalRepository: repo,
  };
});

const schoolStoreMock = vi.hoisted(() => ({
  currentSchoolId: 'school-1' as string | null,
}));

vi.mock('@/stores/schoolStore', () => ({
  useSchoolStore: () => schoolStoreMock,
}));

// Router is used for GuardianDetail navigation.
const pushMock = vi.fn();
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: pushMock }),
}));

import StudentGuardiansCard from '../StudentGuardiansCard.vue';

let fake: Awaited<typeof fakeReady>;

beforeAll(async () => {
  fake = await fakeReady;
});

const SCHOOL = 'school-1';

beforeEach(async () => {
  setActivePinia(createPinia());
  fake.reset();
  schoolStoreMock.currentSchoolId = SCHOOL;
  pushMock.mockClear();
  (fake.db.students as any).seed([
    { id: 'stu-1', school_id: SCHOOL, first_name: 'Ada', last_name: 'Obi', guardian_id: null },
    { id: 'stu-2', school_id: SCHOOL, first_name: 'Emeka', last_name: 'Obi', guardian_id: null },
  ]);
  (fake.db.guardians as any).seed([
    { id: 'g-1', school_id: SCHOOL, full_name: 'Mrs. Obi', primary_phone: '08011111111' },
    { id: 'g-2', school_id: SCHOOL, full_name: 'Mr. Tunde', primary_phone: '08022222222' },
  ]);
});

async function mountCard() {
  const wrapper = mount(StudentGuardiansCard, {
    props: { studentId: 'stu-1' },
    global: { plugins: [createPinia()] },
  });
  await flushPromises();
  return wrapper;
}

describe('StudentGuardiansCard', () => {
  it('shows the empty state when the student has no guardians', async () => {
    const wrapper = await mountCard();
    expect(wrapper.text()).toContain('No guardians linked yet');
  });

  it('renders the primary guardian prominently after linking', async () => {
    (fake.db.student_guardians as any).seed([
      {
        id: 'link-1', school_id: SCHOOL, student_id: 'stu-1', guardian_id: 'g-1',
        relationship: 'MOTHER', is_primary: true,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      },
    ]);
    const wrapper = await mountCard();
    expect(wrapper.text()).toContain('Primary');
    expect(wrapper.text()).toContain('Mrs. Obi');
    expect(wrapper.text()).toContain('Mother');
  });

  it('links an existing guardian through the store action', async () => {
    const wrapper = await mountCard();
    // @ts-expect-error access component internals via vm
    await (wrapper.vm as any).linkCandidate('g-2');
    await flushPromises();

    const links = await (fake.db.student_guardians as any)
      .where('student_id').equals('stu-1').toArray();
    expect(links.some((l: any) => l.guardian_id === 'g-2')).toBe(true);
  });

  it('change-primary flow updates the mirror pointer', async () => {
    (fake.db.student_guardians as any).seed([
      {
        id: 'link-1', school_id: SCHOOL, student_id: 'stu-1', guardian_id: 'g-1',
        relationship: 'MOTHER', is_primary: true,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      },
      {
        id: 'link-2', school_id: SCHOOL, student_id: 'stu-1', guardian_id: 'g-2',
        relationship: 'FATHER', is_primary: false,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      },
    ]);
    const wrapper = await mountCard();
    // @ts-expect-error component internals
    const vm = wrapper.vm as any;
    vm.confirmPrimary = { link: { id: 'link-2' }, guardian: null };
    await flushPromises();
    await vm.makePrimary();
    await flushPromises();

    const links = await (fake.db.student_guardians as any)
      .where('student_id').equals('stu-1').toArray();
    expect(links.filter((l: any) => l.is_primary)).toHaveLength(1);
    expect(links.find((l: any) => l.is_primary)?.guardian_id).toBe('g-2');

    const student = await (fake.db.students as any).get('stu-1');
    expect(student.guardian_id).toBe('g-2');
  });

  it('remove flow deletes only the link, never the guardian record', async () => {
    (fake.db.student_guardians as any).seed([
      {
        id: 'link-1', school_id: SCHOOL, student_id: 'stu-1', guardian_id: 'g-1',
        relationship: 'MOTHER', is_primary: true,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      },
      {
        id: 'link-2', school_id: SCHOOL, student_id: 'stu-1', guardian_id: 'g-2',
        relationship: 'FATHER', is_primary: false,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      },
    ]);
    const wrapper = await mountCard();
    // @ts-expect-error component internals
    const vm = wrapper.vm as any;
    vm.confirmRemove = { link: { id: 'link-2' }, guardian: null };
    await flushPromises();
    await vm.removeRelationship();
    await flushPromises();

    const links = await (fake.db.student_guardians as any)
      .where('student_id').equals('stu-1').toArray();
    expect(links).toHaveLength(1);

    // The guardian record survives.
    const guardians = await (fake.db.guardians as any).snapshot();
    expect(guardians.some((g: any) => g.id === 'g-2')).toBe(true);
  });

  it('navigates to GuardianDetail on guardian click', async () => {
    (fake.db.student_guardians as any).seed([
      {
        id: 'link-1', school_id: SCHOOL, student_id: 'stu-1', guardian_id: 'g-1',
        relationship: 'MOTHER', is_primary: true,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      },
    ]);
    const wrapper = await mountCard();
    await wrapper.find('button.text-left').trigger('click');
    expect(pushMock).toHaveBeenCalledWith({ name: 'GuardianDetail', params: { id: 'g-1' } });
  });
});
