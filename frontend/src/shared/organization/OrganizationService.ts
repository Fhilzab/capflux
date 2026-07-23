/**
 * OrganizationService
 * Business service for organization context
 * Consumes OrganizationProvider with lightweight caching
 */

import { DefaultOrganizationProvider } from './DefaultOrganizationProvider';
import type { Organization, OrganizationMembership, OrganizationContext, OrganizationResult } from './types';

// Cache expiry in milliseconds (30 seconds)
const CACHE_EXPIRY_MS = 30000;

export class OrganizationService {
  private provider: DefaultOrganizationProvider;
  private cache: {
    context: OrganizationContext | null;
    timestamp: number;
  };

  constructor() {
    this.provider = new DefaultOrganizationProvider();
    this.cache = {
      context: null,
      timestamp: 0,
    };
  }

  /**
   * Check if cache is valid (exists and not expired)
   */
  private isCacheValid(): boolean {
    return this.cache.context !== null && 
           (Date.now() - this.cache.timestamp) < CACHE_EXPIRY_MS;
  }

  /**
   * Load organization context - uses cache if available
   */
  async loadOrganization(): Promise<OrganizationResult<OrganizationContext>> {
    if (this.isCacheValid()) {
      console.debug('[ORG] Loading organization from cache');
      return { data: this.cache.context, error: null };
    }

    console.debug('[ORG] Loading organization...');
    const result = await this.provider.initialize();
    
    if (result.data) {
      this.cache = {
        context: result.data,
        timestamp: Date.now(),
      };
      console.debug('[ORG] Organization loaded');
    } else if (result.error) {
      console.debug('[ORG] Organization unavailable:', result.error.message);
    }

    return result;
  }

  /**
   * Refresh organization context (bypass cache)
   */
  async refreshOrganization(): Promise<OrganizationResult<OrganizationContext>> {
    console.debug('[ORG] Refreshing organization...');
    this.cache = { context: null, timestamp: 0 };
    const result = await this.provider.refreshOrganization();
    
    if (result.data) {
      this.cache = {
        context: result.data,
        timestamp: Date.now(),
      };
      console.debug('[ORG] Organization refreshed');
    }

    return result;
  }

  /**
   * Get current organization (from cache or provider)
   */
  async getOrganization(): Promise<OrganizationResult<Organization>> {
    if (this.isCacheValid() && this.cache.context) {
      return { data: this.cache.context.organization, error: null };
    }

    const result = await this.loadOrganization();
    return {
      data: result.data?.organization ?? null,
      error: result.error,
    };
  }

  /**
   * Get current membership (from cache or provider)
   */
  async getMembership(): Promise<OrganizationResult<OrganizationMembership>> {
    if (this.isCacheValid() && this.cache.context) {
      return { data: this.cache.context.membership, error: null };
    }

    const result = await this.loadOrganization();
    return {
      data: result.data?.membership ?? null,
      error: result.error,
    };
  }

  /**
   * Clear organization context (used on signout)
   */
  async clearOrganization(): Promise<void> {
    await this.provider.clear();
    this.cache = { context: null, timestamp: 0 };
    console.debug('[ORG] Organization cleared');
  }

  /**
   * Check if organization context is available
   */
  hasOrganization(): boolean {
    return this.cache.context?.organization !== null;
  }
}

// Export singleton instance
export const organizationService = new OrganizationService();