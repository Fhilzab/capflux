/**
 * PaymentGatewayInterface — canonical provider contract.
 *
 * Every payment gateway adapter MUST implement this interface.
 * Domain services (DVAService, PaymentService, WebhookVerifier,
 * ReconciliationService) depend ONLY on this contract — never on a
 * specific provider implementation.
 *
 * Capability tiers for each method:
 *   CODE_VERIFIED            — method exists, contract tested, no API call made
 *   SANDBOX_API_VERIFIED     — real sandbox API call succeeded
 *   PRODUCTION_API_UNVERIFIED — production credentials absent
 *   PRODUCTION_READY         — production credentials + explicit activation
 *   SANDBOX_CAPABILITY_UNAVAILABLE — sandbox API doesn't support this operation
 *
 * @interface
 */
export class PaymentGatewayInterface {
  /**
   * Provider identifier (e.g. 'monnify', 'paystack').
   * @returns {string}
   */
  getProviderName() {
    throw new Error('getProviderName() must be implemented');
  }

  /**
   * Exchange provider credentials for an access token.
   * Credentials come from server environment, never from the database.
   * @param {Object} [gatewayConfig] — legacy fallback (empty in canonical path)
   * @returns {Promise<string>} access token
   */
  async getAccessToken(gatewayConfig = {}) {
    throw new Error('getAccessToken() must be implemented');
  }

  // ── Dedicated Virtual Account (DVA) ──────────────────────

  /**
   * Provision a DVA / payment account for a student.
   * @param {Object} params
   * @param {string} params.student_id
   * @param {string} params.student_name
   * @param {string} [params.guardian_phone]
   * @param {Object} [params.gateway_config]
   * @param {string} [params.school_id]
   * @returns {Promise<{provider, provider_account_id, provider_reference, virtual_account_number, account_name, bank_name, account_status}>}
   */
  async createStudentPaymentAccount(params) { // eslint-disable-line no-unused-vars
    throw new Error('createStudentPaymentAccount() must be implemented');
  }

  /**
   * Deactivate a DVA / payment account.
   * @returns {Promise<{provider, virtual_account_number, account_status, deactivated}>}
   */
  async deactivatePaymentAccount(params) { // eslint-disable-line no-unused-vars
    throw new Error('deactivatePaymentAccount() must be implemented');
  }

  // ── Transaction Verification ─────────────────────────────

  /**
   * Verify a payment transaction with the provider API.
   * NEVER trusts webhook data — always re-verifies server-side.
   * @param {string} reference
   * @param {Object} [gatewayConfig]
   * @returns {Promise<Object>} provider transaction object
   */
  async verifyPayment(reference, gatewayConfig = {}) { // eslint-disable-line no-unused-vars
    throw new Error('verifyPayment() must be implemented');
  }

  /**
   * Get full transaction details from the provider.
   * @param {string} reference
   * @param {Object} [gatewayConfig]
   * @returns {Promise<Object>} provider transaction object
   */
  async getTransaction(reference, gatewayConfig = {}) { // eslint-disable-line no-unused-vars
    throw new Error('getTransaction() must be implemented');
  }

  /**
   * List transactions in a date range (for reconciliation).
   * @param {Object} params
   * @param {Object} [params.gateway_config]
   * @param {string} [params.start_date]
   * @param {string} [params.end_date]
   * @returns {Promise<Array>} provider transactions
   */
  async reconcilePayments(params) { // eslint-disable-line no-unused-vars
    throw new Error('reconcilePayments() must be implemented');
  }

  // ── Webhook ──────────────────────────────────────────────

  /**
   * Verify webhook signature (HMAC / SHA).
   * @param {string} signature — from HTTP header
   * @param {string} rawPayload — raw request body as string
   * @returns {Promise<boolean>}
   */
  async verifyWebhookSignature(signature, rawPayload) { // eslint-disable-line no-unused-vars
    throw new Error('verifyWebhookSignature() must be implemented');
  }

  /**
   * Process a parsed webhook payload into a canonical representation.
   * @param {Object} payload
   * @param {Object} [gatewayConfig]
   * @returns {Promise<{reference, amount, transaction, success}>}
   */
  async processWebhook(payload, gatewayConfig = {}) { // eslint-disable-line no-unused-vars
    throw new Error('processWebhook() must be implemented');
  }

  // ── Parsing helpers (webhook fields → canonical) ─────────

  /**
   * Extract the transaction reference from a webhook payload.
   * @param {Object} payload
   * @returns {string|null}
   */
  parseWebhookReference(payload) { // eslint-disable-line no-unused-vars
    throw new Error('parseWebhookReference() must be implemented');
  }

  /**
   * Extract a stable provider event ID from a webhook payload.
   * Used for webhook idempotency (unique index on provider_event_id).
   * @param {Object} payload
   * @returns {string|null}
   */
  parseWebhookEventId(payload) { // eslint-disable-line no-unused-vars
    throw new Error('parseWebhookEventId() must be implemented');
  }

  /**
   * Extract the payment amount from a webhook payload.
   * @param {Object} payload
   * @returns {number|null}
   */
  parseWebhookAmount(payload) { // eslint-disable-line no-unused-vars
    throw new Error('parseWebhookAmount() must be implemented');
  }

  /**
   * Extract the DVA / virtual account number from a webhook payload.
   * Used to identify which student received the payment.
   * @param {Object} payload
   * @returns {string|null}
   */
  parseWebhookDVA(payload) { // eslint-disable-line no-unused-vars
    throw new Error('parseWebhookDVA() must be implemented');
  }

  /**
   * Parse settlement details from a webhook payload.
   * @param {Object} payload
   * @returns {Array<{destination, account_number, amount, status}>}
   */
  parseSettlementDetails(payload) { // eslint-disable-line no-unused-vars
    throw new Error('parseSettlementDetails() must be implemented');
  }

  // ── Status normalization ─────────────────────────────────

  /**
   * Normalize a provider-specific transaction status to canonical form.
   * @param {string|Object} providerStatus
   * @returns {string} 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED' | 'REVERSED' | 'UNKNOWN'
   */
  normalizeTransactionStatus(providerStatus) { // eslint-disable-line no-unused-vars
    throw new Error('normalizeTransactionStatus() must be implemented');
  }

  /**
   * Normalize a provider-specific settlement status to canonical form.
   * @param {string|Object} providerStatus
   * @returns {string} 'PENDING' | 'SUCCESS' | 'FAILED' | 'UNKNOWN'
   */
  normalizeSettlementStatus(providerStatus) { // eslint-disable-line no-unused-vars
    throw new Error('normalizeSettlementStatus() must be implemented');
  }

  // ── Settlement ───────────────────────────────────────────

  /**
   * Check settlement status for a transaction reference.
   * @param {string} reference
   * @param {Object} [gatewayConfig]
   * @returns {Promise<Object>}
   */
  async getSettlementStatus(reference, gatewayConfig = {}) { // eslint-disable-line no-unused-vars
    throw new Error('getSettlementStatus() must be implemented');
  }

  /**
   * List settlements in a date range.
   * @param {Object} params
   * @returns {Promise<Array>}
   */
  async listSettlements(params) { // eslint-disable-line no-unused-vars
    throw new Error('listSettlements() must be implemented');
  }
}
