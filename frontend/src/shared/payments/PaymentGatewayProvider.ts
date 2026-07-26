import type { PaymentResult, GatewayProvider } from './types';

/**
 * Payment Gateway Provider Interface
 * Abstract contract for payment gateway integrations.
 * Capflux never talks directly to Paystack, Monnify, or any provider.
 * Implementations live in providers/payment-gateways/
 */
export abstract class PaymentGatewayProvider {
  /**
   * Verify a payment with the gateway using its reference.
   * Called from webhook/notification processing.
   */
  abstract verifyPayment(providerReference: string): Promise<PaymentResult<{
    verified: boolean;
    amount: number;
    currency: string;
    gatewayReference: string;
    payerName?: string;
    payerBank?: string;
    paymentDate: string;
    metadata?: Record<string, unknown>;
  }>>;

  /**
   * Generate a Dedicated Virtual Account for a student.
   */
  abstract generateVirtualAccount(data: {
    schoolId: string;
    studentId: string;
    studentName: string;
    email: string;
  }): Promise<PaymentResult<{
    accountNumber: string;
    accountName: string;
    bankName: string;
    providerCustomerId: string;
  }>>;

  /**
   * Get the active virtual account for a student.
   */
  abstract getVirtualAccount(studentId: string): Promise<PaymentResult<{
    accountNumber: string;
    accountName: string;
    bankName: string;
    providerCustomerId: string;
    status: string;
  } | null>>;

  /**
   * Validate and normalize an incoming webhook payload.
   * Returns the provider reference if valid.
   */
  abstract validateWebhook(payload: unknown): Promise<PaymentResult<{
    providerReference: string;
    event: string;
    status: string;
  }>>;

  // DVA lifecycle stubs (reserved for future)
  abstract suspendAccount?(studentId: string): Promise<PaymentResult<void>>;
  abstract reactivateAccount?(studentId: string): Promise<PaymentResult<void>>;
  abstract regenerateAccount?(studentId: string): Promise<PaymentResult<void>>;
  abstract syncAccountStatus?(studentId: string): Promise<PaymentResult<void>>;

  abstract isConfigured(): boolean;
}