/**
 * PaymentGateway - Abstract interface for payment gateway implementations
 * 
 * This abstraction allows Capstone to support multiple payment providers
 * (Monnify, Flutterwave, Remita) without changing the billing engine.
 * 
 * All providers must support Dedicated Virtual Accounts (DVA) and split settlements.
 * Platform fees are computed from fee_rules table, not hardcoded here.
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
   * Create a sub-merchant account for a school
   * Used for split settlement configuration in some providers
   * @param {Object} params
   * @returns {Promise<Object>} Sub-merchant details
   */
  async createSchoolSubAccount(params) {
    throw new Error('createSchoolSubAccount() must be implemented by subclass');
  }

  /**
   * Create a payment account (DVA) for a student
   * @param {Object} params
   * @param {string} params.school_id - School UUID
   * @param {string} params.student_id - Student UUID
   * @param {string} params.student_name - Full student name
   * @param {string} params.guardian_phone - Parent/guardian phone number
   * @param {Object} params.gateway_config - School's gateway configuration
   * @returns {Promise<Object>} Payment account details
   */
  async createStudentPaymentAccount(params) {
    throw new Error('createStudentPaymentAccount() must be implemented by subclass');
  }

  /**
   * Deactivate a payment account
   * @param {Object} params
   * @returns {Promise<Object>} Deactivation result
   */
  async deactivatePaymentAccount(params) {
    throw new Error('deactivatePaymentAccount() must be implemented by subclass');
  }

  /**
   * Verify a payment with the gateway API
   * NEVER trust webhook data directly - always verify via API
   * @param {string} reference - Transaction reference to verify
   * @param {Object} gateway_config - School's gateway configuration
   * @returns {Promise<Object>} Verified transaction details
   */
  async verifyPayment(reference, gateway_config) {
    throw new Error('verifyPayment() must be implemented by subclass');
  }

  /**
   * Process a webhook payload
   * @param {Object} payload - Raw webhook payload
   * @param {Object} gateway_config - School's gateway configuration
   * @returns {Promise<Object>} Processing result
   */
  async processWebhook(payload, gateway_config) {
    throw new Error('processWebhook() must be implemented by subclass');
  }

  /**
   * Reconcile pending payments
   * Query the gateway for unprocessed transactions
   * @param {Object} params
   * @returns {Promise<Array>} List of reconciled payments
   */
  async reconcilePayments(params) {
    throw new Error('reconcilePayments() must be implemented by subclass');
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
   * Parse webhook payload to extract settlement information
   * NOTE: This now returns raw settlement data from the gateway.
   * Platform fee calculation is done separately via fee_rules table.
   * @param {Object} payload - Raw webhook payload
   * @returns {Object} Settlement details with destinations
   */
  parseSettlementDetails(payload) {
    throw new Error('parseSettlementDetails() must be implemented by subclass');
  }
}