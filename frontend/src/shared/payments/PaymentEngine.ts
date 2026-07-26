import type { Payment, PaymentAllocation, PaymentResult } from './types';
import { PaymentValidator } from './PaymentValidator';

/**
 * A charge with its snapshot amount for allocation.
 * netAmount comes from BillingSnapshot — not from live Fee definitions.
 * This guarantees allocations always match historical fee values.
 */
export interface ChargeWithAmount {
  chargeId: string;
  chargeSource: 'MANDATORY' | 'OPTIONAL' | 'PLATFORM';
  status: string;
  ledgerLocked: boolean;
  createdAt: string;
  netAmount: number;
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
   * @param payment - The confirmed payment to allocate
   * @param charges - Charges with snapshot amounts (netAmount from BillingSnapshot)
   */
  static allocate(payment: Payment, charges: ChargeWithAmount[]): PaymentResult<AllocationResult> {
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