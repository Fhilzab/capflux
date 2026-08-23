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
 * Migration note: kept as an INSTANTIABLE class whose unimplemented methods
 * throw "must be implemented" — tests construct it directly and assert those
 * throws, so an abstract class would change observable behavior.
 */
import type {
  DeactivateAccountResult,
  GatewayConfig,
  ProviderTransaction,
  ReconcileParams,
  SettlementSplitDetail,
  SettlementStatusResult,
  StudentPaymentAccount,
  CanonicalSettlementStatus,
  CanonicalTransactionStatus,
  WebhookPayload,
} from '../../types/gateway.js';

export interface CreateStudentAccountParams {
  student_id: string;
  student_name: string;
  guardian_phone?: string | null;
  gateway_config?: GatewayConfig;
  school_id?: string;
}

export interface DeactivateAccountParams {
  virtual_account_number: string;
  gateway_config?: GatewayConfig;
}

export interface ProcessedWebhook<TTransaction = ProviderTransaction> {
  reference: string;
  amount: number | null;
  transaction: TTransaction;
  success: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export class PaymentGatewayInterface {
  /** Provider identifier (e.g. 'monnify', 'paystack'). Assigned by each adapter constructor. */
  protected providerName!: string;

  /**
   * Provider identifier (e.g. 'monnify', 'paystack').
   */
  getProviderName(): string {
    throw new Error('getProviderName() must be implemented');
  }

  /**
   * Exchange provider credentials for an access token.
   * Credentials come from server environment, never from the database.
   */
  async getAccessToken(_gatewayConfig: GatewayConfig = {}): Promise<string> {
    throw new Error('getAccessToken() must be implemented');
  }

  // ── Dedicated Virtual Account (DVA) ──────────────────────

  /** Provision a DVA / payment account for a student. */
  async createStudentPaymentAccount(_params: CreateStudentAccountParams): Promise<StudentPaymentAccount> {
    throw new Error('createStudentPaymentAccount() must be implemented');
  }

  /** Deactivate a DVA / payment account. */
  async deactivatePaymentAccount(_params: DeactivateAccountParams): Promise<DeactivateAccountResult> {
    throw new Error('deactivatePaymentAccount() must be implemented');
  }

  // ── Transaction Verification ─────────────────────────────

  /**
   * Verify a payment transaction with the provider API.
   * NEVER trusts webhook data — always re-verifies server-side.
   */
  async verifyPayment(reference: string, _gatewayConfig: GatewayConfig = {}): Promise<ProviderTransaction> {
    void reference;
    throw new Error('verifyPayment() must be implemented');
  }

  /** Get full transaction details from the provider. */
  async getTransaction(reference: string, _gatewayConfig: GatewayConfig = {}): Promise<ProviderTransaction> {
    void reference;
    throw new Error('getTransaction() must be implemented');
  }

  /** List transactions in a date range (for reconciliation). */
  async reconcilePayments(_params: ReconcileParams): Promise<ProviderTransaction[]> {
    throw new Error('reconcilePayments() must be implemented');
  }

  // ── Webhook ──────────────────────────────────────────────

  /** Verify webhook signature (HMAC / SHA). Signature comes from an HTTP header. */
  async verifyWebhookSignature(signature: string, rawPayload: string): Promise<boolean> {
    void signature;
    void rawPayload;
    throw new Error('verifyWebhookSignature() must be implemented');
  }

  /** Process a parsed webhook payload into a canonical representation. */
  async processWebhook(payload: WebhookPayload, _gatewayConfig: GatewayConfig = {}): Promise<ProcessedWebhook> {
    void payload;
    throw new Error('processWebhook() must be implemented');
  }

  // ── Parsing helpers (webhook fields → canonical) ─────────

  /** Extract the transaction reference from a webhook payload. */
  parseWebhookReference(payload: WebhookPayload): string | null {
    void payload;
    throw new Error('parseWebhookReference() must be implemented');
  }

  /**
   * Extract a stable provider event ID from a webhook payload.
   * Used for webhook idempotency (unique index on provider_event_id).
   */
  parseWebhookEventId(payload: WebhookPayload): string | null {
    void payload;
    throw new Error('parseWebhookEventId() must be implemented');
  }

  /** Extract the payment amount from a webhook payload. */
  parseWebhookAmount(payload: WebhookPayload): number | null {
    void payload;
    throw new Error('parseWebhookAmount() must be implemented');
  }

  /** Extract the DVA / virtual account number from a webhook payload. */
  parseWebhookDVA(payload: WebhookPayload): string | null {
    void payload;
    throw new Error('parseWebhookDVA() must be implemented');
  }

  /** Parse settlement details from a webhook payload. */
  parseSettlementDetails(payload: WebhookPayload): SettlementSplitDetail[] {
    void payload;
    throw new Error('parseSettlementDetails() must be implemented');
  }

  // ── Status normalization ─────────────────────────────────

  /** Normalize a provider-specific transaction status to canonical form. */
  normalizeTransactionStatus(providerStatus: unknown): CanonicalTransactionStatus {
    void providerStatus;
    throw new Error('normalizeTransactionStatus() must be implemented');
  }

  /** Normalize a provider-specific settlement status to canonical form. */
  normalizeSettlementStatus(providerStatus: unknown): CanonicalSettlementStatus {
    void providerStatus;
    throw new Error('normalizeSettlementStatus() must be implemented');
  }

  // ── Settlement ───────────────────────────────────────────

  /** Check settlement status for a transaction reference. */
  async getSettlementStatus(reference: string, _gatewayConfig: GatewayConfig = {}): Promise<SettlementStatusResult> {
    void reference;
    throw new Error('getSettlementStatus() must be implemented');
  }

  /** List settlements in a date range. */
  async listSettlements(_params: ReconcileParams): Promise<Record<string, unknown>[]> {
    throw new Error('listSettlements() must be implemented');
  }
}
