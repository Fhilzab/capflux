import { supabase } from './api/supabase';
import { PaymentGateway } from './PaymentGateway';

export const PaymentService = {
  /**
   * Get payment history for a student
   * Reads from both ledger_entries (local/offline) and payment_transactions (verified payments)
   */
  async getPaymentHistory(student_id: string, school_id: string) {
    // Get verified payment transactions (server-side recorded)
    const verifiedPayments = await PaymentGateway.getPaymentHistory(student_id, school_id);
    
    // Get all CREDIT ledger entries (includes offline-first entries that may sync later)
    const { data: ledgerEntries } = await supabase
      .from('ledger_entries')
      .select('*')
      .eq('student_id', student_id)
      .eq('entry_type', 'CREDIT')
      .order('created_at', { ascending: false });

    return {
      verified_payments: verifiedPayments,
      ledger_entries: ledgerEntries || [],
    };
  },

  /**
   * Initiate a payment - returns the DVA details for the student
   * Parents pay directly into the DVA, webhook records the payment
   */
  async initiatePayment(student_id: string, school_id: string) {
    // Get or create DVA for student
    let dva = await PaymentGateway.getDVA(student_id, school_id);
    
    if (!dva?.dva) {
      // Provision DVA if not exists
      dva = await PaymentGateway.provisionDVA(student_id, school_id);
    }

    return {
      payment_instructions: {
        account_number: dva.dva?.dva_account_number,
        bank_name: dva.dva?.dva_bank_name,
        account_name: dva.dva?.dva_account_name,
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
   * Get settlement breakdown for a payment
   * Shows how the payment is split between school and Capstone
   */
  async getSettlementBreakdown(student_id: string, amount: number) {
    return PaymentGateway.computeSettlementBreakdown(student_id, amount);
  },
};
