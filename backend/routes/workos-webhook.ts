/**
 * WorkOS Webhook Route — secure WorkOS webhook endpoint.
 *
 * Pipeline:
 *   WorkOS -> signature verify -> event dispatch -> CAPFLUX user synchronization
 *
 * Security:
 *   - Signature verification is MANDATORY (fail closed in production).
 *   - Raw request body is required for signature verification.
 *   - Idempotency via WorkOS event IDs.
 *   - The browser can never set authentication state; only this pipeline
 *     (or server-side WorkOS verification) may produce authenticated state.
 */

import { Router, Request, Response } from 'express';
import { WorkOS } from '@workos-inc/node';
import { workosWebhookService } from '../services/WorkOSWebhookService.js';
import { errorMessage } from '../types/http.js';

const router = Router();

// Allow raw body parsing for signature verification
// This route must be registered BEFORE express.json() in the main app

// POST /api/webhooks/workos
router.post('/', async (req: Request, res: Response) => {
  const startTime = Date.now();

  // 1. Verify raw body is present (express.raw middleware should have populated req.body as Buffer)
  const rawBody = req.body;

  if (!rawBody || (typeof rawBody === 'object' && Object.keys(rawBody).length === 0)) {
    console.error('[workos-webhook] Missing request body');
    return res.status(400).json({ error: 'Missing request body' });
  }

  // 2. Read WorkOS-Signature header
  const signatureHeader = req.headers['workos-signature'] as string | undefined;

  if (!signatureHeader) {
    console.error('[workos-webhook] Missing WorkOS-Signature header');
    return res.status(401).json({ error: 'Missing WorkOS-Signature header' });
  }

  // 3. Read webhook secret from environment
  const webhookSecret = process.env.WORKOS_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('[workos-webhook] WORKOS_WEBHOOK_SECRET not configured');
    return res.status(500).json({ error: 'Webhook secret not configured' });
  }

  // 4. Initialize WorkOS SDK for signature verification
  const apiKey = process.env.WORKOS_API_KEY;
  const clientId = process.env.WORKOS_CLIENT_ID;

  if (!apiKey || !process.env.WORKOS_CLIENT_ID) {
    console.error('[workos-webhook] WorkOS SDK not configured');
    return res.status(500).json({ error: 'WorkOS SDK not configured' });
  }

  const workos = new WorkOS(process.env.WORKOS_API_KEY!, {
    clientId: process.env.WORKOS_CLIENT_ID!,
  });

  // 4. Verify signature using official WorkOS SDK
  let verifiedEvent: { event: string; id: string; data: Record<string, unknown>; timestamp: string } | null = null;

  try {
    // Convert raw body to string for verification
    const payload = rawBody instanceof Buffer ? rawBody.toString('utf8') : JSON.stringify(rawBody);

    const event = await workos.webhooks.constructEvent({
      payload,
      sigHeader: signatureHeader,
      secret: process.env.WORKOS_WEBHOOK_SECRET!,
      tolerance: 180000, // 3 minutes tolerance (default)
    });

    // The WorkOS SDK returns an event with properties: event, id, data, timestamp
    // Cast through unknown to satisfy TypeScript
    verifiedEvent = event as unknown as {
      event: string;
      id: string;
      data: Record<string, unknown>;
      timestamp: string;
    };
  } catch (error) {
    console.error('[workos-webhook] Signature verification failed:', errorMessage(error));
    return res.status(401).json({ error: 'Invalid WorkOS signature' });
  }

  if (!verifiedEvent) {
    return res.status(401).json({ error: 'Failed to verify webhook signature' });
  }

  // 5. Dispatch event to WorkOSWebhookService
  const event = {
    id: verifiedEvent.id,
    event: verifiedEvent.event,
    data: verifiedEvent.data,
    timestamp: verifiedEvent.timestamp,
  };

  try {
    const result = await workosWebhookService.dispatchEvent({
      id: event.id,
      event: event.event,
      data: event.data,
      timestamp: event.timestamp,
    });

    const duration = Date.now() - startTime;

    if (result.alreadyProcessed) {
      console.log(`[workos-webhook] Event already processed: ${event.event} id=${event.id} (${duration}ms)`);
      return res.status(200).json({ received: true, alreadyProcessed: true });
    }

    if (!result.success) {
      console.error(`[workos-webhook] Event processing failed: ${event.event} id=${event.id}: ${result.error}`);
      return res.status(500).json({ error: 'Event processing failed', details: result.error });
    }

    console.log(`[workos-webhook] received event=${event.event} id=${event.id} (${duration}ms)`);
    return res.status(200).json({ received: true, processed: true });

  } catch (error) {
    console.error('[workos-webhook] Event dispatch error:', errorMessage(error));
    return res.status(500).json({ error: 'Event processing failed', details: errorMessage(error) });
  }
});

export default router;