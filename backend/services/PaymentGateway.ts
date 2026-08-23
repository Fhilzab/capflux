/**
 * PaymentGateway - Abstract interface for payment gateway implementations
 *
 * This abstraction allows CAPFLUX to support multiple payment providers
 * (Monnify, Flutterwave, Remita) without changing the billing engine.
 *
 * All providers must support Dedicated Virtual Accounts (DVA) and split settlements.
 * Platform fees are computed from fee_rules table, not hardcoded here.
 *
 * Migration note: no module currently imports this legacy base class (the
 * canonical contract is ./gateways/PaymentGatewayInterface.ts); it is kept
 * and typed for parity with the JavaScript codebase.
 */

export class PaymentGateway {
  /**
   * Get the provider name identifier
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getProviderName(): string {
    throw new Error('getProviderName() must be implemented by subclass');
  }

  /**
   * Create a sub-merchant account for a school
   * Used for split settlement configuration in some providers
   */
  async createSchoolSubAccount(_params: Record<string, unknown>): Promise<Record<string, unknown>> {
    throw new Error('createSchoolSubAccount() must be implemented by subclass');
  }

  /**
   * Create a payment account (DVA) for a student
   */
  async createStudentPaymentAccount(_params: {
    school_id?: string;
    student_id?: string;
    student_name?: string;
    guardian_phone?: string;
    gateway_config?: Record<string, unknown>;
  }): Promise<Record<string, unknown>> {
    throw new Error('createStudentPaymentAccount() must be implemented by subclass');
  }

  /**
   * Deactivate a payment account
   */
  async deactivatePaymentAccount(_params: Record<string, unknown>): Promise<Record<string, unknown>> {
    throw new Error('deactivatePaymentAccount() must be implemented by subclass');
  }

  /**
   * Verify a payment with the gateway API
   * NEVER trust webhook data directly - always verify via API
   */
  async verifyPayment(reference: string, _gateway_config?: Record<string, unknown>): Promise<Record<string, unknown>> {
    void reference;
    throw new Error('verifyPayment() must be implemented by subclass');
  }

  /**
   * Process a webhook payload
   */
  async processWebhook(payload: Record<string, unknown>, _gateway_config?: Record<string, unknown>): Promise<Record<string, unknown>> {
    void payload;
    throw new Error('processWebhook() must be implemented by subclass');
  }

  /**
   * Reconcile pending payments
   * Query the gateway for unprocessed transactions
   */
  async reconcilePayments(_params: Record<string, unknown>): Promise<unknown[]> {
    throw new Error('reconcilePayments() must be implemented by subclass');
  }

  /**
   * Exchange API key for access token (for gateway auth)
   */
  async getAccessToken(_gateway_config?: Record<string, unknown>): Promise<string> {
    throw new Error('getAccessToken() must be implemented by subclass');
  }

  /**
   * Parse webhook payload to extract transaction reference
   */
  parseWebhookReference(payload: Record<string, unknown>): string | null {
    void payload;
    throw new Error('parseWebhookReference() must be implemented by subclass');
  }

  /**
   * Parse webhook payload to extract amount
   */
  parseWebhookAmount(payload: Record<string, unknown>): number | null {
    void payload;
    throw new Error('parseWebhookAmount() must be implemented by subclass');
  }

  /**
   * Parse webhook payload to extract DVA account number
   * Used to identify which student received the payment
   */
  parseWebhookDVA(payload: Record<string, unknown>): string | null {
    void payload;
    throw new Error('parseWebhookDVA() must be implemented by subclass');
  }

  /**
   * Parse webhook payload to extract settlement information
   * NOTE: This now returns raw settlement data from the gateway.
   * Platform fee calculation is done separately via fee_rules table.
   */
  parseSettlementDetails(payload: Record<string, unknown>): Record<string, unknown> {
    void payload;
    throw new Error('parseSettlementDetails() must be implemented by subclass');
  }
}
