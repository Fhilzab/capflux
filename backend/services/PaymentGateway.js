/**
 * PaymentGateway - Abstract interface for payment gateway implementations
 * 
 * This abstraction allows Capstone to support multiple payment providers
 * (Monnify, Flutterwave, Remita) without changing the billing engine.
 * 
 * All providers must support Dedicated Virtual Accounts (DVA) and split settlements.
 */

export class PaymentGateway {
  /**
   * Get the provider name identifier
   * @returns {string} 'monnify', 'flutterwave', or 'remita'
   */
  getProviderName() {
    throw new Error('getProviderName() must be implemented by subclass');
  }

  /**
   * Create a Dedicated Virtual Account (DVA) for a student
   * @param {Object} params
   * @param {string} params.school_id - School UUID
   * @param {string} params.student_id - Student UUID
   * @param {string} params.student_name - Full student name
   * @param {string} params.guardian_phone - Parent/guardian phone number
   * @param {Object} params.gateway_config - School's gateway configuration
   * @returns {Promise<Object>} DVA details with account number, bank, account name
   */
  async createDVA(params) {
    throw new Error('createDVA() must be implemented by subclass');
  }

  /**
   * Verify a transaction reference with the gateway API
   * NEVER trust webhook data directly - always verify via API
   * @param {string} reference - Transaction reference to verify
   * @param {Object} gateway_config - School's gateway configuration
   * @returns {Promise<Object>} Verified transaction details
   */
  async verifyTransaction(reference, gateway_config) {
    throw new Error('verifyTransaction() must be implemented by subclass');
  }

  /**
   * Get transaction details from the gateway
   * @param {string} reference - Transaction reference
   * @param {Object} gateway_config - School's gateway configuration
   * @returns {Promise<Object>} Full transaction details
   */
  async getTransaction(reference, gateway_config) {
    throw new Error('getTransaction() must be implemented by subclass');
  }

  /**
   * Verify the settlement status (split settlement completed)
   * @param {string} reference - Transaction reference
   * @param {Object} gateway_config - School's gateway configuration
   * @returns {Promise<Object>} Settlement status with destination details
   */
  async getSettlementStatus(reference, gateway_config) {
    throw new Error('getSettlementStatus() must be implemented by subclass');
  }

  /**
   * Exchange API key for access token (for gateway auth)
   * @param {Object} gateway_config - School's gateway configuration
   * @returns {Promise<string>} Access token
   */
  async getAccessToken(gateway_config) {
    throw new Error('getAccessToken() must be implemented by subclass');
  }

  /**
   * Parse webhook payload to extract transaction reference
   * @param {Object} payload - Raw webhook payload
   * @returns {string|null} Transaction reference
   */
  parseWebhookReference(payload) {
    throw new Error('parseWebhookReference() must be implemented by subclass');
  }

  /**
   * Parse webhook payload to extract amount
   * @param {Object} payload - Raw webhook payload
   * @returns {number|null} Transaction amount
   */
  parseWebhookAmount(payload) {
    throw new Error('parseWebhookAmount() must be implemented by subclass');
  }

  /**
   * Parse webhook payload to extract DVA account number
   * Used to identify which student received the payment
   * @param {Object} payload - Raw webhook payload
   * @returns {string|null} DVA account number
   */
  parseWebhookDVA(payload) {
    throw new Error('parseWebhookDVA() must be implemented by subclass');
  }

  /**
   * Parse settlement information from webhook
   * @param {Object} payload - Raw webhook payload
   * @returns {Object} Settlement details with destinations
   */
  parseSettlementDetails(payload) {
    throw new Error('parseSettlementDetails() must be implemented by subclass');
  }
}