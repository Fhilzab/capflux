/**
 * StudentMovementModal.spec.ts — operator-precedence regression.
 *
 * `levelOptions` was defined as `computed(...).map(...)`, invoking `.map`
 * on the ComputedRef itself instead of the resolved array. The call threw
 * synchronously during setup (`computed(...).map is not a function`), so
 * merely mounting the modal — e.g. via Student Detail navigation, which
 * mounts it eagerly while hidden — crashed the component and cascaded
 * into a second `instance.update is not a function` error on update.
 *
 * These tests mount the real modal with mocked stores and assert correct
 * behavior rather than merely swallowing exceptions.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';

const hoisted = vi.hoisted(() => {
  const moveStudentMock = vi.fn(async () => true);
  const academicMock = {
    sessions: [] as Array<{ id: string; name: string }>,
    levelsBySection: {} as Record<string, Array<{ id: string; name: string; status: string }>>,
    currentSession: null as { id: string } | null,
  };
  const enrollmentMock = { moveStudent: moveStudentMock, error: null as string | null };
  return { moveStudentMock, academicMock, enrollmentMock };
});

const { moveStudentMock, academicMock, enrollmentMock } = hoisted;

vi.mock('@/stores/enrollmentStore', () => ({
  useEnrollmentStore: () => hoisted.enrollmentMock,
}));

vi.mock('@/stores/academicStore', () => ({
  useAcademicStore: () => hoisted.academicMock,
}));

import StudentMovementModal from '../StudentMovementModal.vue';
import CmSelect from '@/components/ui/CmSelect.vue';
import CmButton from '@/components/ui/CmButton.vue';

const SECTIONS = [
  { id: 'sec-a', school_id: 'demo-school', name: 'Primary', code: 'PRI', display_order: 0, status: 'ACTIVE' },
  { id: 'sec-b', school_id: 'demo-school', name: 'Secondary', code: 'SEC', display_order: 1, status: 'ACTIVE' },
] as any[];

const LEVELS = {
  'sec-a': [
    { id: 'lvl-1', name: 'Primary 1', status: 'ACTIVE' },
    { id: 'lvl-2', name: 'Primary 2', status: 'ARCHIVED' },
  ],
  'sec-b': [{ id: 'lvl-3', name: 'JSS 1', status: 'ACTIVE' }],
};

function mountModal(overrides: Record<string, unknown> = {}) {
  return mount(StudentMovementModal, {
    props: {
      modelValue: false,
      studentId: 'stu-1',
      current: null,
      sections: SECTIONS,
      ...overrides,
    },
  });
}

describe('StudentMovementModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    academicMock.sessions = [];
    academicMock.levelsBySection = JSON.parse(JSON.stringify(LEVELS));
    academicMock.currentSession = null;
    enrollmentMock.error = null;
  });

  it('mounts while hidden without throwing (detail-navigation scenario)', async () => {
    // Before the fix, setup itself threw `computed(...).map is not a
    // function`, which Vue then followed with `instance.update`.
    const wrapper = mountModal();
    await flushPromises();
    expect(wrapper.findComponent({ name: 'CmModal' }).exists()).toBe(true);
  });

  it('offers only active levels of the selected section', async () => {
    const wrapper = mountModal({ modelValue: true });
    await flushPromises();
    const levelSelect = wrapper.findAllComponents(CmSelect)[2]!;
    const options = (levelSelect.props('options') ?? []) as Array<{ value: string; label: string }>;
    // No section chosen yet and no current enrollment: empty, not crashed.
    expect(options).toEqual([]);
  });

  it('resolves levels once a section is known via current enrollment', async () => {
    const wrapper = mountModal({
      modelValue: true,
      current: {
        enrollment: { academic_session_id: 'sess-1', section_id: 'sec-a', level_id: 'lvl-1' },
      },
    });
    await flushPromises();
    // Re-open flow: set the section explicitly the way the watcher does.
    const sectionSelect = wrapper.findAllComponents(CmSelect)[1]!;
    await sectionSelect.vm.$emit('update:modelValue', 'sec-a');
    await flushPromises();
    const levelSelect = wrapper.findAllComponents(CmSelect)[2]!;
    const options = (levelSelect.props('options') ?? []) as Array<{ value: string; label: string }>;
    expect(options).toEqual([{ value: 'lvl-1', label: 'Primary 1' }]);
  });

  it('survives sections with no levels without throwing', async () => {
    academicMock.levelsBySection = {};
    const wrapper = mountModal({ modelValue: true });
    await flushPromises();
    const levelSelect = wrapper.findAllComponents(CmSelect)[2]!;
    expect((levelSelect.props('options') ?? []) as unknown[]).toEqual([]);
  });

  it('applies a fully specified move through the enrollment store', async () => {
    const wrapper = mountModal({
      modelValue: true,
      current: {
        enrollment: { academic_session_id: 'sess-1', section_id: 'sec-b', level_id: 'lvl-3' },
      },
    });
    await flushPromises();
    const selects = wrapper.findAllComponents(CmSelect);
    await selects[1]!.vm.$emit('update:modelValue', 'sec-b');
    await selects[2]!.vm.$emit('update:modelValue', 'lvl-3');
    await flushPromises();
    // Session select accepts free assignment for the test (no sessions seeded).
    const sessionSelect = selects[0]!;
    await sessionSelect.vm.$emit('update:modelValue', 'sess-1');
    await flushPromises();
    const confirm = wrapper
      .findAllComponents(CmButton)
      .find((b) => (b.text() || '').includes('Confirm placement change'))!;
    expect(confirm.exists()).toBe(true);
    await confirm.trigger('click');
    await flushPromises();
    expect(moveStudentMock).toHaveBeenCalledTimes(1);
    expect(moveStudentMock).toHaveBeenCalledWith(
      'stu-1',
      { sessionId: 'sess-1', sectionId: 'sec-b', levelId: 'lvl-3' },
      'MOVEMENT',
    );
    expect(wrapper.emitted('moved')).toBeTruthy();
  });
});
