/**
 * Webhook Route - Secure webhook endpoint for payment gateway notifications
 * 
 * Endoints:
 * - POST /api/webhook/monnify - Receive Monnify webhooks
 * 
 * Security:
 * - Rate limiting
 * - HMAC signature verification
 * - Full API verification (webhooks never trusted directly)
 * - Idempotency protection
 */

import express from 'express';
import crypto from 'crypto';
import { webhookVerifier } from '../services/WebhookVerifier.js';
import { LedgerService } from '../services/LedgerService.js';
import { supabase } from '../supabaseClient.js';

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
  const signature = req.headers['x-monnify-signature'] || req.headers['monnify-signature'];

  // Validate provider
  if (!['monnify', 'flutterwave', 'remita'].includes(provider)) {
    return res.status(400).json({ error: `Unknown provider: ${provider}` });
  }

  try {
    // Step 1: Verify webhook signature (if secret configured)
    if (signature && !webhookVerifier.verifySignature(signature, rawPayload, provider)) {
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }

    // Step 2: Parse webhook to determine school
    // For Monnify, we need to find the school from the DVA account
    const gateway = provider === 'monnify' ? webhookVerifier.providers.monnify : null;
    if (!gateway) {
      return res.status(400).json({ error: `Provider ${provider} not implemented` });
    }

    const dvaAccount = gateway.parseWebhookDVA(req.body);
    
    // Find the DVA assignment to get school_id
    const { data: dvaAssignment, error: dvaError } = await supabase
      .from('dva_assignments')
      .select('*, students!inner(school_id, first_name, last_name, guardian_phone)')
      .eq('dva_account_number', dvaAccount)
      .eq('is_active', true)
      .single();

    if (dvaError || !dvaAssignment) {
      console.warn(`Webhook received for unknown DVA: ${dvaAccount}`);
      return res.status(200).json({ received: true, warning: 'DVA not found' });
    }

    const school_id = dvaAssignment.students.school_id;

    // Step 3: Run full verification pipeline
    const verified = await webhookVerifier.verifyWebhook({
      payload: req.body,
      provider,
      school_id,
    });

    // Step 4: Handle idempotency
    if (verified.alreadyProcessed) {
      console.log(`Payment ${verified.reference} already processed, skipping`);
      return res.status(200).json({ received: true, alreadyProcessed: true });
    }

    // Step 5: Save payment transaction record
    const paymentTransaction = await LedgerService.savePaymentTransaction({
      reference: verified.reference,
      school_id: verified.school_id,
      student_id: verified.student_id,
      gateway_txn_ref: verified.gateway_txn_ref,
      amount: verified.amount,
      entry_category: 'TUITION',
      settlement_status: 'SUCCESS',
      raw_payload: verified.raw_payload,
    });

    // Step 6: Record CREDIT ledger entry
    const ledgerEntry = await LedgerService.recordVerifiedPayment({
      school_id: verified.school_id,
      student_id: verified.student_id,
      amount: verified.amount,
      reference: verified.reference,
      transaction: verified.transaction,
    });

    // Step 7: Record settlement records
    const settlements = gateway.parseSettlementDetails(req.body);
    await LedgerService.recordSettlements(paymentTransaction.id, settlements);

    // Step 8: Enqueue notification
    const { data: student } = await supabase
      .from('students')
      .select('*')
      .eq('id', verified.student_id)
      .single();

    if (student) {
      await supabase.from('notifications').insert({
        school_id: verified.school_id,
        student_id: verified.student_id,
        recipient_phone: student.guardian_phone,
        message_body: `Payment of ₦${verified.amount.toLocaleString()} received for ${student.first_name} ${student.last_name}. Thank you. - Capstone`,
        delivery_status: 'PENDING',
        client_sequence: Date.now(),
        device_id: 'webhook-handler',
      });
    }

    console.log(`Webhook processed successfully: ${verified.reference}`);
    return res.status(200).json({ received: true, processed: true });

  } catch (error) {
    console.error('Webhook processing error:', error);
    
    // Handle idempotency errors gracefully
    if (error.message?.includes('already processed') || error.code === '23505') {
      return res.status(200).json({ received: true, alreadyProcessed: true });
    }

    // Return 500 for other errors (gateway will retry)
    return res.status(500).json({ error: 'Webhook processing failed', details: error.message });
  }
});

export default router;