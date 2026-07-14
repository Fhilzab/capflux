/**
 * WebhookVerifier - Secure webhook validation service
 * 
 * CRITICAL: Payment webhooks are NEVER trusted directly.
 * Every webhook triggers a full API verification before processing.
 */

import { supabase } from '../supabaseClient.js';
import { MonnifyGateway } from './gateways/MonnifyGateway.js';
import crypto from 'crypto';

export class WebhookVerifier {
  constructor() {
    this.providers = {
      monnify: new MonnifyGateway(),
    };
  }

  /**
   * Verify webhook signature (HMAC) to ensure it's from the gateway
   * @param {string} signature - Signature from webhook header
   * @param {string} payload - Raw request body
   * @param {string} provider - Provider name
   * @returns {boolean}
   */
  verifySignature(signature, payload, provider) {
    const secret = process.env[`${provider.toUpperCase()}_WEBHOOK_SECRET`];
    if (!secret) {
      console.warn(`No webhook secret configured for ${provider}`);
      return true; // Allow in dev mode
    }

    const expectedSignature = crypto
      .createHmac('sha512', secret)
      .update(payload)
      .digest('hex');

    return signature === expectedSignature;
  }

  /**
   * Verify webhook payload with the payment gateway API
   * @param {string} reference - Transaction reference
   * @param {string} provider - Provider name
   * @param {string} school_id - School UUID
   * @returns {Promise<Object>} Verified transaction
   */
  async verifyWithAPI(reference, provider, school_id) {
    const gateway = this.providers[provider];
    if (!gateway) {
      throw new Error(`Unknown payment provider: ${provider}`);
    }

    // Get gateway config for this school
    const { data: gatewayConfig, error } = await supabase
      .from('payment_gateway_config')
      .select('*')
      .eq('school_id', school_id)
      .eq('provider', provider)
      .eq('is_active', true)
      .single();

    if (error || !gatewayConfig) {
      throw new Error(`No active gateway config found for school ${school_id}`);
    }

    // Verify transaction with gateway API - NEVER trust webhook body
    const transaction = await gateway.getTransaction(reference, gatewayConfig);
    
    if (!transaction) {
      throw new Error(`Transaction ${reference} not found on gateway`);
    }

    return {
      transaction,
      gatewayConfig,
      gateway,
    };
  }

  /**
   * Check if transaction reference has already been processed (idempotency)
   * @param {string} reference - Transaction reference
   * @returns {Promise<boolean>} True if already processed
   */
  async isReferenceProcessed(reference) {
    const { data, error } = await supabase
      .from('payment_transactions')
      .select('id')
      .eq('reference', reference)
      .single();

    return !error && data !== null;
  }

  /**
   * Verify student owns the payment account that received the payment
   * @param {string} virtual_account_number - Payment account virtual account number
   * @param {string} school_id - School UUID
   * @returns {Promise<Object>} Payment account info with student
   */
  async verifyPaymentAccount(virtual_account_number, school_id) {
    const { data: paymentAccount, error } = await supabase
      .from('payment_accounts')
      .select('*, students!inner(id, school_id, first_name, last_name)')
      .eq('virtual_account_number', virtual_account_number)
      .eq('school_id', school_id)
      .eq('account_status', 'ACTIVE')
      .single();

    if (error || !paymentAccount) {
      throw new Error(`No active payment account found for ${virtual_account_number}`);
    }

    return {
      student: paymentAccount.students,
      payment_account: paymentAccount,
    };
  }

  /**
   * Verify settlement status completed successfully
   * @param {string} reference - Transaction reference
   * @param {Object} transaction - Transaction from gateway API
   * @returns {Promise<boolean>}
   */
  async verifySettlementStatus(reference, transaction) {
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
   * @param {Object} params
   * @param {string} params.payload - Raw webhook body
   * @param {string} params.provider - Provider name
   * @param {string} params.school_id - School UUID
   * @returns {Promise<Object>} Verified payment data
   */
  async verifyWebhook(params) {
    const { payload, provider, school_id } = params;
    
    const gateway = this.providers[provider];
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

    // Step 3: Verify with gateway API
    const { transaction, gatewayConfig } = await this.verifyWithAPI(reference, provider, school_id);

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
      student_id: student.id,
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