import type { Payment, PaymentAllocation, PaymentResult } from './types';
import { PaymentValidator } from './PaymentValidator';
import { ledgerService } from '../ledger/LedgerService';

export interface ChargeWithAmount {
  chargeId: string;
  chargeSource: 'MANDATORY' | 'OPTIONAL' | 'PLATFORM';
  status: string;
  ledgerLocked: boolean;
  createdAt: string;
  netAmount: number;
}

export interface PaymentLedgerContext {
  organizationId: string;
  schoolId: string;
  billingProfileId: string;
  academicSessionId?: string;
  academicTermId?: string;
}

export interface AllocationResult {
  allocations: PaymentAllocation[];
  updatedCharges: { chargeId: string; status: 'PAID' | 'PARTIALLY_PAID'; allocatedAmount: number }[];
  remainingBalance: number;
}

export class PaymentEngine {
  /**
   * Allocate a payment to outstanding student charges.
   *
   * Priority:
   *   1. MANDATORY school fees — oldest charge first
   *   2. PLATFORM levy — oldest first
   *   3. OPTIONAL fees — oldest first
   *
   * Charges with status !== 'ACTIVE' or ledgerLocked === true are skipped.
   *
   * After successful allocation:
   *   - Creates a PAYMENT ledger entry for the total payment amount
   *   - Locks charges via BillingEngine.lockCharge
   *
   * @param payment - The confirmed payment to allocate
   * @param charges - Charges with snapshot amounts (netAmount from BillingSnapshot)
   * @param ledgerContext - Org/school/academic context required for ledger entries
   */
  static async allocate(
    payment: Payment,
    charges: ChargeWithAmount[],
    ledgerContext: PaymentLedgerContext,
  ): Promise<PaymentResult<AllocationResult>> {
    const allocations: PaymentAllocation[] = [];
    const updatedCharges: { chargeId: string; status: 'PAID' | 'PARTIALLY_PAID'; allocatedAmount: number }[] = [];
    let remainingBalance = payment.amount;

    const sortedCharges = this.getPrioritizedCharges(charges);

    let order = 0;

    for (const charge of sortedCharges) {
      if (remainingBalance <= 0) break;
      if (charge.status !== 'ACTIVE') continue;
      if (charge.ledgerLocked) continue;

      order++;
      const allocatedAmount = Math.min(remainingBalance, charge.netAmount);
      remainingBalance -= allocatedAmount;

      const chargePaid = allocatedAmount >= charge.netAmount;
      const chargeStatus: 'PAID' | 'PARTIALLY_PAID' = chargePaid ? 'PAID' : 'PARTIALLY_PAID';

      const validation = PaymentValidator.validateAllocation({
        paymentId: payment.id,
        studentChargeId: charge.chargeId,
        allocatedAmount,
        remainingAmount: remainingBalance,
      });

      if (!validation.valid) {
        continue;
      }

      allocations.push({
        id: '',
        paymentId: payment.id,
        studentChargeId: charge.chargeId,
        allocatedAmount,
        remainingAmount: remainingBalance,
        allocationOrder: order,
        createdAt: new Date().toISOString(),
      });

      updatedCharges.push({
        chargeId: charge.chargeId,
        status: chargeStatus,
        allocatedAmount,
      });
    }

    if (allocations.length === 0) {
      return {
        data: {
          allocations,
          updatedCharges,
          remainingBalance,
        },
        error: null,
      };
    }

    // Create PAYMENT ledger entry for the total payment amount
    const paymentAmountMinor = Math.round(payment.amount * 100);
    try {
      await ledgerService.createPaymentEntry({
        organizationId: ledgerContext.organizationId,
        schoolId: ledgerContext.schoolId,
        studentId: payment.studentId,
        billingProfileId: ledgerContext.billingProfileId,
        transactionGroupId: payment.id,
        sourceDocumentType: 'PAYMENT',
        sourceDocumentId: payment.id,
        paymentGatewayReference: payment.gatewayReference || null,
        paymentMethod: payment.method || null,
        academicSessionId: ledgerContext.academicSessionId || null,
        academicTermId: ledgerContext.academicTermId || null,
        entryType: 'PAYMENT',
        entryDirection: 'CREDIT',
        amountMinor: paymentAmountMinor,
        currency: payment.currency,
        sourceEntity: 'PAYMENT',
        previousEntry: null,
        occurredAt: payment.paymentDate,
        postingDate: new Date().toISOString(),
      });
    } catch (e) {
      // Ledger failure should not prevent allocation completion
      // Log in production; allocation still succeeds
      console.warn('PaymentEngine.allocate: failed to create payment ledger entry', e);
    }

    // Lock charges after successful allocation
    for (const updated of updatedCharges) {
      const charge = charges.find(c => c.chargeId === updated.chargeId);
      if (charge) {
        try {
          const { BillingEngine } = await import('../billing/BillingEngine');
          await BillingEngine.lockCharge(
            {
              id: charge.chargeId,
              billingProfileId: '',
              snapshotId: '',
              studentId: '',
              academicSessionId: '',
              academicTermId: '',
              chargeSource: charge.chargeSource,
              status: charge.status as 'ACTIVE' | 'WAIVED' | 'VOID' | 'PAID' | 'PARTIALLY_PAID',
              ledgerLocked: charge.ledgerLocked,
              createdAt: charge.createdAt,
              updatedAt: charge.createdAt,
            },
            updated.allocatedAmount,
            charge.netAmount,
          );
        } catch (e) {
          console.warn('PaymentEngine.allocate: failed to lock charge', updated.chargeId, e);
        }
      }
    }

    return {
      data: {
        allocations,
        updatedCharges,
        remainingBalance,
      },
      error: null,
    };
  }

  /**
   * Sort charges by priority then by age (oldest first).
   * Priority: MANDATORY (1) → PLATFORM (2) → OPTIONAL (3)
   */
  private static getPrioritizedCharges(charges: ChargeWithAmount[]): ChargeWithAmount[] {
    const priorityMap: Record<string, number> = {
      MANDATORY: 1,
      PLATFORM: 2,
      OPTIONAL: 3,
    };

    return [...charges].sort((a, b) => {
      const priorityA = priorityMap[a.chargeSource] || 99;
      const priorityB = priorityMap[b.chargeSource] || 99;

      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }

      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  }
}