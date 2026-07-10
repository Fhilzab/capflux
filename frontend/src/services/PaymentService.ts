import { LedgerRepository } from '../repositories/LedgerRepository';

export const PaymentService = {
  async recordPayment(payment: Record<string, any>) {
    return LedgerRepository.createLedgerEntry({
      ...payment,
      entry_type: 'CREDIT',
      entry_category: payment.entry_category ?? 'PAYMENT',
    });
  },

  async getPaymentHistory(student_id: string) {
    const entries = await LedgerRepository.getEntriesByStudent(student_id);
    return entries.filter((entry) => entry.entry_type === 'CREDIT');
  },
};
