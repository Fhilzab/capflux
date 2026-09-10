/**
 * WorkOSIdentityService
 * Centralized identity resolution service for WorkOS AuthKit.
 *
 * Resolves WorkOS user IDs (sub claim from JWT) to canonical CAPFLUX UUIDs
 * via the user_identity_links bridge table.
 *
 * This is the SINGLE authoritative service for WorkOS -> CAPFLUX identity mapping.
 * No route or handler should implement its own mapping logic.
 */
import { supabase } from '../supabaseClient.js';
import { errorMessage } from '../types/http.js';
import type { AuthUser } from '../types/http.js';

export interface IdentityResolutionResult {
  capfluxUserId: string | null;
  workosUserId: string;
  status: 'ACTIVE' | 'REVOKED' | 'NOT_FOUND' | 'ERROR';
  error?: string;
}

/**
 * WorkOSIdentityService - Handles WorkOS to CAPFLUX identity resolution.
 *
 * Key principles:
 * - WorkOS IDs (TEXT, format: user_...) are NEVER written to UUID columns
 * - Identity resolution ONLY through public.user_identity_links
 * - Email matching is NEVER used for identity resolution
 * - Only ACTIVE identity links resolve (fail-closed)
 * - REVOKED identities cannot resurrect
 */
export class WorkOSIdentityService {
  /**
   * Resolve a WorkOS user ID to a CAPFLUX canonical UUID.
   *
   * Resolution logic (strict hierarchy - NO email fallback):
   * 1. Validate WorkOS ID format
   * 2. Look up existing ACTIVE identity link in user_identity_links
   * 3. If found, return the capflux_user_id (canonical UUID)
   * 4. If not found, check for REVOKED link - if found, return REVOKED status
   * 5. If not found and not revoked, return NOT_FOUND status
   *
   * @param workosUserId - WorkOS user ID (e.g., "user_01EHWNC0FCBHZ3BJ7EGKYXK0E6")
   * @returns IdentityResolutionResult with capfluxUserId or null
   */
  async resolveCAPFLUXUserFromWorkOSIdentity(workosUserId: string): Promise<IdentityResolutionResult> {
    // Step 1: Validate WorkOS ID format
    if (!workosUserId || typeof workosUserId !== 'string') {
      return {
        capfluxUserId: null,
        workosUserId,
        status: 'ERROR',
        error: 'Invalid WorkOS user ID: empty or not a string',
      };
    }

    if (!workosUserId.match(/^user_[0-9A-Za-z]{10,}$/)) {
      return {
        capfluxUserId: null,
        workosUserId,
        status: 'ERROR',
        error: `Invalid WorkOS user ID format: ${workosUserId}`,
      };
    }

    // Step 2: Look up existing ACTIVE identity link
    const { data: activeLink, error: activeError } = await supabase
      .from('user_identity_links')
      .select('capflux_user_id')
      .eq('workos_user_id', workosUserId)
      .eq('identity_type', 'workos_authkit')
      .eq('status', 'ACTIVE')
      .maybeSingle();

    if (activeError) {
      return {
        capfluxUserId: null,
        workosUserId,
        status: 'ERROR',
        error: `Failed to query identity link: ${errorMessage(activeError)}`,
      };
    }

    if (activeLink) {
      return {
        capfluxUserId: activeLink.capflux_user_id,
        workosUserId,
        status: 'ACTIVE',
      };
    }

    // Step 3: Check for REVOKED link
    const { data: revokedLink, error: revokedError } = await supabase
      .from('user_identity_links')
      .select('capflux_user_id')
      .eq('workos_user_id', workosUserId)
      .eq('identity_type', 'workos_authkit')
      .eq('status', 'REVOKED')
      .maybeSingle();

    if (revokedError) {
      return {
        capfluxUserId: null,
        workosUserId,
        status: 'ERROR',
        error: `Failed to query revoked identity link: ${errorMessage(revokedError)}`,
      };
    }

    if (revokedLink) {
      return {
        capfluxUserId: revokedLink.capflux_user_id,
        workosUserId,
        status: 'REVOKED',
      };
    }

    // Step 4: No identity link found
    return {
      capfluxUserId: null,
      workosUserId,
      status: 'NOT_FOUND',
    };
  }

  /**
   * Get the full CAPFLUX user record for a WorkOS user ID.
   * Combines identity resolution with user lookup.
   */
  async getCAPFLUXUser(workosUserId: string): Promise<{ user: AuthUser | null; error?: string }> {
    const resolution = await this.resolveCAPFLUXUserFromWorkOSIdentity(workosUserId);

    if (resolution.status !== 'ACTIVE' || !resolution.capfluxUserId) {
      return { user: null, error: resolution.error || `Identity status: ${resolution.status}` };
    }

    const { data: appUser, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', resolution.capfluxUserId)
      .single();

    if (error || !appUser) {
      return { user: null, error: 'CAPFLUX user not found' };
    }

    return { user: appUser as unknown as AuthUser };
  }

  /**
   * Validate that a WorkOS user ID format is correct.
   * Purely syntactic check - no database access.
   */
  static isValidWorkOSUserId(workosUserId: string): boolean {
    return typeof workosUserId === 'string' && workosUserId.match(/^user_[0-9A-Za-z]{10,}$/) !== null;
  }
}

// Singleton instance
export const workOSIdentityService = new WorkOSIdentityService();
export default WorkOSIdentityService;