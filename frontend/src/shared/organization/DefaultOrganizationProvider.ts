/**
 * DefaultOrganizationProvider
 * Backend-backed implementation of OrganizationProvider.
 * Resolves organization context via the CAPFLUX backend (/api/context/org),
 * which derives membership from the authenticated WorkOS session.
 */

import { apiClient } from '../services/api/client';
import { OrganizationProvider } from './OrganizationProvider';
import type { Organization, OrganizationMembership, OrganizationContext, OrganizationResult, OrganizationError } from './types';

/**
 * Map unknown error to OrganizationError
 */
function mapError(error: unknown, fallbackMessage: string): OrganizationError {
  return {
    code: 'UNKNOWN',
    message: fallbackMessage,
    raw: error,
  };
}

export class DefaultOrganizationProvider extends OrganizationProvider {
  private config: Record<string, unknown>;

  constructor() {
    super();
    this.config = {};
  }

  async initialize(): Promise<OrganizationResult<OrganizationContext>> {
    return this.getContext();
  }

  async getContext(): Promise<OrganizationResult<OrganizationContext>> {
    try {
      const response = await apiClient.http.get('/context/org');
      const data = response.data?.data;
      if (data?.organization) {
        const organization: Organization = {
          id: data.organization.id,
          name: data.organization.name,
          domain: data.organization.slug || undefined,
          createdAt: data.organization.created_at,
          updatedAt: data.organization.updated_at,
        };
        const membership: OrganizationMembership = {
          organizationId: data.membership?.organizationId || organization.id,
          role: (data.membership?.role?.system_role as 'OWNER' | 'ADMIN') || 'ADMIN',
          status: 'ACTIVE',
          createdAt: data.membership?.joinedAt,
        };
        return { data: { organization, membership }, error: null };
      }
      return { data: null, error: null };
    } catch (error) {
      return { data: null, error: mapError(error, 'Unable to fetch organization context') };
    }
  }

  async getCurrentOrganization(): Promise<OrganizationResult<Organization>> {
    try {
      const context = await this.getContext();
      return { data: context.data?.organization ?? null, error: context.error };
    } catch (error) {
      return { data: null, error: mapError(error, 'Unable to fetch organization') };
    }
  }

  async getMembership(): Promise<OrganizationResult<OrganizationMembership>> {
    try {
      const context = await this.getContext();
      return { data: context.data?.membership ?? null, error: context.error };
    } catch (error) {
      return { data: null, error: mapError(error, 'Unable to fetch membership') };
    }
  }

  async refreshOrganization(): Promise<OrganizationResult<OrganizationContext>> {
    return this.getContext();
  }

  async clear(): Promise<void> {
    // No local state to clear — the backend session cookie is authoritative.
  }

  async switchOrganization(_organizationId: string): Promise<OrganizationResult<OrganizationContext>> {
    // TODO: Implement when multi-school support is added
    return { data: null, error: { code: 'ORG_NOT_FOUND', message: 'Multi-school switching not yet implemented' } };
  }

  async listOrganizations(): Promise<OrganizationResult<Organization[]>> {
    // TODO: Implement when multi-school support is added
    return { data: [], error: null };
  }

  isConfigured(): boolean {
    return Boolean(import.meta.env.VITE_API_BASE_URL);
  }
}