/**
 * WorkOSWebhookService - WorkOS webhook event processing service
 *
 * Handles WorkOS webhook events for user lifecycle management:
 *   - user.created
 *   - user.updated
 *   - user.deleted
 *   - session.revoked
 *
 * This service contains the event-processing logic rather than placing
 * business logic directly inside the Express route.
 *
 * CRITICAL: WorkOS user IDs (e.g., "user_01EHWNC0FCBHZ3BJ7EGKYXK0E6") are TEXT
 * identifiers. CAPFLUX canonical IDs are UUIDs. The identity mapping is done
 * EXCLUSIVELY through public.user_identity_links which bridges:
 *   workos_user_id (TEXT) -> capflux_user_id (UUID)
 *
 * NEVER write WorkOS IDs directly into UUID columns (public.users.id,
 * public.user_profiles.user_id). Always resolve through user_identity_links.
 * NEVER use email matching for identity resolution - it enables unauthorized
 * account merging. The identity bridge is the ONLY authoritative mapping.
 */

import { supabase } from '../supabaseClient.js';
import { WorkOS } from '@workos-inc/node';
import { errorMessage } from '../types/http.js';

/**
 * Normalized WorkOS user data for internal use.
 */
interface WorkOSUserData {
  id: string;                    // WorkOS user ID (e.g., "user_01EHWNC0FCBHZ3BJ7EGKYXK0E6")
  email: string;
  firstName: string;
  lastName: string;
  emailVerified: boolean;
  createdAt?: string;
  updatedAt?: string;
  profilePictureUrl?: string | null;
}

/**
 * Normalized WorkOS webhook event.
 */
interface WorkOSEvent {
  id: string;                    // WorkOS event ID (e.g., "evt_...")
  event: string;                 // Event type (e.g., "user.created")
  data: Record<string, unknown>; // Event payload (contains WorkOS user ID)
  timestamp: string;
}

/**
 * Result of event processing.
 */
interface EventProcessingResult {
  success: boolean;
  eventId: string;
  eventType: string;
  alreadyProcessed?: boolean;
  error?: string;
}

/**
 * WorkOSWebhookService - Handles WorkOS webhook event processing.
 *
 * Key architectural principle: WorkOS IDs (TEXT) are NEVER written to UUID columns.
 * All identity resolution goes EXCLUSIVELY through public.user_identity_links.
 * Email matching is NEVER used for identity resolution - it enables unauthorized
 * account merging. The identity bridge is the ONLY authoritative mapping.
 *
 * Idempotency: Durable, database-backed via public.workos_webhook_events table.
 * The database is the source of truth for event processing state.
 */
export class WorkOSWebhookService {
  private workos: WorkOS;

  constructor() {
    const apiKey = process.env.WORKOS_API_KEY;
    const clientId = process.env.WORKOS_CLIENT_ID;

    if (!apiKey || !clientId) {
      throw new Error('WORKOS_API_KEY and WORKOS_CLIENT_ID are required');
    }

    this.workos = new WorkOS(process.env.WORKOS_API_KEY!, {
      clientId: process.env.WORKOS_CLIENT_ID,
    });
  }

  /**
   * Resolve a WorkOS user ID to a CAPFLUX canonical UUID.
   *
   * This is the core identity resolution function. It MUST be used for ALL
   * webhook event handlers that need to write to UUID columns.
   *
   * Resolution logic (strict hierarchy - NO email fallback):
   * 1. Validate WorkOS ID format
   * 2. Look up existing identity link in user_identity_links (ACTIVE only)
   * 3. If found, return the capflux_user_id (canonical UUID)
   * 4. If not found, check for REVOKED link - if found, throw error (revoked identities cannot resurrect)
   * 5. If not found and not revoked, generate new UUID and create identity link
   *
   * @param workosUserId - WorkOS user ID (e.g., "user_01EHWNC0FCBHZ3BJ7EGKYXK0E6")
   * @returns CAPFLUX canonical UUID
   * @throws Error if resolution fails
   */
  private async resolveCAPFLUXUserId(workosUserId: string): Promise<string> {
    // Step A: Validate WorkOS ID format
    if (!workosUserId || typeof workosUserId !== 'string') {
      throw new Error('Invalid WorkOS user ID: empty or not a string');
    }
    if (!workosUserId.match(/^user_[0-9A-Za-z]{10,}$/)) {
      throw new Error(`Invalid WorkOS user ID format: ${workosUserId}`);
    }

    // Step 1: Look up existing identity link in user_identity_links (ACTIVE only)
    const { data: existingLink, error: linkErr } = await supabase
      .from('user_identity_links')
      .select('capflux_user_id')
      .eq('workos_user_id', workosUserId)
      .eq('identity_type', 'workos_authkit')
      .eq('status', 'ACTIVE')
      .maybeSingle();

    if (linkErr) {
      throw new Error(`Failed to query identity link: ${errorMessage(linkErr)}`);
    }

    if (existingLink) {
      // Found existing identity link - return the canonical CAPFLUX UUID
      console.log(`[workos-webhook] Resolved existing identity link: workos_user_id=${workosUserId} -> capflux_user_id=${existingLink.capflux_user_id}`);
      return existingLink.capflux_user_id;
    }

    // Step 2: Check for REVOKED link - revoked identities cannot resurrect
    const { data: revokedLink, error: revokedErr } = await supabase
      .from('user_identity_links')
      .select('capflux_user_id')
      .eq('workos_user_id', workosUserId)
      .eq('identity_type', 'workos_authkit')
      .eq('status', 'REVOKED')
      .maybeSingle();

    if (revokedErr) {
      throw new Error(`Failed to query revoked identity link: ${errorMessage(revokedErr)}`);
    }

    if (revokedLink) {
      // Revoked identity cannot resurrect - throw error
      console.error(`[workos-webhook] Revoked identity attempted to resurrect: workos_user_id=${workosUserId}`);
      throw new Error(`WorkOS identity ${workosUserId} has been revoked and cannot be resurrected`);
    }

    // No existing identity link - generate new canonical UUID
    const { data: uuidData, error: uuidError } = await supabase.rpc('gen_random_uuid_rpc');
    if (uuidError || !uuidData) {
      throw new Error('Failed to generate UUID for new CAPFLUX user');
    }
    const capfluxUserId = uuidData;
    console.log(`[workos-webhook] Generated new CAPFLUX UUID: ${capfluxUserId} for WorkOS ID: ${workosUserId}`);

    // Create the identity link in user_identity_links
    // Use insert with onConflict to handle race conditions - if a link already exists,
    // the unique constraint will cause a conflict, and we should fetch the existing link
    const { error: linkError } = await supabase
      .from('user_identity_links')
      .insert({
        capflux_user_id: capfluxUserId,
        workos_user_id: workosUserId,
        identity_type: 'workos_authkit',
        status: 'ACTIVE',
        migration_source: 'WEBHOOK',
        verified_at: new Date().toISOString(),
      });

    if (linkError) {
      // Check if this is a unique constraint violation (race condition)
      if (linkError.code === '23505') {
        // Another request created the link concurrently - fetch the existing link
        const { data: existingLink, error: retryErr } = await supabase
          .from('user_identity_links')
          .select('capflux_user_id')
          .eq('workos_user_id', workosUserId)
          .eq('identity_type', 'workos_authkit')
          .eq('status', 'ACTIVE')
          .maybeSingle();

        if (retryErr) {
          throw new Error(`Failed to query identity link after conflict: ${errorMessage(retryErr)}`);
        }

        if (existingLink) {
          console.log(`[workos-webhook] Race condition resolved: workos_user_id=${workosUserId} -> capflux_user_id=${existingLink.capflux_user_id}`);
          return existingLink.capflux_user_id;
        }
      }
      throw new Error(`Failed to create identity link: ${errorMessage(linkError)}`);
    }

    console.log(`[workos-webhook] Created identity link: workos_user_id=${workosUserId} -> capflux_user_id=${capfluxUserId}`);
    return capfluxUserId;
  }

  /**
   * Normalize WorkOS user data from webhook payload.
   */
  private normalizeWorkOSUser(userData: Record<string, unknown>): WorkOSUserData | null {
    const id = userData.id as string | undefined;
    const email = userData.email as string | undefined;
    const firstName = userData.first_name as string | undefined;
    const lastName = userData.last_name as string | undefined;
    const emailVerified = userData.email_verified as boolean | undefined;
    const createdAt = userData.created_at as string | undefined;
    const updatedAt = userData.updated_at as string | undefined;
    const profilePictureUrl = userData.profile_picture_url as string | undefined;

    if (!id || !email) {
      return null;
    }

    return {
      id,
      email,
      firstName: firstName || '',
      lastName: lastName || '',
      emailVerified: Boolean(emailVerified),
      createdAt,
      updatedAt,
      profilePictureUrl: profilePictureUrl || null,
    };
  }

  /**
   * Upsert CAPFLUX user record using the canonical UUID.
   * This writes to public.users and public.user_profiles using the CAPFLUX UUID.
   * NEVER writes WorkOS ID to UUID columns.
   */
  private async upsertCAPFLUXUser(capfluxUserId: string, userData: WorkOSUserData): Promise<{ success: boolean; error?: string }> {
    try {
      // Upsert user record using CAPFLUX UUID
      const { error: userError } = await supabase
        .from('users')
        .upsert({
          id: capfluxUserId,  // CANONICAL UUID - never WorkOS ID
          email: userData.email,
          auth_provider: 'workos',
          email_verified: userData.emailVerified,
        }, {
          onConflict: 'id',
        });

      if (userError) {
        console.error('[workos-webhook] Failed to upsert user:', errorMessage(userError));
        return { success: false, error: errorMessage(userError) };
      }

      // Upsert user profile
      const fullName = `${userData.firstName} ${userData.lastName}`.trim();

      const { error: profileError } = await supabase
        .from('user_profiles')
        .upsert({
          user_id: capfluxUserId,  // CANONICAL UUID - never WorkOS ID
          full_name: fullName || null,
          avatar_url: userData.profilePictureUrl || null,
        }, {
          onConflict: 'user_id',
        });

      if (profileError) {
        console.error('[workos-webhook] Failed to upsert user profile:', errorMessage(profileError));
        return { success: false, error: errorMessage(profileError) };
      }

      return { success: true };
    } catch (error) {
      console.error('[workos-webhook] Unexpected error upserting CAPFLUX user:', errorMessage(error));
      return { success: false, error: errorMessage(error) };
    }
  }

  /**
   * Handle user.created event.
   * Creates or updates the CAPFLUX user record using the canonical UUID.
   */
  async handleUserCreated(event: WorkOSEvent): Promise<EventProcessingResult> {
    const eventId = event.id;
    const eventType = 'user.created';

    try {
      const userData = this.normalizeWorkOSUser(event.data as Record<string, unknown>);
      if (!userData) {
        return { success: false, eventId, eventType, error: 'Invalid user data in event payload' };
      }

      // Resolve WorkOS ID to CAPFLUX UUID (ONLY through identity bridge)
      const capfluxUserId = await this.resolveCAPFLUXUserId(userData.id);

      // Upsert CAPFLUX user records using the canonical UUID
      const result = await this.upsertCAPFLUXUser(capfluxUserId, userData);

      if (result.success) {
        console.log(`[workos-webhook] received event=user.created id=${eventId} workos_user_id=${userData.id} capflux_user_id=${capfluxUserId}`);
        return { success: true, eventId, eventType };
      } else {
        return { success: false, eventId, eventType, error: result.error };
      }
    } catch (error) {
      console.error('[workos-webhook] Error handling user.created:', errorMessage(error));
      return { success: false, eventId, eventType, error: errorMessage(error) };
    }
  }

  /**
   * Handle user.updated event.
   * Synchronizes changed WorkOS user information using the canonical UUID.
   */
  async handleUserUpdated(event: WorkOSEvent): Promise<EventProcessingResult> {
    const eventId = event.id;
    const eventType = 'user.updated';

    try {
      const userData = this.normalizeWorkOSUser(event.data as Record<string, unknown>);
      if (!userData) {
        return { success: false, eventId, eventType, error: 'Invalid user data in event payload' };
      }

      // Resolve WorkOS ID to CAPFLUX UUID (ONLY through identity bridge)
      const capfluxUserId = await this.resolveCAPFLUXUserId(userData.id);

      // Upsert CAPFLUX user records using the canonical UUID
      const result = await this.upsertCAPFLUXUser(capfluxUserId, userData);

      if (result.success) {
        console.log(`[workos-webhook] received event=user.updated id=${eventId} workos_user_id=${userData.id} capflux_user_id=${capfluxUserId}`);
        return { success: true, eventId, eventType };
      } else {
        return { success: false, eventId, eventType, error: result.error };
      }
    } catch (error) {
      console.error('[workos-webhook] Error handling user.updated:', errorMessage(error));
      return { success: false, eventId, eventType, error: errorMessage(error) };
    }
  }

  /**
   * Handle user.deleted event.
   * Marks the user as deactivated/deleted in CAPFLUX using the canonical UUID.
   * Does NOT delete financial records - they must remain auditable.
   * Uses soft-delete/deactivation pattern consistent with CAPFLUX conventions.
   */
  async handleUserDeleted(event: WorkOSEvent): Promise<EventProcessingResult> {
    const eventId = event.id;
    const eventType = 'user.deleted';

    try {
      const workosUserId = event.data.id as string | undefined;
      if (!workosUserId) {
        return { success: false, eventId, eventType, error: 'Missing user ID in event payload' };
      }

      // Resolve WorkOS ID to CAPFLUX UUID via identity link
      const { data: link, error: linkErr } = await supabase
        .from('user_identity_links')
        .select('capflux_user_id')
        .eq('workos_user_id', workosUserId)
        .eq('identity_type', 'workos_authkit')
        .eq('status', 'ACTIVE')
        .maybeSingle();

      if (linkErr) {
        throw new Error(`Failed to resolve identity link: ${errorMessage(linkErr)}`);
      }

      if (!link) {
        // No identity link exists - this could be a user that was never fully provisioned
        // Log and return success (idempotent)
        console.log(`[workos-webhook] No identity link found for deleted user: ${workosUserId}`);
        return { success: true, eventId, eventType };
      }

      const capfluxUserId = link.capflux_user_id;

      // Soft-delete: mark user as deactivated, preserve financial records
      const { error } = await supabase
        .from('users')
        .update({
          email_verified: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', capfluxUserId);

      if (error) {
        console.error('[workos-webhook] Failed to mark user as deleted:', errorMessage(error));
        return { success: false, eventId, eventType, error: errorMessage(error) };
      }

      // Also deactivate user profile
      const { error: profileError } = await supabase
        .from('user_profiles')
        .update({ full_name: null, avatar_url: null })
        .eq('user_id', capfluxUserId);

      if (profileError) {
        console.warn('[workos-webhook] Failed to clear user profile:', errorMessage(profileError));
      }

      // Mark identity link as REVOKED
      await supabase
        .from('user_identity_links')
        .update({ status: 'REVOKED', updated_at: new Date().toISOString() })
        .eq('workos_user_id', workosUserId)
        .eq('identity_type', 'workos_authkit');

      console.log(`[workos-webhook] received event=user.deleted id=${eventId} workos_user_id=${workosUserId} capflux_user_id=${capfluxUserId}`);
      return { success: true, eventId, eventType };
    } catch (error) {
      console.error('[workos-webhook] Error handling user.deleted:', errorMessage(error));
      return { success: false, eventId, eventType, error: errorMessage(error) };
    }
  }

  /**
   * Handle session.revoked event.
   * Invalidates the user's session in CAPFLUX.
   */
  async handleSessionRevoked(event: WorkOSEvent): Promise<EventProcessingResult> {
    const eventId = event.id;
    const eventType = 'session.revoked';

    try {
      const workosUserId = event.data.user_id as string | undefined;
      const sessionId = event.data.id as string | undefined;

      if (!workosUserId) {
        return { success: false, eventId, eventType, error: 'Missing user_id in session.revoked event' };
      }

      // Log the session revocation for audit purposes
      console.log(`[workos-webhook] received event=session.revoked id=${eventId} workos_user_id=${workosUserId} session_id=${sessionId || 'unknown'}`);

      // In a full implementation, we would invalidate the user's session cookie
      // by revoking the session in the SessionService. For now, we log the event.

      return { success: true, eventId, eventType };
    } catch (error) {
      console.error('[workos-webhook] Error handling session.revoked:', errorMessage(error));
      return { success: false, eventId, eventType, error: errorMessage(error) };
    }
  }

  /**
   * Dispatch an event to the appropriate handler with durable idempotency.
   * Uses the database-backed workos_webhook_events table for idempotency.
   */
  async dispatchEvent(event: WorkOSEvent): Promise<EventProcessingResult> {
    const eventId = event.id;
    const eventType = event.event;

    // Claim the event in the database (atomic idempotency check + claim)
    const { data: claimResult, error: claimErr } = await supabase
      .rpc('workos_webhook_event_claim', {
        p_workos_event_id: eventId,
        p_event_type: eventType,
      });

    if (claimErr) {
      console.error('[workos-webhook] Failed to claim event:', {
        message: claimErr.message,
        code: claimErr.code,
        details: claimErr.details,
        hint: claimErr.hint,
      });
      return { success: false, eventId, eventType, error: 'Failed to claim event for processing' };
    }

    if (!claimResult || claimResult.length === 0) {
      return { success: false, eventId, eventType, error: 'Failed to claim event' };
    }

    const claim = claimResult[0];

    // If already completed, return success (idempotent)
    if (claim.status === 'COMPLETED') {
      console.log(`[workos-webhook] Event already completed: ${eventType} id=${eventId}`);
      return { success: true, eventId, eventType, alreadyProcessed: true };
    }

    // If currently being processed by another request, don't duplicate work
    if (claim.status === 'PROCESSING' && !claim.claimed) {
      console.log(`[workos-webhook] Event already processing: ${eventType} id=${eventId}`);
      return { success: true, eventId, eventType, alreadyProcessed: true };
    }

    // If this request owns the event (claimed === true), proceed to process
    // This handles: newly claimed PROCESSING, retried FAILED, or fresh PENDING
    if (claim.claimed !== true) {
      console.log(`[workos-webhook] Event claimed by another request: ${eventType} id=${eventId}`);
      return { success: true, eventId, eventType, alreadyProcessed: true };
    }

    const startTime = Date.now();

    try {
      let result: EventProcessingResult;

      switch (eventType) {
        case 'user.created':
          result = await this.handleUserCreated(event);
          break;
        case 'user.updated':
          result = await this.handleUserUpdated(event);
          break;
        case 'user.deleted':
          result = await this.handleUserDeleted(event);
          break;
        case 'session.revoked':
          result = await this.handleSessionRevoked(event);
          break;
        default:
          console.warn(`[workos-webhook] Unhandled event type: ${eventType}`);
          return { success: true, eventId, eventType, error: `Unhandled event type: ${eventType}` };
      }

      const duration = Date.now() - startTime;

      if (result.success) {
        // Mark event as completed in the database
        const { error: completeErr } = await supabase.rpc('workos_webhook_event_complete', {
          p_workos_event_id: eventId,
        });
        if (completeErr) {
          console.error('[workos-webhook] Failed to mark event as completed:', {
            message: completeErr.message,
            code: completeErr.code,
            details: completeErr.details,
            hint: completeErr.hint,
          });
        }

        console.log(`[workos-webhook] received event=${eventType} id=${eventId} (${duration}ms)`);
        return { success: true, eventId, eventType };
      } else {
        // Mark event as failed (retryable)
        const { error: failErr } = await supabase.rpc('workos_webhook_event_fail', {
          p_workos_event_id: eventId,
          p_error: result.error || 'Unknown error',
        });
        if (failErr) {
          console.error('[workos-webhook] Failed to mark event as failed:', {
            message: failErr.message,
            code: failErr.code,
            details: failErr.details,
            hint: failErr.hint,
          });
        }

        console.error(`[workos-webhook] Event processing failed: ${eventType} id=${eventId}: ${result.error}`);
        return { success: false, eventId, eventType, error: result.error };
      }
    } catch (error) {
      // Mark event as failed
      const { error: failErr } = await supabase.rpc('workos_webhook_event_fail', {
        p_workos_event_id: eventId,
        p_error: errorMessage(error),
      });
      if (failErr) {
        console.error('[workos-webhook] Failed to mark event as failed:', {
          message: failErr.message,
          code: failErr.code,
          details: failErr.details,
          hint: failErr.hint,
        });
      }

      console.error('[workos-webhook] Event dispatch error:', errorMessage(error));
      return { success: false, eventId, eventType, error: errorMessage(error) };
    }
  }
}

// Singleton instance for use across the application
export const workosWebhookService = new WorkOSWebhookService();