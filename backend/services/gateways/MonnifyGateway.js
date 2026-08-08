/**
 * MonnifyGateway - Monnify payment provider implementation
 * 
 * Implements the PaymentGateway interface for Monnify's API.
 * Supports Dedicated Virtual Accounts (DVA) and split settlements.
 */

import axios from 'axios';
import crypto from 'crypto';

const MONNIFY_BASE_URL = process.env.MONNIFY_BASE_URL || 'https://api.monnify.com/api/v1';
const MONNIFY_TEST_MODE = process.env.MONNIFY_TEST_MODE === 'true';

export class MonnifyGateway {
  constructor() {
    this.providerName = 'monnify';
  }

  getProviderName() {
    return this.providerName;
  }

  /**
   * Exchange API key/secret for access token.
   *
   * Canonical credential model: gateway credentials are CAPFLUX infrastructure
   * secrets. They come from the server environment (MONNIFY_API_KEY /
   * MONNIFY_SECRET_KEY) — never from per-school database rows. Legacy rows
   * may carry api_key/secret_key; they are used only as a migration fallback.
   */
  async getAccessToken(gateway_config) {
    const apiKey = process.env.MONNIFY_API_KEY || gateway_config?.api_key;
    const secretKey = process.env.MONNIFY_SECRET_KEY || gateway_config?.secret_key;

    if (!apiKey || !secretKey) {
      throw new Error('Monnify credentials are not configured (MONNIFY_API_KEY / MONNIFY_SECRET_KEY)');
    }

    const authString = `${apiKey}:${secretKey}`;
    const encodedAuth = Buffer.from(authString).toString('base64');

    const response = await axios.post(
      `${MONNIFY_BASE_URL}/auth/login`,
      {},
      {
        headers: {
          'Authorization': `Basic ${encodedAuth}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.data && response.data.requestSuccessful && response.data.responseBody) {
      return response.data.responseBody.accessToken;
    }
    throw new Error('Failed to obtain Monnify access token');
  }

  /**
   * Create a sub-merchant account for a school
   * Used for split settlement configuration
   */
  async createSchoolSubAccount(params) {
    const { school_id, school_name, gateway_config } = params;
    
    const accessToken = await this.getAccessToken(gateway_config);

    const requestBody = {
      businessName: school_name || `School ${school_id}`,
      businessShortName: school_name?.substring(0, 10) || school_id.substring(0, 10),
      accountReference: `sub-${school_id}`,
    };

    const response = await axios.post(
      `${MONNIFY_BASE_URL}/v1/merchant/api/v2/sub-accounts`,
      requestBody,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.data && response.data.requestSuccessful) {
      const subAccount = response.data.responseBody;
      return {
        subaccount_id: subAccount.subAccountCode,
        account_reference: subAccount.accountReference,
        status: 'ACTIVE',
      };
    }
    throw new Error('Failed to create Monnify sub-account');
  }

  /**
   * Create a Dedicated Virtual Account for a student
   * Uses sub-merchant account for split settlement configuration
   */
  async createStudentPaymentAccount(params) {
    const { student_id, student_name, guardian_phone, gateway_config, school_id } = params;
    
    const accessToken = await this.getAccessToken(gateway_config);

    // Build split settlement configuration
    // Tuition goes to school, Tech Levy + Platform Fee goes to CAPFLUX
    const splitConfig = gateway_config.submerchant_code ? {
      splitAmount: [
        {
          subAccountCode: gateway_config.submerchant_code,
          splitPercentage: '100.00', // Student's school gets 100% of their DVA
        },
      ],
    } : {};

    const requestBody = {
      accountReference: `${school_id}-${student_id}`.substring(0, 50),
      accountName: `${student_name} - CAPFLUX School`,
      currencyCode: 'NGN',
      ...splitConfig,
    };

    const response = await axios.post(
      `${MONNIFY_BASE_URL}/v1/merchant/api/v2/accounts`,
      requestBody,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.data && response.data.requestSuccessful && response.data.responseBody) {
      const account = response.data.responseBody;
      return {
        provider: this.providerName,
        provider_account_id: account.accountNumber,
        provider_reference: account.accountReference,
        virtual_account_number: account.accountNumber,
        account_name: account.accountName,
        bank_name: account.bankName,
        account_status: 'ACTIVE',
      };
    }
    throw new Error('Failed to create Monnify payment account');
  }

  /**
   * Deactivate a payment account
   */
  async deactivatePaymentAccount(params) {
    const { virtual_account_number, gateway_config } = params;
    
    const accessToken = await this.getAccessToken(gateway_config);

    const response = await axios.post(
      `${MONNIFY_BASE_URL}/v1/merchant/api/v2/accounts/deallocate`,
      { accountReference: virtual_account_number },
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.data && response.data.requestSuccessful) {
      return {
        provider: this.providerName,
        virtual_account_number,
        account_status: 'INACTIVE',
        deactivated: true,
      };
    }
    throw new Error('Failed to deactivate Monnify payment account');
  }

  /**
   * Verify a transaction with Monnify API
   * NEVER trust webhook data directly
   */
  async verifyPayment(reference, gateway_config) {
    const transaction = await this.getTransaction(reference, gateway_config);
    return transaction;
  }

  /**
   * Get full transaction details
   */
  async getTransaction(reference, gateway_config) {
    const accessToken = await this.getAccessToken(gateway_config);

    const response = await axios.get(
      `${MONNIFY_BASE_URL}/v1/merchant/api/v2/transactions/${reference}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (response.data && response.data.requestSuccessful) {
      return response.data.responseBody;
    }
    throw new Error(`Transaction ${reference} not found`);
  }

  /**
   * Verify settlement status - check if split settlement completed
   */
  async getSettlementStatus(reference, gateway_config) {
    const transaction = await this.getTransaction(reference, gateway_config);
    
    return {
      status: transaction.status, // SUCCESS, PENDING, FAILED
      settlement_status: transaction.settlementStatus,
      paid_amount: transaction.paidAmount,
      transaction_amount: transaction.amount,
      virtual_account_number: transaction.destinationAccountDetails?.accountNumber,
      split_settlement_details: transaction.splitSettlementDetails || [],
    };
  }

  /**
   * Process webhook payload
   */
  async processWebhook(payload, gateway_config) {
    const reference = this.parseWebhookReference(payload);
    if (!reference) {
      throw new Error('No transaction reference found in webhook payload');
    }

    // Verify the transaction with the API
    const transaction = await this.getTransaction(reference, gateway_config);
    
    if (!transaction) {
      throw new Error(`Transaction ${reference} not found`);
    }

    return {
      reference,
      amount: this.parseWebhookAmount(payload),
      transaction,
      success: true,
    };
  }

  /**
   * Reconcile pending payments - find transactions not yet recorded
   */
  async reconcilePayments(params) {
    const { gateway_config, start_date, end_date } = params;
    const accessToken = await this.getAccessToken(gateway_config);

    const response = await axios.get(
      `${MONNIFY_BASE_URL}/v1/merchant/api/v2/transactions`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
        params: {
          startDate: start_date,
          endDate: end_date,
        },
      }
    );

    if (response.data && response.data.requestSuccessful) {
      const transactions = response.data.responseBody || [];
      // Filter for successful but not yet reconciled transactions
      return transactions.filter(txn => txn.status === 'SUCCESS');
    }
    return [];
  }

  /**
   * Parse webhook payload for transaction reference
   */
  parseWebhookReference(payload) {
    return payload?.transactionReference || payload?.reference || null;
  }

  /**
   * Parse webhook payload for a stable provider event id (webhook idempotency).
   */
  parseWebhookEventId(payload) {
    return payload?.eventId || payload?.paymentReference || payload?.transactionReference || null;
  }

  /**
   * Parse webhook payload for amount
   */
  parseWebhookAmount(payload) {
    return payload?.amountPaid || payload?.amount || null;
  }

  /**
   * Parse webhook payload for DVA account number
   */
  parseWebhookDVA(payload) {
    return payload?.destinationAccountDetails?.accountNumber || 
           payload?.accountNumber || 
           null;
  }

  /**
   * Parse settlement details from webhook
   */
  parseSettlementDetails(payload) {
    const settlements = [];
    const splitDetails = payload.splitSettlementDetails || [];
    
    for (const split of splitDetails) {
      settlements.push({
        destination: 'school', // All splits go to school in Monnify's configuration
        account_number: split.subAccountCode,
        amount: split.amount,
        status: split.settlementStatus,
      });
    }

    // Also extract the tech levy and platform fee portions
    // These are computed differently based on your business logic
    const techLevy = payload.techLevyAmount || 0;
    const platformFee = payload.platformFeeAmount || 0;

    if (techLevy > 0) {
      settlements.push({
        destination: 'capflux',
        account_number: process.env.CAPFLUX_SETTLEMENT_ACCOUNT,
        bank_name: process.env.CAPFLUX_SETTLEMENT_BANK,
        amount: techLevy,
        category: 'TECH_LEVY',
        status: 'SUCCESS',
      });
    }

    if (platformFee > 0) {
      settlements.push({
        destination: 'capflux',
        account_number: process.env.CAPFLUX_SETTLEMENT_ACCOUNT,
        bank_name: process.env.CAPFLUX_SETTLEMENT_BANK,
        amount: platformFee,
        category: 'PLATFORM_FEE',
        status: 'SUCCESS',
      });
    }

    return settlements;
  }

  /**
   * Normalize Monnify transaction status to canonical form.
   */
  normalizeTransactionStatus(status) {
    const map = {
      PENDING: 'PENDING', SUCCESS: 'SUCCESS', FAILED: 'FAILED',
      REVERSED: 'REVERSED', EXPIRED: 'FAILED',
    };
    return map[status] || 'UNKNOWN';
  }

  /**
   * Normalize Monnify settlement status to canonical form.
   */
  normalizeSettlementStatus(status) {
    const map = {
      PENDING: 'PENDING', SETTLED: 'SUCCESS', SUCCESS: 'SUCCESS',
      FAILED: 'FAILED', REJECTED: 'FAILED',
    };
    return map[status] || 'UNKNOWN';
  }

  /**
   * Verify webhook signature (HMAC SHA-512).
   * @param {string} signature — from x-monnify-signature header
   * @param {string} rawPayload — raw body string
   * @returns {boolean}
   */
  verifyWebhookSignature(signature, rawPayload) {
    const secret = process.env.MONNIFY_WEBHOOK_SECRET;
    if (!secret) {
      if (process.env.NODE_ENV === 'production') return false;
      console.warn('[monnify] No webhook secret configured — signature verification disabled in dev');
      return process.env.NODE_ENV !== 'production';
    }
    try {
      const expected = crypto.createHmac('sha512', secret).update(rawPayload).digest('hex');
      return signature === expected;
    } catch {
      return false;
    }
  }

  /**
   * List settlements in a date range.
   */
  async listSettlements({ start_date, end_date, gateway_config }) {
    const accessToken = await this.getAccessToken(gateway_config);
    const response = await axios.get(`${MONNIFY_BASE_URL}/v1/merchant/api/v2/transactions`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: { startDate: start_date, endDate: end_date },
    });
    if (response.data?.requestSuccessful) {
      return (response.data.responseBody || []).filter((t) => t.status === 'SUCCESS');
    }
    return [];
  }
}