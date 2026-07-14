import db from '../offline/localDb';
import { LocalRepository } from '../offline/localDb';
import type { PaymentAccount } from '../types/billing';

export const PaymentAccountRepository = {
  /**
   * Save payment account (DVA) to IndexedDB and enqueue for sync
   */
  async savePaymentAccount(account: Partial<PaymentAccount>) {
    const { v4: uuidv4 } = await import('uuid');
    const record: PaymentAccount = {
      id: account.id ?? uuidv4(),
      school_id: account.school_id!,
      student_id: account.student_id!,
      provider_name: account.provider_name ?? 'monnify',
      account_number: account.account_number!,
      bank_name: account.bank_name!,
      account_reference: account.account_reference!,
      provider_student_reference: account.provider_student_reference,
      status: account.status ?? 'ACTIVE',
      created_at: account.created_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await LocalRepository.savePaymentAccount(record);
    await LocalRepository.enqueueSyncItem({
      school_id: record.school_id,
      entity_type: 'payment_accounts',
      entity_id: record.id,
      payload: {
        id: record.id,
        school_id: record.school_id,
        student_id: record.student_id,
        provider_name: record.provider_name,
        account_number: record.account_number,
        bank_name: record.bank_name,
        account_reference: record.account_reference,
        provider_student_reference: record.provider_student_reference,
        status: record.status,
        created_at: record.created_at,
        updated_at: record.updated_at,
      } as Record<string, unknown>,
    });

    return record;
  },

  /**
   * Get payment account by student ID
   */
  async getByStudent(student_id: string): Promise<PaymentAccount | undefined> {
    return LocalRepository.getPaymentAccountByStudent(student_id);
  },

  /**
   * Get payment account by account number
   */
  async getByAccountNumber(account_number: string): Promise<PaymentAccount | undefined> {
    return db.payment_accounts
      .where('account_number')
      .equals(account_number)
      .first();
  },

  /**
   * Get all payment accounts for a school
   */
  async getBySchool(school_id: string): Promise<PaymentAccount[]> {
    return LocalRepository.getPaymentAccountsBySchool(school_id);
  },

  /**
   * Update payment account
   */
  async updatePaymentAccount(account_id: string, updates: Partial<PaymentAccount>) {
    const existing = await db.payment_accounts.get(account_id);
    if (!existing) throw new Error('Payment account not found');

    const updated: PaymentAccount = {
      ...existing,
      ...updates,
      updated_at: new Date().toISOString(),
    };

    await db.payment_accounts.put(updated);
    await LocalRepository.enqueueSyncItem({
      school_id: updated.school_id,
      entity_type: 'payment_accounts',
      entity_id: account_id,
      operation: 'UPDATE',
      payload: {
        id: updated.id,
        school_id: updated.school_id,
        student_id: updated.student_id,
        provider_name: updated.provider_name,
        account_number: updated.account_number,
        bank_name: updated.bank_name,
        account_reference: updated.account_reference,
        provider_student_reference: updated.provider_student_reference,
        status: updated.status,
        created_at: updated.created_at,
        updated_at: updated.updated_at,
      } as Record<string, unknown>,
    });

    return updated;
  },

  /**
   * Find active payment account for student
   */
  async findActiveByStudent(student_id: string): Promise<PaymentAccount | undefined> {
    return db.payment_accounts
      .where('student_id')
      .equals(student_id)
      .and((a) => a.status === 'ACTIVE')
      .first();
  },
};