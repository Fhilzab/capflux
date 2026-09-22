/**
 * NotificationsView tenant school-context regressions.
 *
 * Notification writes were tagged with a hardcoded 'demo-school' id. The
 * view must use the authenticated school id and refuse to write when
 * context is missing (the demo id still flows through unchanged in
 * Sandbox, where the school store itself resolves it).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';

const hoisted = vi.hoisted(() => {
  const loadNotificationsMock = vi.fn(async () => undefined);
  const loadStudentsMock = vi.fn(async () => undefined);
  const sendNotificationMock = vi.fn(async (n: Record<string, unknown>) => n);
  const schoolMock = {
    currentSchoolId: 'live-school-9' as string | null,
    error: null as string | null,
    initialized: true,
  };
  return {
    loadNotificationsMock,
    loadStudentsMock,
    sendNotificationMock,
    schoolMock,
    notificationMock: { loadNotifications: loadNotificationsMock, notifications: [] as unknown[] },
    studentMock: {
      loadStudents: loadStudentsMock,
      students: [] as Array<Record<string, string>>,
    },
  };
});

const { sendNotificationMock, schoolMock } = hoisted;

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: {}, path: '/notifications' }),
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/stores/notificationStore', () => ({
  useNotificationStore: () => hoisted.notificationMock,
}));

vi.mock('@/stores/studentStore', () => ({
  useStudentStore: () => hoisted.studentMock,
}));

vi.mock('@/stores/schoolStore', () => ({
  useSchoolStore: () => hoisted.schoolMock,
}));

vi.mock('@/shared/services/NotificationService', () => ({
  NotificationService: {
    sendNotification: hoisted.sendNotificationMock,
    generateTemplates: () => ({}),
  },
}));

import NotificationsView from '../NotificationsView.vue';

async function fillAndSubmit(wrapper: ReturnType<typeof mount>) {
  await wrapper.findAll('select')[0]!.setValue('s1');
  await wrapper.find('textarea').setValue('Fees due');
  const btn = wrapper.findAll('button').find((b) => b.text().includes('Save notification'));
  expect(btn?.exists()).toBe(true);
  await btn!.trigger('click');
  await flushPromises();
}

describe('NotificationsView tenant school context', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    schoolMock.currentSchoolId = 'live-school-9';
    schoolMock.error = null;
    hoisted.studentMock.students = [
      { id: 's1', firstName: 'Ada', lastName: 'Obi', guardian_phone: '08010000001', class_name: 'Primary 1' },
    ];
  });

  it('writes notifications with the authenticated school id', async () => {
    const wrapper = mount(NotificationsView);
    await flushPromises();
    await fillAndSubmit(wrapper);
    expect(sendNotificationMock).toHaveBeenCalledTimes(1);
    expect(sendNotificationMock.mock.calls[0]![0]).toMatchObject({
      school_id: 'live-school-9',
      student_id: 's1',
    });
  });

  it('blocks writes when school context is missing', async () => {
    schoolMock.currentSchoolId = null;
    const wrapper = mount(NotificationsView);
    await flushPromises();
    await fillAndSubmit(wrapper);
    expect(sendNotificationMock).not.toHaveBeenCalled();
    expect(wrapper.text()).toMatch(/School context is unavailable/);
  });

  it('passes the sandbox demo id through unchanged', async () => {
    schoolMock.currentSchoolId = 'demo-school';
    const wrapper = mount(NotificationsView);
    await flushPromises();
    await fillAndSubmit(wrapper);
    expect(sendNotificationMock).toHaveBeenCalledTimes(1);
    expect(sendNotificationMock.mock.calls[0]![0]).toMatchObject({
      school_id: 'demo-school',
    });
  });
});
