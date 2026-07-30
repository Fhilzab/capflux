import { FeeRuleRepository } from '../repositories/FeeRuleRepository';
import { PaymentGateway } from './PaymentGateway';

/**
 * @deprecated
 * Compatibility adapter.
 *
 * Scheduled removal after Phase 2 frontend migration.
 *
 * Delegates to the new domain PaymentService at:
 *   shared/payments/PaymentService.ts
 *
 * No business logic remains in this file.
 */

interface LegacyPlatformFeeCalculation {
  fee: number;
  breakdown: unknown;
}

interface LegacyPaymentAccount {
  id?: string;
  student_id: string;
  provider: string;
  provider_account_id?: string;
  provider_reference?: string;
  virtual_account_number?: string;
  account_name?: string;
  bank_name?: string;
  account_status: string;
  is_primary: boolean;
}

export const PaymentService = {
  /**
   * @deprecated Use paymentStore or the new paymentService.
   */
  async getPaymentHistory(student_id: string, _school_id: string) {
    const verifiedPayments = await PaymentGateway.getPaymentHistory(student_id, '');
    const { default: db } = await import('../../offline/localDb');
    const ledgerEntries = await db.ledger_entries
      .where('student_id')
      .equals(student_id)
      .and((e) => e.entry_type === 'CREDIT')
      .toArray();

    return {
      verified_payments: verifiedPayments,
      ledger_entries: ledgerEntries,
    };
  },

  /**
   * @deprecated Use paymentStore or the new paymentService.
   */
  async initiatePayment(student_id: string, school_id: string): Promise<{
    payment_instructions: {
      account_number: string;
      bank_name: string;
      account_name: string;
    };
    student_id: string;
  }> {
    let dva = await PaymentGateway.getDVA(student_id, school_id);

    if (!dva?.dva && !dva?.payment_account) {
      dva = await PaymentGateway.provisionDVA(student_id, school_id);
    }

    const account = dva.dva || dva.payment_account;

    return {
      payment_instructions: {
        account_number: account?.virtual_account_number || account?.dva_account_number || '',
        bank_name: account?.bank_name || account?.dva_bank_name || '',
        account_name: account?.account_name || account?.dva_account_name || '',
      },
      student_id,
    };
  },

  /**
   * @deprecated Use paymentStore or the new paymentService.
   */
  async getPaymentStatus(reference: string, school_id: string) {
    return PaymentGateway.getPaymentStatus(reference, school_id);
  },

  /**
   * @deprecated Use paymentStore or the new paymentService.
   */
  async getSettlementBreakdown(student_id: string, amount: number, school_id: string): Promise<{
    tuition: number;
    platform_fee: number;
    total: number;
    fee_calculation: LegacyPlatformFeeCalculation;
  }> {
    const { fee, breakdown } = await FeeRuleRepository.calculatePlatformFee(amount, school_id);

    return {
      tuition: amount - fee,
      platform_fee: fee,
      total: amount,
      fee_calculation: { fee, breakdown },
    };
  },

  /**
   * @deprecated Use paymentStore or the new paymentService.
   */
  async getPaymentAccount(student_id: string): Promise<LegacyPaymentAccount | null> {
    const { default: db } = await import('../../offline/localDb');
    return db.payment_accounts.where('student_id').equals(student_id).first();
  },

  /**
   * @deprecated Use paymentStore or the new paymentService.
   */
  async savePaymentAccount(account: LegacyPaymentAccount) {
    const { default: db } = await import('../../offline/localDb');
    await db.payment_accounts.put(account);
    return account;
  },
};