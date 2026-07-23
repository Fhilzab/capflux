import type { Organization, OrganizationMembership, OrganizationContext, OrganizationResult } from './types';

/**
 * Organization Provider Interface
 * Abstract contract for organization providers (Supabase, WorkOS, etc.)
 * Future-proof: includes methods for multi-school support
 */
export abstract class OrganizationProvider {
  /**
   * Initialize and get current organization context
   */
  abstract initialize(): Promise<OrganizationResult<OrganizationContext>>;

  /**
   * Get the current organization without refresh
   */
  abstract getCurrentOrganization(): Promise<OrganizationResult<Organization>>;

  /**
   * Get the current user's membership
   */
  abstract getMembership(): Promise<OrganizationResult<OrganizationMembership>>;

  /**
   * Refresh organization data
   */
  abstract refreshOrganization(): Promise<OrganizationResult<OrganizationContext>>;

  /**
   * Clear organization context
   */
  abstract clear(): Promise<void>;

  /**
   * Switch to a different organization (future multi-school support)
   * @param organizationId - Target organization ID
   */
  abstract switchOrganization?(organizationId: string): Promise<OrganizationResult<OrganizationContext>>;

  /**
   * List all organizations the user belongs to (future multi-school support)
   */
  abstract listOrganizations?(): Promise<OrganizationResult<Organization[]>>;

  /**
   * Check if provider is configured
   */
  abstract isConfigured(): boolean;
}