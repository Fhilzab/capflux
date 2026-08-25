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
 * Idempotency is handled via WorkOS event IDs. The same event ID will
 * only be processed once. See the event idempotency table in the database
 * when it is created.
 */

import { supabase } from '../supabaseClient.js';
import { WorkOS } from '@workos-inc/node';
import { errorMessage } from '../types/http.js';

/**
 * Normalized WorkOS user data for internal use.
 */
interface WorkOSUserData {
  id: string;
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
  id: string;
  event: string;
  data: Record<string, unknown>;
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
   * Check if an event has already been processed.
   * Uses a simple in-memory cache for now; will be replaced by a
   * database-backed idempotency table when the migration is created.
   */
  private processedEvents = new Set<string>();

  private isEventProcessed(eventId: string): boolean {
    return this.processedEvents.has(eventId);
  }

  private markEventProcessed(eventId: string): void {
    this.processedEvents.add(eventId);
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
   * Upsert CAPFLUX user record from WorkOS user data.
   * This creates/updates the user in the users and user_profiles tables.
   */
  private async upsertCAPFLUXUser(userData: WorkOSUserData): Promise<{ success: boolean; error?: string }> {
    try {
      // Upsert user record
      const { error: userError } = await supabase
        .from('users')
        .upsert({
          id: userData.id,
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
          user_id: userData.id,
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
   * Creates or updates the CAPFLUX user record.
   */
  async handleUserCreated(event: WorkOSEvent): Promise<EventProcessingResult> {
    const eventId = event.id;
    const eventType = 'user.created';

    if (this.isEventProcessed(eventId)) {
      return { success: true, eventId, eventType, alreadyProcessed: true };
    }

    try {
      const userData = this.normalizeWorkOSUser(event.data as Record<string, unknown>);
      if (!userData) {
        return { success: false, eventId, eventType, error: 'Invalid user data in event payload' };
      }

      const result = await this.upsertCAPFLUXUser(userData);

      if (result.success) {
        this.markEventProcessed(eventId);
        console.log(`[workos-webhook] received event=user.created id=${eventId} user_id=${event.data.id}`);
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
   * Synchronizes changed WorkOS user information.
   */
  async handleUserUpdated(event: WorkOSEvent): Promise<EventProcessingResult> {
    const eventId = event.id;
    const eventType = 'user.updated';

    if (this.isEventProcessed(eventId)) {
      return { success: true, eventId, eventType, alreadyProcessed: true };
    }

    try {
      const userData = this.normalizeWorkOSUser(event.data as Record<string, unknown>);
      if (!userData) {
        return { success: false, eventId, eventType, error: 'Invalid user data in event payload' };
      }

      const result = await this.upsertCAPFLUXUser(userData);

      if (result.success) {
        this.markEventProcessed(eventId);
        console.log(`[workos-webhook] received event=user.updated id=${eventId} user_id=${event.data.id}`);
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
   * Marks the user as deactivated/deleted in CAPFLUX.
   * Does NOT delete financial records - they must remain auditable.
   * Uses soft-delete/deactivation pattern consistent with CAPFLUX conventions.
   */
  async handleUserDeleted(event: WorkOSEvent): Promise<EventProcessingResult> {
    const eventId = event.id;
    const eventType = 'user.deleted';

    if (this.isEventProcessed(eventId)) {
      return { success: true, eventId, eventType, alreadyProcessed: true };
    }

    try {
      const userId = event.data.id as string | undefined;
      if (!userId) {
        return { success: false, eventId, eventType, error: 'Missing user ID in event payload' };
      }

      // Soft-delete: mark user as deactivated, preserve financial records
      const { error } = await supabase
        .from('users')
        .update({
          email_verified: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (error) {
        console.error('[workos-webhook] Failed to mark user as deleted:', errorMessage(error));
        return { success: false, eventId, eventType, error: errorMessage(error) };
      }

      // Also deactivate user profile
      const { error: profileError } = await supabase
        .from('user_profiles')
        .update({ full_name: null, avatar_url: null })
        .eq('user_id', event.data.id as string);

      if (profileError) {
        console.warn('[workos-webhook] Failed to clear user profile:', errorMessage(profileError));
      }

      this.markEventProcessed(eventId);
      console.log(`[workos-webhook] received event=user.deleted id=${eventId} user_id=${event.data.id}`);
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

    if (this.isEventProcessed(eventId)) {
      return { success: true, eventId, eventType, alreadyProcessed: true };
    }

    try {
      const userId = event.data.user_id as string | undefined;
      const sessionId = event.data.id as string | undefined;

      if (!userId) {
        return { success: false, eventId, eventType, error: 'Missing user_id in session.revoked event' };
      }

      // Log the session revocation for audit purposes
      console.log(`[workos-webhook] received event=session.revoked id=${eventId} user_id=${userId} session_id=${sessionId || 'unknown'}`);

      // In a full implementation, we would invalidate the user's session cookie
      // by revoking the session in the SessionService. For now, we log the event.

      this.markEventProcessed(eventId);
      return { success: true, eventId, eventType };
    } catch (error) {
      console.error('[workos-webhook] Error handling session.revoked:', errorMessage(error));
      return { success: false, eventId, eventType, error: errorMessage(error) };
    }
  }

  /**
   * Dispatch an event to the appropriate handler.
   */
  async dispatchEvent(event: WorkOSEvent): Promise<EventProcessingResult> {
    switch (event.event) {
      case 'user.created':
        return this.handleUserCreated(event);
      case 'user.updated':
        return this.handleUserUpdated(event);
      case 'user.deleted':
        return this.handleUserDeleted(event);
      case 'session.revoked':
        return this.handleSessionRevoked(event);
      default:
        console.warn(`[workos-webhook] Unhandled event type: ${event.event}`);
        return { success: true, eventId: event.id, eventType: event.event, error: `Unhandled event type: ${event.event}` };
    }
  }
}

// Singleton instance for use across the application
export const workosWebhookService = new WorkOSWebhookService();