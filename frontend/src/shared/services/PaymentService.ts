import { FeeRuleRepository } from '../repositories/FeeRuleRepository';
import { PaymentGateway } from './PaymentGateway';
import type { PaymentAccount, PlatformFeeCalculation } from '../types/billing';

export const PaymentService = {
  /**
   * Get payment history for a student
   * Reads from both ledger_entries (local/offline) and payment_transactions (verified payments)
   */
  async getPaymentHistory(student_id: string, _school_id: string) {
    // Get verified payment transactions (local/offline)
    const verifiedPayments = await PaymentGateway.getPaymentHistory(student_id, '');
    
    // Get all CREDIT ledger entries (includes offline-first entries that may sync later)
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
   * Initiate a payment - returns the DVA details for the student
   * Parents pay directly into the DVA, webhook records the payment
   */
  async initiatePayment(student_id: string, school_id: string): Promise<{
    payment_instructions: {
      account_number: string;
      bank_name: string;
      account_name: string;
    };
    student_id: string;
  }> {
    // Get or create DVA for student
    let dva = await PaymentGateway.getDVA(student_id, school_id);
    
    if (!dva?.dva && !dva?.payment_account) {
      // Provision DVA if not exists
      dva = await PaymentGateway.provisionDVA(student_id, school_id);
    }

    // Extract from either PaymentAccount or DVAResponse format
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
   * Check payment status by reference
   */
  async getPaymentStatus(reference: string, school_id: string) {
    return PaymentGateway.getPaymentStatus(reference, school_id);
  },

  /**
   * Get platform fee calculation using fee rules
   * This replaces the hardcoded settlement breakdown
   */
  async getSettlementBreakdown(student_id: string, amount: number, school_id: string): Promise<{
    tuition: number;
    platform_fee: number;
    total: number;
    fee_calculation: PlatformFeeCalculation;
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
   * Get payment account for a student
   */
  async getPaymentAccount(student_id: string): Promise<PaymentAccount | null> {
    const { default: db } = await import('../../offline/localDb');
    return db.payment_accounts.where('student_id').equals(student_id).first();
  },

  /**
   * Save payment account (DVA) after provisioning
   */
  async savePaymentAccount(account: PaymentAccount) {
    const { default: db } = await import('../../offline/localDb');
    await db.payment_accounts.put(account);
    return account;
  },
};

export default PaymentService;