/**
 * SupabaseSchoolProvider.getCurrentSchool() response-mapping regressions.
 *
 * Uses the ACTUAL simulator response envelope observed at runtime on a cold
 * sandbox boot: `{"success":true,"data":{"school":{...}}}`. Before the fix,
 * a pre-seed empty row (`{"success":true,"data":{"school":{}}}`) was treated
 * as a valid school and mapped to an id-less object, leaving
 * `schoolStore.currentSchoolId` null forever with no error.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { httpGetMock } = vi.hoisted(() => ({
  httpGetMock: vi.fn(),
}));

vi.mock('../../services/api/client', () => ({
  apiClient: {
    http: { get: httpGetMock },
    baseUrl: 'http://sandbox.local/api',
  },
  default: {
    http: { get: httpGetMock },
    baseUrl: 'http://sandbox.local/api',
  },
}));

import { SupabaseSchoolProvider } from '../SupabaseSchoolProvider';

const FULL_ROW = {
  id: 'demo-school',
  name: 'CAPFLUX Demo Academy',
  slug: 'capflux-demo-academy',
  status: 'ACTIVE',
  payment_status: 'READY',
  organization_id: 'demo-org',
  address: '1 Unity Road, Ikeja',
  state: 'Lagos',
  lga: 'Ikeja',
  country: 'Nigeria',
  school_type: 'PRIVATE',
  created_at: '2025-08-01T08:00:00.000Z',
  updated_at: '2025-08-01T08:00:00.000Z',
};

describe('SupabaseSchoolProvider.getCurrentSchool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps a complete school row, preserving the id', async () => {
    httpGetMock.mockResolvedValue({ data: { success: true, data: { school: FULL_ROW } } });
    const provider = new SupabaseSchoolProvider();
    const result = await provider.getCurrentSchool();
    expect(result.error).toBeNull();
    expect(result.data?.id).toBe('demo-school');
    expect(result.data?.name).toBe('CAPFLUX Demo Academy');
    expect(result.data?.paymentStatus).toBe('READY');
  });

  it('treats a pre-seed empty school row as no school (not an id-less object)', async () => {
    // Exact runtime shape when /context/school is hit before seeding finishes.
    httpGetMock.mockResolvedValue({ data: { success: true, data: { school: {} } } });
    const provider = new SupabaseSchoolProvider();
    const result = await provider.getCurrentSchool();
    expect(result.data).toBeNull();
    expect(result.error).toBeNull();
  });

  it('returns null when the school key is absent', async () => {
    httpGetMock.mockResolvedValue({ data: { success: true, data: {} } });
    const provider = new SupabaseSchoolProvider();
    const result = await provider.getCurrentSchool();
    expect(result.data).toBeNull();
    expect(result.error).toBeNull();
  });

  it('returns null when the envelope data is null', async () => {
    httpGetMock.mockResolvedValue({ data: { success: true, data: null } });
    const provider = new SupabaseSchoolProvider();
    const result = await provider.getCurrentSchool();
    expect(result.data).toBeNull();
    expect(result.error).toBeNull();
  });

  it('surfaces transport failures as errors (production behavior unchanged)', async () => {
    httpGetMock.mockRejectedValue({ response: { status: 401 }, message: 'Unauthorized' });
    const provider = new SupabaseSchoolProvider();
    const result = await provider.getCurrentSchool();
    expect(result.data).toBeNull();
    expect(result.error).not.toBeNull();
  });
});
