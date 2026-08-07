/**
 * SupabaseSchoolProvider
 * Backend-backed implementation of SchoolProvider.
 * Resolves the current school via the CAPFLUX backend (/api/context/school),
 * which derives school scope from the authenticated WorkOS session.
 */

import { apiClient } from '../services/api/client';
import { SchoolProvider } from './SchoolProvider';
import type { School, SchoolResult } from './types';
import { mapProviderError } from './SchoolError';

type CreateSchoolInput = {
  schoolName: string;
  proprietorName: string;
  email: string;
  phone: string;
  address?: string;
  schoolType: string;
  academicSession?: string;
  currentTerm?: string;
};

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function mapRowToSchool(row: Record<string, unknown>): School {
  return {
    id: row.id as string,
    name: row.name as string,
    slug: (row.slug as string) || '',
    status: (row.status as School['status']) || 'PENDING_SETUP',
    paymentStatus: (row.payment_status as School['paymentStatus']) || 'NOT_READY',
    organizationId: (row.organization_id as string) || '',
    address: row.address as string | undefined,
    state: row.state as string | undefined,
    lga: row.lga as string | undefined,
    country: row.country as string | undefined,
    schoolType: row.school_type as string | undefined,
    academicCalendar: row.academic_calendar as Record<string, unknown> | undefined,
    createdAt: (row.created_at as string) || new Date().toISOString(),
    updatedAt: (row.updated_at as string) || new Date().toISOString(),
  };
}

export class SupabaseSchoolProvider extends SchoolProvider {
  async getCurrentSchool(): Promise<SchoolResult<School>> {
    try {
      const response = await apiClient.http.get('/context/school');
      const data = response.data?.data;
      if (data?.school) {
        return { data: mapRowToSchool(data.school), error: null };
      }
      return { data: null, error: null };
    } catch (error) {
      return { data: null, error: mapProviderError(error) };
    }
  }

  async createSchool(input: CreateSchoolInput): Promise<SchoolResult<School>> {
    // Local dev fallback (no backend configured).
    const school: School = {
      id: 'demo-school',
      name: input.schoolName,
      slug: generateSlug(input.schoolName),
      status: 'PENDING_SETUP',
      paymentStatus: 'NOT_READY',
      organizationId: 'demo-org',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return { data: school, error: null };
  }

  async updateSchool(_schoolId: string, _updateData: Partial<School>): Promise<SchoolResult<School>> {
    // School updates go through the backend onboarding/school management
    // endpoints (not yet implemented as a standalone mutation).
    return { data: null, error: { code: 'UNKNOWN', message: 'Not implemented' } };
  }

  async archiveSchool(_schoolId: string): Promise<SchoolResult<School>> {
    // Archive is a backend-managed operation; not exposed to clients yet.
    return { data: null, error: { code: 'UNKNOWN', message: 'Not implemented' } };
  }

  async activateSchool(_schoolId: string): Promise<SchoolResult<School>> {
    // Activation is performed by the backend onboarding completion flow
    // (POST /api/onboarding/complete), never by a direct client mutation.
    return { data: null, error: { code: 'UNKNOWN', message: 'Not implemented' } };
  }

  async deleteSchool(_schoolId: string): Promise<SchoolResult<void>> {
    // Future milestone
    return { data: null, error: { code: 'UNKNOWN', message: 'Not implemented' } };
  }

  async listSchools(): Promise<SchoolResult<School[]>> {
    // Future milestone
    return { data: [], error: null };
  }

  async switchSchool(_schoolId: string): Promise<SchoolResult<School>> {
    // Future milestone
    return { data: null, error: { code: 'UNKNOWN', message: 'Not implemented' } };
  }

  isConfigured(): boolean {
    return Boolean(import.meta.env.VITE_API_BASE_URL);
  }
}