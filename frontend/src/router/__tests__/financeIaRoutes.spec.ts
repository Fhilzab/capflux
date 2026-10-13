import { describe, it, expect } from 'vitest';
import router from '@/router';

describe('finance IA route compatibility', () => {
  const routes = router.getRoutes();
  const byName = (name: string) => routes.find((r) => r.name === name);

  it('keeps the three canonical Finance destinations', () => {
    expect(byName('Billing')?.path).toBe('/billing');
    expect(byName('Payments')?.path).toBe('/payments');
    expect(byName('Reports')?.path).toBe('/reports');
  });

  it('preserves the Settlements compatibility route with payment guards', () => {
    const settlements = byName('Settlements');
    expect(settlements).toBeTruthy();
    expect(settlements!.path).toBe('/settlements');
    expect(settlements!.meta.requiresAuth).toBe(true);
  });

  it('preserves consolidated report routes under Reports', () => {
    expect(byName('DailyCollections')?.path).toBe('/reports/daily-collections');
    expect(byName('OutstandingFees')?.path).toBe('/reports/outstanding-fees');
    expect(byName('RevenueDashboard')?.path).toBe('/reports/revenue-dashboard');
  });

  it('resolves canonical and compatibility paths to the expected route names', () => {
    expect(router.resolve('/billing').name).toBe('Billing');
    expect(router.resolve('/payments').name).toBe('Payments');
    expect(router.resolve('/settlements').name).toBe('Settlements');
    expect(router.resolve('/reports').name).toBe('Reports');
    expect(router.resolve('/reports/daily-collections').name).toBe('DailyCollections');
    expect(router.resolve('/reports/outstanding-fees').name).toBe('OutstandingFees');
    expect(router.resolve('/reports/revenue-dashboard').name).toBe('RevenueDashboard');
  });

  it('declares reports.view on every sensitive report destination', () => {
    for (const name of ['Reports', 'DailyCollections', 'OutstandingFees', 'RevenueDashboard']) {
      expect(byName(name)?.meta.permission).toBe('reports.view');
      expect(byName(name)?.meta.requiresAuth).toBe(true);
    }
  });
});
