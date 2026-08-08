/**
 * Webhook Route — secure payment gateway webhook endpoint.
 *
 * Pipeline:
 *   Gateway -> signature verify -> provider event identify -> idempotency
 *   -> normalize -> resolve school -> resolve DVA/payment -> atomic
 *   payment+ledger post -> reconciliation hook -> audit -> notification.
 *
 * Security:
 *   - Signature verification is MANDATORY (fail closed in production).
 *   - Idempotency via provider_event_id unique index + idempotency_key.
 *   - The browser can never set payment status; only this pipeline (or
 *     server-side gateway verification) may produce SUCCESS.
 */
import express from 'express';
import { webhookVerifier } from '../services/WebhookVerifier.js';
import PaymentService from '../services/PaymentService.js';
import { supabase } from '../supabaseClient.js';
import { audit } from '../services/auditService.js';

const router = express.Router();

// Allowlist of webhook IPs (optional additional security)
const MONNIFY_WEBHOOK_IPS = process.env.MONNIFY_WEBHOOK_IPS?.split(',') || [];
const DEV_MODE = process.env.NODE_ENV !== 'production';

// Middleware: IP allowlist (in production)
const ipAllowlist = (req, res, next) => {
  if (DEV_MODE) return next();

  const clientIp = req.ip || req.connection.remoteAddress;
  if (MONNIFY_WEBHOOK_IPS.length > 0 && !MONNIFY_WEBHOOK_IPS.includes(clientIp)) {
    return res.status(403).json({ error: 'IP not allowed' });
  }
  next();
};

// POST /api/webhook/:provider
router.post('/:provider', ipAllowlist, async (req, res) => {
  const { provider } = req.params;
  const rawPayload = JSON.stringify(req.body);
  const signature = req.headers['x-monnify-signature'] || req.headers['monnify-signature'] || req.headers['x-paystack-signature'];

  // Validate provider
  if (!['monnify', 'paystack'].includes(provider)) {
    return res.status(400).json({ error: `Unknown provider: ${provider}` });
  }

  try {
    // Step 1: Signature verification — fail closed in production.
    if (!signature) {
      if (process.env.NODE_ENV === 'production') {
        return res.status(401).json({ error: 'Missing webhook signature' });
      }
      console.warn('[webhook] dev mode: accepting webhook without signature');
    } else if (!webhookVerifier.verifySignature(signature, rawPayload, provider)) {
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }

    const gateway = webhookVerifier.getGateway(provider);
    if (!gateway) {
      return res.status(400).json({ error: `Provider ${provider} not implemented` });
    }

    const providerEventId = gateway.parseWebhookEventId
      ? gateway.parseWebhookEventId(req.body)
      : req.body?.eventId || req.body?.paymentReference || null;

    // Step 2: Resolve the DVA to the school + student.
    const dvaAccount = gateway.parseWebhookDVA(req.body);
    const { data: paymentAccount, error: dvaError } = await supabase
      .from('payment_accounts')
      .select('*, students!inner(school_id, first_name, last_name, guardian_id)')
      .eq('virtual_account_number', dvaAccount)
      .eq('account_status', 'ACTIVE')
      .single();

    if (dvaError || !paymentAccount) {
      console.warn(`Webhook received for unknown DVA: ${dvaAccount}`);
      return res.status(200).json({ received: true, warning: 'DVA not found' });
    }

    const schoolId = paymentAccount.students.school_id;
    const studentId = paymentAccount.student_id;

    // Step 3: Run full verification pipeline (API verify; never trusts body).
    const verified = await webhookVerifier.verifyWebhook({
      payload: req.body,
      provider,
      school_id: schoolId,
    });

    // Step 4: Idempotency — already processed returns without side effects.
    if (verified.alreadyProcessed) {
      console.log(`Payment ${verified.reference} already processed, skipping`);
      return res.status(200).json({ received: true, alreadyProcessed: true });
    }

    // Step 5: Atomic payment + ledger post (idempotent via RPC).
    const amountMinor = Math.round(Number(verified.amount) * 100);
    const result = await PaymentService.recordVerifiedPayment({
      schoolId,
      studentId,
      reference: verified.reference,
      gatewayTxnRef: verified.gateway_txn_ref,
      providerEventId,
      amountMinor,
      entryCategory: 'TUITION',
      rawPayload: req.body,
      idempotencyKey: `pay:${providerEventId || verified.reference}`,
    });

    if (result.already_processed) {
      return res.status(200).json({ received: true, alreadyProcessed: true });
    }

    // Step 6: Reconciliation hook — record a reconciliation run checkpoint.
    await supabase.from('reconciliation_runs').insert({
      school_id: schoolId,
      provider,
      start_date: new Date().toISOString().slice(0, 10),
      end_date: new Date().toISOString().slice(0, 10),
      status: 'RUNNING',
      summary: { source: 'webhook', reference: verified.reference },
    }).then(() => {}).catch(() => {});

    // Step 7: Notification (non-authoritative; failure must not break flow).
    const { data: student } = await supabase
      .from('students')
      .select('*, guardians(primary_phone)')
      .eq('id', studentId)
      .single();

    if (student) {
      const guardianPhone =
        (student.guardians && typeof student.guardians === 'object' && student.guardians.primary_phone) ||
        student.guardian_phone ||
        null;

      await supabase.from('notifications').insert({
        school_id: schoolId,
        student_id: studentId,
        guardian_id: student.guardian_id || null,
        recipient_phone: guardianPhone || '',
        message_body: `Payment of ₦${(amountMinor / 100).toLocaleString()} received for ${student.first_name} ${student.last_name}. Thank you. - CAPFLUX`,
        delivery_status: 'PENDING',
        client_sequence: Date.now(),
        device_id: 'webhook-handler',
      }).catch(() => {});
    }

    console.log(`Webhook processed successfully: ${verified.reference}`);
    return res.status(200).json({ received: true, processed: true });

  } catch (error) {
    console.error('Webhook processing error:', error);

    // Handle idempotency errors gracefully.
    if (error.message?.includes('already processed') || error.code === '23505') {
      return res.status(200).json({ received: true, alreadyProcessed: true });
    }

    // Return 500 for other errors (gateway will retry).
    return res.status(500).json({ error: 'Webhook processing failed', details: error.message });
  }
});

export default router;
