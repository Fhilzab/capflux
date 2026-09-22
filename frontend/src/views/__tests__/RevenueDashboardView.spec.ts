/**
 * RevenueDashboardView tenant school-context regressions.
 *
 * The statement filter carried a hardcoded 'demo-school' schoolId, so the
 * dashboard queried the wrong tenant scope on Live. The view must filter
 * by the authenticated school id and surface a retryable error when
 * context is missing.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';

const hoisted = vi.hoisted(() => {
  const loadStudentStatementMock = vi.fn(async () => undefined);
  const schoolMock = {
    currentSchoolId: 'live-school-9' as string | null,
    error: null as string | null,
    initialized: true,
  };
  return {
    loadStudentStatementMock,
    schoolMock,
    reportingMock: {
      loadStudentStatement: loadStudentStatementMock,
      studentStatements: {} as Record<string, unknown>,
    },
  };
});

const { loadStudentStatementMock, schoolMock } = hoisted;

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: {}, path: '/reports/revenue-dashboard' }),
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/stores/reportingStore', () => ({
  useReportingStore: () => hoisted.reportingMock,
}));

vi.mock('@/stores/schoolStore', () => ({
  useSchoolStore: () => hoisted.schoolMock,
}));

vi.mock('../../composables/useModuleLock', () => ({
  useModuleLock: () => ({ showLock: false, lockReason: null, canAccessFinancials: true }),
}));

import RevenueDashboardView from '../RevenueDashboardView.vue';

describe('RevenueDashboardView tenant school context', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    schoolMock.currentSchoolId = 'live-school-9';
    schoolMock.error = null;
    hoisted.reportingMock.studentStatements = {};
  });

  it('filters the statement by the authenticated school id', async () => {
    mount(RevenueDashboardView);
    await vi.waitFor(async () => {
      await flushPromises();
      expect(loadStudentStatementMock).toHaveBeenCalled();
    });
    const [, filter] = loadStudentStatementMock.mock.calls[0] as unknown as [string, Record<string, string>];
    expect(filter.schoolId).toBe('live-school-9');
    expect(filter.organizationId).toBe('live-school-9');
    expect(Object.values(filter)).not.toContain('demo-school');
  });

  it('shows a retryable error and skips the store when context is missing', async () => {
    schoolMock.currentSchoolId = null;
    const wrapper = mount(RevenueDashboardView);
    await flushPromises();
    expect(loadStudentStatementMock).not.toHaveBeenCalled();
    expect(wrapper.text()).toMatch(/School context is unavailable/);
  });

  it('passes the sandbox demo id through unchanged', async () => {
    schoolMock.currentSchoolId = 'demo-school';
    mount(RevenueDashboardView);
    await vi.waitFor(async () => {
      await flushPromises();
      expect(loadStudentStatementMock).toHaveBeenCalled();
    });
    const [, filter] = loadStudentStatementMock.mock.calls[0] as unknown as [string, Record<string, string>];
    expect(filter.schoolId).toBe('demo-school');
  });
});
