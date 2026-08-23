/**
 * WebhookVerifier - Secure webhook validation service
 *
 * CRITICAL: Payment webhooks are NEVER trusted directly.
 * Every webhook triggers a full API verification before processing.
 */

import { supabase } from '../supabaseClient.js';
import { GatewayFactory } from './gateways/GatewayFactory.js';
import type { PaymentGateway } from './gateways/GatewayFactory.js';
import crypto from 'crypto';
import type {
  GatewayAssignmentRow,
  PaymentAccountRow,
  StudentRow,
} from '../types/db.js';
import type { GatewayConfig } from '../types/gateway.js';

interface VerifiedPaymentData {
  reference: string;
  amount: number;
  student_id: string;
  school_id: string;
  gateway_txn_ref: unknown;
  raw_payload: Record<string, unknown>;
  gatewayConfig: undefined;
  student: StudentRow | null;
  payment_account: PaymentAccountRow | null;
  transaction: Record<string, unknown>;
}

export class WebhookVerifier {
  /**
   * Resolve the gateway adapter for a provider.
   * Uses GatewayFactory (provider-agnostic); no hardcoded provider instances.
   */
  getGateway(provider: string): PaymentGateway | null {
    return GatewayFactory.get(provider);
  }

  /**
   * Verify webhook signature (HMAC) to ensure it's from the gateway
   */
  verifySignature(signature: unknown, payload: string, provider: string): boolean {
    const secret = process.env[`${provider.toUpperCase()}_WEBHOOK_SECRET`];
    if (!secret) {
      // A missing verification secret must NEVER be treated as a valid
      // signature. In production this is a hard failure. In development it is
      // logged loudly so integrations are not accidentally live without a secret.
      console.error(
        `[webhook] No ${provider} webhook secret configured — signature verification is DISABLED. ` +
        `Set ${provider.toUpperCase()}_WEBHOOK_SECRET before enabling live webhooks.`
      );
      return process.env.NODE_ENV === 'production' ? false : signature === undefined;
    }

    const expectedSignature = crypto
      .createHmac('sha512', secret)
      .update(payload)
      .digest('hex');

    return signature === expectedSignature;
  }

  /**
   * Verify webhook payload with the payment gateway API.
   * Gateway assignment is resolved from gateway_assignments (CAPFLUX-internal);
   * credentials come from the server environment, never the database.
   */
  async verifyWithAPI(reference: string, provider: string, school_id: string): Promise<{
    transaction: Record<string, unknown>;
    gatewayAssignment: GatewayAssignmentRow;
    gateway: PaymentGateway;
  }> {
    const gateway = this.getGateway(provider);
    if (!gateway) {
      throw new Error(`Unknown payment provider: ${provider}`);
    }

    // Resolve the CAPFLUX-internal gateway assignment for the school.
    const { data: assignment, error } = await supabase
      .from('gateway_assignments')
      .select('*')
      .eq('school_id', school_id)
      .eq('provider', provider)
      .in('status', ['ASSIGNED', 'ACTIVE'])
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !assignment) {
      throw new Error(`No active ${provider} gateway assignment for school ${school_id}`);
    }

    // Verify transaction with gateway API - NEVER trust webhook body.
    // gateway_config is intentionally empty; credentials come from server env.
    const transaction = await gateway.getTransaction(reference, {});

    if (!transaction) {
      throw new Error(`Transaction ${reference} not found on gateway`);
    }

    return {
      transaction,
      gatewayAssignment: assignment as GatewayAssignmentRow,
      gateway,
    };
  }

  /**
   * Check if transaction reference has already been processed (idempotency)
   */
  async isReferenceProcessed(reference: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('payment_transactions')
      .select('id')
      .eq('reference', reference)
      .single();

    return !error && data !== null;
  }

  /**
   * Verify student owns the payment account that received the payment
   */
  async verifyPaymentAccount(virtual_account_number: unknown, school_id: string): Promise<{
    student: StudentRow | null;
    payment_account: PaymentAccountRow | null;
  }> {
    const { data: paymentAccount, error } = await supabase
      .from('payment_accounts')
      .select('*, students!inner(id, school_id, first_name, last_name)')
      .eq('virtual_account_number', virtual_account_number as string)
      .eq('school_id', school_id)
      .eq('account_status', 'ACTIVE')
      .single();

    if (error || !paymentAccount) {
      throw new Error(`No active payment account found for ${virtual_account_number}`);
    }

    const row = paymentAccount as PaymentAccountRow & { students?: StudentRow };

    return {
      student: row.students ?? null,
      payment_account: row,
    };
  }

  /**
   * Verify settlement status completed successfully
   */
  async verifySettlementStatus(reference: string, transaction: Record<string, unknown>): Promise<boolean> {
    // Check if the transaction is successful
    if (transaction.status !== 'SUCCESS') {
      throw new Error(`Transaction ${reference} is not successful, status: ${transaction.status}`);
    }

    // For split settlements, verify settlement status
    if (transaction.settlementStatus !== 'SUCCESS' && transaction.settlementStatus !== 'SETTLED') {
      throw new Error(`Transaction ${reference} settlement not completed, status: ${transaction.settlementStatus}`);
    }

    return true;
  }

  /**
   * Full verification pipeline for a webhook
   */
  async verifyWebhook(params: {
    payload: Record<string, unknown>;
    provider: string;
    school_id: string;
  }): Promise<{ alreadyProcessed?: boolean; reference?: string } & Partial<VerifiedPaymentData>> {
    const { payload, provider, school_id } = params;

    const gateway = this.getGateway(provider);
    if (!gateway) {
      throw new Error(`Unknown payment provider: ${provider}`);
    }

    // Step 1: Extract and validate reference
    const reference = gateway.parseWebhookReference(payload);
    if (!reference) {
      throw new Error('No transaction reference found in webhook payload');
    }

    // Step 2: Check idempotency (already processed?)
    if (await this.isReferenceProcessed(reference)) {
      return { alreadyProcessed: true, reference };
    }

    // Step 3: Verify with gateway API.
    // Legacy note: the original JS destructured `gatewayConfig` here even
    // though verifyWithAPI never returned that key, so it was always
    // undefined. Preserved verbatim.
    const { transaction } = await this.verifyWithAPI(reference, provider, school_id);
    const gatewayConfig: GatewayConfig | undefined = undefined;

    // Step 4: Extract and validate virtual account number
    const virtual_account_number = gateway.parseWebhookDVA(payload);
    if (!virtual_account_number) {
      throw new Error('No virtual account number found in webhook payload');
    }

    // Step 5: Verify student owns the payment account
    const { student, payment_account } = await this.verifyPaymentAccount(virtual_account_number, school_id);

    // Step 6: Verify amount
    const amountPaid = gateway.parseWebhookAmount(payload);
    if (!amountPaid || Number(amountPaid) <= 0) {
      throw new Error(`Invalid amount in transaction: ${amountPaid}`);
    }

    // Step 7: Verify settlement status
    await this.verifySettlementStatus(reference, transaction);

    // Return verified data for ledger entry
    return {
      reference,
      amount: Number(amountPaid),
      student_id: student?.id as string,
      school_id,
      gateway_txn_ref: transaction.transactionReference,
      raw_payload: payload,
      gatewayConfig,
      student,
      payment_account,
      transaction,
    };
  }
}

// Singleton instance for use across the application
export const webhookVerifier = new WebhookVerifier();
