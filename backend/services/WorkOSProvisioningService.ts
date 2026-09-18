/**
 * WorkOSProvisioningService
 *
 * Single reusable provisioning function for WorkOS → CAPFLUX identity bridge.
 * Called from: password signup, Google OAuth callback, password signin JIT recovery,
 * and webhook user.created recovery.
 *
 * Contract: provisionWorkOSIdentity(workosUser) -> CAPFLUX UUID
 *
 * Invariants:
 * - Generates a canonical CAPFLUX UUID (crypto.randomUUID) for new users
 * - Creates/updates public.users, public.user_profiles, public.user_identity_links
 * - Never casts WorkOS "user_..." IDs to UUID
 * - Never uses email as authoritative identity resolution
 * - Idempotent: preserves existing identity links
 * - Fails safely: throws on unrecoverable errors
 *
 * Identity state machine:
 * - Password signup (email not verified): status=PENDING, verified_at=NULL
 * - After email verification: status=ACTIVE, verified_at=timestamp
 * - Google OAuth (email already verified): status=ACTIVE, verified_at=timestamp
 *
 * Valid migration_source values: PREIMPORT, JIT_VERIFIED_EMAIL, MANUAL, WEBHOOK
 */

import { supabase } from '../supabaseClient.js';
import crypto from 'node:crypto';
import { errorMessage } from '../types/http.js';

/**
 * Input data from WorkOS (user object or webhook payload).
 */
export interface WorkOSIdentityInput {
  workosUserId: string;       // WorkOS ID ("user_...")
  email: string;
  firstName?: string;
  lastName?: string;
  emailVerified?: boolean;
  profilePictureUrl?: string | null;
  /** migration_source for the identity link. Must be one of: PREIMPORT, JIT_VERIFIED_EMAIL, MANUAL, WEBHOOK */
  migrationSource?: string;
}

/**
 * Result of provisioning.
 */
export interface ProvisionResult {
  capfluxUserId: string;      // CAPFLUX canonical UUID
  isNew: boolean;             // true if a new CAPFLUX user was created
}

/**
 * WorkOSProvisioningService — single source of truth for WorkOS → CAPFLUX
 * identity provisioning.
 */
export class WorkOSProvisioningService {
  /**
   * Provision (or resolve) a CAPFLUX identity for a WorkOS user.
   *
   * If an ACTIVE identity link already exists for the WorkOS user ID,
   * returns the existing CAPFLUX UUID (idempotent).
   *
   * If no identity link exists, creates:
   *   1. public.users row with generated UUID
   *   2. public.user_profiles row
   *   3. public.user_identity_links row
   *
   * Identity state:
   * - If emailVerified=false: status=PENDING, verified_at=NULL
   * - If emailVerified=true: status=ACTIVE, verified_at=timestamp
   *
   * @param input - WorkOS user data
   * @returns ProvisionResult with capfluxUserId and isNew flag
   * @throws Error on unrecoverable database failures
   */
  async provisionWorkOSIdentity(input: WorkOSIdentityInput): Promise<ProvisionResult> {
    const { workosUserId, email, firstName, lastName, emailVerified, profilePictureUrl } = input;
    const migrationSource = input.migrationSource || 'MANUAL';

    // Validate WorkOS ID format
    if (!workosUserId || typeof workosUserId !== 'string') {
      throw new Error('Invalid WorkOS user ID: empty or not a string');
    }
    if (!workosUserId.match(/^user_[0-9A-Za-z]{10,}$/)) {
      throw new Error(`Invalid WorkOS user ID format: ${workosUserId}`);
    }

    // Step 1: Check for existing identity link (ACTIVE or PENDING) by WorkOS user ID
    const { data: existingLink, error: linkErr } = await supabase
      .from('user_identity_links')
      .select('capflux_user_id, status')
      .eq('workos_user_id', workosUserId)
      .eq('identity_type', 'workos_authkit')
      .maybeSingle();

    if (linkErr) {
      throw new Error(`Failed to query identity link: ${errorMessage(linkErr)}`);
    }

    if (existingLink) {
      // Identity already exists — idempotent, return existing UUID
      console.log(`[provisioning] Existing identity resolved: workos_user_id=${workosUserId} -> capflux_user_id=${existingLink.capflux_user_id} (status=${existingLink.status})`);
      return { capfluxUserId: existingLink.capflux_user_id, isNew: false };
    }

    // Step 2: Check for REVOKED link — revoked identities cannot resurrect
    const { data: revokedLink } = await supabase
      .from('user_identity_links')
      .select('capflux_user_id')
      .eq('workos_user_id', workosUserId)
      .eq('identity_type', 'workos_authkit')
      .eq('status', 'REVOKED')
      .maybeSingle();

    if (revokedLink) {
      throw new Error(`WorkOS identity ${workosUserId} has been revoked and cannot be resurrected`);
    }

    // Step 3: Create new CAPFLUX user with generated UUID
    const capfluxUserId = crypto.randomUUID();
    const normalizedEmail = email.toLowerCase().trim();

    const { error: userErr } = await supabase
      .from('users')
      .insert({
        id: capfluxUserId,
        email: normalizedEmail,
        auth_provider: 'workos',
        email_verified: Boolean(emailVerified),
      });

    if (userErr) {
      // Unique constraint violation (email) — email already exists in CAPFLUX.
      // Do NOT perform email-based identity resolution. Throw so caller can handle.
      if (userErr.code === '23505') {
        throw new Error(`Email ${normalizedEmail} already exists — will JIT-provision on next login`);
      }
      throw new Error(`Failed to create CAPFLUX user: ${errorMessage(userErr)}`);
    }

    // Step 4: Create user profile
    const fullName = `${(firstName || '').trim()} ${(lastName || '').trim()}`.trim();
    const { error: profileErr } = await supabase
      .from('user_profiles')
      .insert({
        user_id: capfluxUserId,
        full_name: fullName || null,
        avatar_url: profilePictureUrl || null,
      });

    if (profileErr) {
      console.error(`[provisioning] Failed to create user profile for ${capfluxUserId}:`, errorMessage(profileErr));
      // Non-fatal — profile can be created on next login
    }

    // Step 5: Create identity link with correct state
    // - If email verified: status=ACTIVE, verified_at=timestamp
    // - If email not verified: status=PENDING, verified_at=NULL
    const identityStatus = emailVerified ? 'ACTIVE' : 'PENDING';
    const verifiedAt = emailVerified ? new Date().toISOString() : null;

    const { error: identityErr } = await supabase
      .from('user_identity_links')
      .insert({
        capflux_user_id: capfluxUserId,
        workos_user_id: workosUserId,
        identity_type: 'workos_authkit',
        status: identityStatus,
        migration_source: migrationSource,
        verified_at: verifiedAt,
      });

    if (identityErr) {
      // Duplicate key = idempotent (another request created it first)
      if (identityErr.code === '23505') {
        console.log(`[provisioning] Identity link already exists for WorkOS user ${workosUserId}`);
        // Fetch the existing link's capflux_user_id and return it
        const { data: existingAfterDup } = await supabase
          .from('user_identity_links')
          .select('capflux_user_id')
          .eq('workos_user_id', workosUserId)
          .eq('identity_type', 'workos_authkit')
          .maybeSingle();

        if (existingAfterDup) {
          // Clean up the orphaned user we just created (different UUID)
          await supabase.from('user_profiles').delete().eq('user_id', capfluxUserId);
          await supabase.from('users').delete().eq('id', capfluxUserId);
          return { capfluxUserId: existingAfterDup.capflux_user_id, isNew: false };
        }
      }
      throw new Error(`Failed to create identity link: ${errorMessage(identityErr)}`);
    }

    console.log(`[provisioning] New CAPFLUX identity provisioned: workos_user_id=${workosUserId} -> capflux_user_id=${capfluxUserId} (status=${identityStatus}, source=${migrationSource})`);
    return { capfluxUserId, isNew: true };
  }
}

// Singleton for use across the application
export const workosProvisioningService = new WorkOSProvisioningService();
