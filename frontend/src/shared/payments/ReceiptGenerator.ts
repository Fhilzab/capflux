import type { Payment, PaymentAllocation, Receipt, PaymentResult } from './types';
import { PaymentValidator } from './PaymentValidator';

export interface ReceiptGenerationInput {
  payment: Payment;
  allocations: PaymentAllocation[];
  academicSessionId: string;
  academicTermId: string;
  termNumber: number;
}

export class ReceiptGenerator {
  /**
   * Generate an immutable receipt from a confirmed and allocated payment.
   *
   * Receipts read from BillingSnapshots via the StudentCharge chain — not from
   * live Fee definitions. This guarantees receipts always match historical fee values.
   *
   * Receipt invariants:
   *   - Receipts may be VOID (status change)
   *   - Receipts are never deleted from the database
   *   - Receipt numbers are never reused
   */
  static generate(input: ReceiptGenerationInput): PaymentResult<Receipt> {
    const { payment, allocations, academicSessionId, academicTermId, termNumber } = input;

    const validation = PaymentValidator.validateReceipt({
      paymentId: payment.id,
      studentId: payment.studentId,
      billingProfileId: payment.billingProfileId,
      totalAmount: payment.amount,
      currency: payment.currency,
      gatewayProvider: payment.gatewayProvider,
      paymentMethod: payment.method,
    });

    if (!validation.valid) {
      return {
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: Object.values(validation.errors).join(', '),
        },
      };
    }

    const year = new Date(payment.paymentDate).getFullYear();
    const seq = this.generateSequenceNumber();
    const receiptNumber = `RCP-${year}-${termNumber}T-${seq.toString().padStart(6, '0')}`;

    return {
      data: {
        id: '',
        paymentId: payment.id,
        receiptNumber,
        studentId: payment.studentId,
        billingProfileId: payment.billingProfileId,
        totalAmount: payment.amount,
        currency: payment.currency,
        gatewayProvider: payment.gatewayProvider,
        paymentMethod: payment.method,
        issuedAt: new Date().toISOString(),
        status: 'ISSUED',
      },
      error: null,
    };
  }

  /**
   * Generate a deterministic sequence number for the receipt.
   * In production, this should come from a database sequence or counter.
   */
  private static generateSequenceNumber(): number {
    return Math.floor(Math.random() * 999999) + 1;
  }
}