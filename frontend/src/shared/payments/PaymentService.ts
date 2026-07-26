import { PaymentEngine, type ChargeWithAmount, type AllocationResult, type PaymentLedgerContext } from './PaymentEngine';
import { ReceiptGenerator, type ReceiptGenerationInput } from './ReceiptGenerator';
import type { Payment, PaymentAllocation, Receipt, PaymentResult } from './types';
import { PaymentValidator } from './PaymentValidator';

export class PaymentService {
  /**
   * Confirm a payment after gateway verification.
   * Creates the Payment record with status CONFIRMED.
   */
  async confirmPayment(input: {
    studentId: string;
    billingProfileId: string;
    amount: number;
    currency: string;
    method: 'BANK_TRANSFER' | 'CASH' | 'POS' | 'ONLINE';
    gatewayProvider: 'PAYSTACK' | 'MONNIFY';
    providerReference: string;
    gatewayReference: string;
    gatewayMetadata?: Record<string, unknown>;
    paymentDate: string;
  }): Promise<PaymentResult<Payment>> {
    const validation = PaymentValidator.validatePayment(input);
    if (!validation.valid) {
      return {
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: Object.values(validation.errors).join(', '),
        },
      };
    }

    // In production, this would call the BillingProvider to create the payment record.
    // For now, return the in-memory representation.
    const payment: Payment = {
      id: '',
      studentId: input.studentId,
      billingProfileId: input.billingProfileId,
      amount: input.amount,
      currency: input.currency,
      method: input.method,
      gatewayProvider: input.gatewayProvider,
      providerReference: input.providerReference,
      gatewayReference: input.gatewayReference,
      gatewayMetadata: input.gatewayMetadata,
      paymentDate: input.paymentDate,
      status: 'CONFIRMED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return { data: payment, error: null };
  }

  /**
   * Allocate a confirmed payment to outstanding student charges.
   * Returns allocations and updated charge statuses.
   */
  async allocatePayment(
    payment: Payment,
    charges: ChargeWithAmount[],
    ledgerContext: PaymentLedgerContext,
  ): Promise<PaymentResult<AllocationResult>> {
    if (payment.status !== 'CONFIRMED') {
      return {
        data: null,
        error: {
          code: 'PAYMENT_ALREADY_ALLOCATED',
          message: 'Payment must be in CONFIRMED status to allocate.',
        },
      };
    }

    return PaymentEngine.allocate(payment, charges, ledgerContext);
  }

  /**
   * Generate a receipt after successful allocation.
   */
  async generateReceipt(input: ReceiptGenerationInput): Promise<PaymentResult<Receipt>> {
    return ReceiptGenerator.generate(input);
  }

  /**
   * Full payment processing pipeline:
   *   1. Confirm payment
   *   2. Allocate to charges
   *   3. Lock charges
   *   4. Generate receipt
   *   5. Update payment status to ALLOCATED
   */
  async processPayment(
    confirmInput: {
      studentId: string;
      billingProfileId: string;
      amount: number;
      currency: string;
      method: 'BANK_TRANSFER' | 'CASH' | 'POS' | 'ONLINE';
      gatewayProvider: 'PAYSTACK' | 'MONNIFY';
      providerReference: string;
      gatewayReference: string;
      gatewayMetadata?: Record<string, unknown>;
      paymentDate: string;
    },
    charges: ChargeWithAmount[],
    ledgerContext: PaymentLedgerContext,
    academicSessionId: string,
    academicTermId: string,
    termNumber: number,
  ): Promise<PaymentResult<{
    payment: Payment;
    allocations: PaymentAllocation[];
    receipt: Receipt;
  }>> {
    // Step 1: Confirm
    const confirmResult = await this.confirmPayment(confirmInput);
    if (confirmResult.error || !confirmResult.data) {
      return { data: null, error: confirmResult.error };
    }

    const payment = confirmResult.data;

    // Step 2: Allocate
    const allocateResult = await this.allocatePayment(payment, charges, ledgerContext);
    if (allocateResult.error || !allocateResult.data) {
      return { data: null, error: allocateResult.error };
    }

    const { allocations, updatedCharges } = allocateResult.data;

    // Step 3: Lock charges (in production, call BillingProvider to update)
    // This is where BillingEngine.lockCharge() would be called for each updatedCharge

    // Step 4: Generate receipt
    const receiptResult = await this.generateReceipt({
      payment,
      allocations,
      academicSessionId,
      academicTermId,
      termNumber,
    });

    if (receiptResult.error || !receiptResult.data) {
      return { data: null, error: receiptResult.error };
    }

    const receipt = receiptResult.data;

    // Step 5: Update payment status to ALLOCATED
    payment.status = 'ALLOCATED';
    payment.updatedAt = new Date().toISOString();

    return {
      data: {
        payment,
        allocations,
        receipt,
      },
      error: null,
    };
  }
}

export const paymentService = new PaymentService();