import type { Payment, PaymentAllocation, PaymentResult } from './types';
import { PaymentValidator } from './PaymentValidator';
import { accountingService } from '../accounting/AccountingService';

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
   *   - Creates a PAYMENT ledger entry for the total payment amount (idempotent)
   *   - Locks charges via BillingEngine.lockCharge
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

    // Create accounting journal for this payment
    const paymentAmountMinor = Math.round(payment.amount * 100);
    const journalResult = await accountingService.createPaymentJournal({
      organizationId: ledgerContext.organizationId,
      schoolId: ledgerContext.schoolId,
      transactionGroupId: payment.id,
      sourceDocumentType: 'PAYMENT',
      sourceDocumentId: payment.id,
      description: `Payment from ${payment.studentId}`,
      amountMinor: paymentAmountMinor,
      currency: payment.currency,
      occurredAt: payment.paymentDate,
    });

    if (journalResult.error) {
      return {
        data: null,
        error: {
          code: 'UNKNOWN',
          message: journalResult.error.message,
        },
      };
    }

    if (journalResult.data) {
      const { JournalPoster } = await import('../accounting/JournalPoster');
      const postResult = await JournalPoster.postJournal(journalResult.data, null);

      if (postResult.error) {
        return {
          data: null,
          error: {
            code: 'UNKNOWN',
            message: postResult.error.message,
          },
        };
      }
    }

    // Lock charges after successful allocation
    for (const updated of updatedCharges) {
      const charge = charges.find(c => c.chargeId === updated.chargeId);
      if (charge) {
        try {
          const { BillingEngine } = await import('../billing/BillingEngine');
          const lockResult = await BillingEngine.lockCharge(
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

          if (lockResult.error) {
            return {
              data: null,
              error: {
                code: 'ALLOCATION_FAILED',
                message: lockResult.error.message,
                raw: lockResult.error,
              },
            };
          }
        } catch (e) {
          return {
            data: null,
            error: {
              code: 'UNKNOWN',
              message: e instanceof Error ? e.message : 'Failed to lock charge',
            },
          };
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