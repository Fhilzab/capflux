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
   * Exchange API key/secret for access token
   */
  async getAccessToken(gateway_config) {
    const authString = `${gateway_config.api_key}:${gateway_config.secret_key}`;
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
   * Create a Dedicated Virtual Account for a student
   * Uses sub-merchant account for split settlement configuration
   */
  async createDVA(params) {
    const { student_id, student_name, guardian_phone, gateway_config, school_id } = params;
    
    const accessToken = await this.getAccessToken(gateway_config);

    // Build split settlement configuration
    // Tuition goes to school, Tech Levy + Platform Fee goes to Capstone
    const splitConfig = {
      splitAmount: [
        {
          subAccountCode: gateway_config.submerchant_code,
          splitPercentage: '100.00', // Student's school gets 100% of their DVA
        },
      ],
    };

    const requestBody = {
      accountReference: student_id,
      accountName: `${student_name} - Capstone School`,
      currencyCode: 'NGN',
      // Monnify uses sub-account for settlement routing
      // The actual split happens at transaction level in webhook
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
        dva_account_number: account.accountNumber,
        dva_bank_name: account.bankName,
        dva_account_name: account.accountName,
        provider: this.providerName,
        provider_ref: account.accountReference,
      };
    }
    throw new Error('Failed to create Monnify DVA');
  }

  /**
   * Verify a transaction with Monnify API
   * NEVER trust webhook data directly
   */
  async verifyTransaction(reference, gateway_config) {
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
    return null;
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
      dva_account_number: transaction.destinationAccountDetails?.accountNumber,
      split_settlement_details: transaction.splitSettlementDetails || [],
    };
  }

  /**
   * Parse webhook payload for transaction reference
   */
  parseWebhookReference(payload) {
    return payload?.transactionReference || payload?.reference || null;
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
        destination: 'capstone',
        account_number: process.env.CAPSTONE_SETTLEMENT_ACCOUNT,
        bank_name: process.env.CAPSTONE_SETTLEMENT_BANK,
        amount: techLevy,
        category: 'TECH_LEVY',
        status: 'SUCCESS',
      });
    }

    if (platformFee > 0) {
      settlements.push({
        destination: 'capstone',
        account_number: process.env.CAPSTONE_SETTLEMENT_ACCOUNT,
        bank_name: process.env.CAPSTONE_SETTLEMENT_BANK,
        amount: platformFee,
        category: 'PLATFORM_FEE',
        status: 'SUCCESS',
      });
    }

    return settlements;
  }
}