import { describe, it, expect } from 'vitest';
import router from '@/router';

describe('student IA route compatibility', () => {
  const routes = router.getRoutes();
  const byName = (name: string) => routes.find((r) => r.name === name);
  const byPath = (path: string) => routes.find((r) => r.path === path);

  it('serves Academic Structure canonically under Settings', () => {
    const academic = byName('AcademicStructure');
    expect(academic).toBeTruthy();
    expect(academic!.path).toBe('/settings/academic-structure');
  });

  it('preserves the legacy /students/academic-structure path as a redirect', () => {
    const legacy = byPath('/students/academic-structure');
    expect(legacy).toBeTruthy();
    expect(legacy!.redirect).toEqual({ name: 'AcademicStructure' });
  });

  it('keeps /students and /students/:id functional', () => {
    expect(byName('Students')?.path).toBe('/students');
    expect(byName('StudentDetail')?.path).toBe('/students/:id');
  });

  it('keeps Daily Collections and Outstanding Fees reachable under Reports', () => {
    expect(byName('DailyCollections')?.path).toBe('/reports/daily-collections');
    expect(byName('OutstandingFees')?.path).toBe('/reports/outstanding-fees');
    expect(byName('Reports')?.path).toBe('/reports');
  });

  it('resolves the canonical paths to the expected route names', async () => {
    expect(router.resolve('/settings/academic-structure').name).toBe('AcademicStructure');
    expect(router.resolve('/students').name).toBe('Students');
    expect(router.resolve('/students/stu-1').name).toBe('StudentDetail');
    expect(router.resolve('/reports/daily-collections').name).toBe('DailyCollections');
    expect(router.resolve('/reports/outstanding-fees').name).toBe('OutstandingFees');
    // Legacy path redirects to the canonical Settings location (redirect
    // routes carry no name until navigation applies the redirect).
    const legacy = router.resolve('/students/academic-structure');
    expect(legacy.matched[0]?.redirect).toEqual({ name: 'AcademicStructure' });
  });
});
