/**
 * DefaultOrganizationProvider
 * Supabase-backed implementation of OrganizationProvider
 * Only file that knows about Supabase for organization data
 * 
 * // TODO (Milestone 5):
 * // Replace DefaultOrganizationProvider with WorkOSOrganizationProvider
 * // when AuthKit Organizations are enabled.
 */

import { supabase, hasSupabaseConfig } from '../services/api/supabase';
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

/**
 * Transform raw profile data to Organization and Membership
 */
function transformProfile(profile: Record<string, unknown>): OrganizationContext | null {
  if (!profile) return null;
  
  const orgId = profile.school_id as string | undefined;
  const role = profile.role as string | undefined;
  
  if (!orgId) return null;
  
  const organization: Organization = {
    id: orgId,
    name: (profile.school_name as string) || 'Unknown School',
    domain: profile.school_domain as string | undefined,
    subscriptionStatus: profile.subscription_status as string | undefined,
    createdAt: profile.created_at as string | undefined,
    updatedAt: profile.updated_at as string | undefined,
  };
  
  const membership: OrganizationMembership = {
    organizationId: orgId,
    role: (role === 'OWNER' || role === 'ADMIN') ? role : 'ADMIN',
    status: (profile.admin_status as string) || 'ACTIVE',
    createdAt: profile.created_at as string | undefined,
  };
  
  return { organization, membership };
}

export class DefaultOrganizationProvider extends OrganizationProvider {
  private config: Record<string, unknown>;

  constructor() {
    super();
    this.config = {};
  }

  async initialize(): Promise<OrganizationResult<OrganizationContext>> {
    if (!hasSupabaseConfig) {
      // Local dev fallback: no organization context
      return { data: null, error: null };
    }

    return this.getContext();
  }

  async getContext(): Promise<OrganizationResult<OrganizationContext>> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { data: null, error: { code: 'UNAUTHORIZED', message: 'No authenticated user' } };
      }

      // Try RPC first
      const { data: profile, error } = await supabase.rpc('get_profile', { user_id: user.id });
      
      if (!error && profile) {
        const context = transformProfile(profile as Record<string, unknown>);
        if (context) {
          return { data: context, error: null };
        }
      }

      // Fallback to direct query
      const result = await supabase
        .from('profiles')
        .select('school_id, role, admin_status, school_name, school_domain, subscription_status')
        .eq('id', user.id)
        .single();

      if (result.data) {
        const context = transformProfile(result.data);
        if (context) {
          return { data: context, error: null };
        }
      }

      return { data: null, error: null };
    } catch (error) {
      return { data: null, error: mapError(error, 'Unable to fetch organization context') };
    }
  }

  async getCurrentOrganization(): Promise<OrganizationResult<Organization>> {
    if (!hasSupabaseConfig) {
      return { data: null, error: null };
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { data: null, error: { code: 'UNAUTHORIZED', message: 'No authenticated user' } };
      }

      // Try RPC first
      const { data: profile, error } = await supabase.rpc('get_profile', { user_id: user.id });
      
      if (!error && profile) {
        const context = transformProfile(profile as Record<string, unknown>);
        if (context) {
          return { data: context.organization, error: null };
        }
      }

      // Fallback to direct query
      const result = await supabase
        .from('profiles')
        .select('school_id, role, admin_status, school_name, school_domain, subscription_status')
        .eq('id', user.id)
        .single();

      if (result.data) {
        const context = transformProfile(result.data);
        if (context) {
          return { data: context.organization, error: null };
        }
      }

      return { data: null, error: null };
    } catch (error) {
      return { data: null, error: mapError(error, 'Unable to fetch organization') };
    }
  }

  async getMembership(): Promise<OrganizationResult<OrganizationMembership>> {
    if (!hasSupabaseConfig) {
      return { data: null, error: null };
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { data: null, error: { code: 'UNAUTHORIZED', message: 'No authenticated user' } };
      }

      // Try RPC first
      const { data: profile, error } = await supabase.rpc('get_profile', { user_id: user.id });
      
      if (!error && profile) {
        const context = transformProfile(profile as Record<string, unknown>);
        if (context) {
          return { data: context.membership, error: null };
        }
      }

      // Fallback to direct query
      const result = await supabase
        .from('profiles')
        .select('school_id, role, admin_status')
        .eq('id', user.id)
        .single();

      if (result.data) {
        const context = transformProfile(result.data);
        if (context) {
          return { data: context.membership, error: null };
        }
      }

      return { data: null, error: null };
    } catch (error) {
      return { data: null, error: mapError(error, 'Unable to fetch membership') };
    }
  }

  async refreshOrganization(): Promise<OrganizationResult<OrganizationContext>> {
    return this.getContext();
  }

  async clear(): Promise<void> {
    // No local state to clear - Supabase handles session
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
    return hasSupabaseConfig;
  }
}