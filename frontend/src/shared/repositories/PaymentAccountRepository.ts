import db from '../../offline/localDb';
import { LocalRepository } from '../../offline/localDb';
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
      provider: account.provider ?? 'monnify',
      provider_account_id: account.provider_account_id,
      provider_reference: account.provider_reference,
      virtual_account_number: account.virtual_account_number!,
      account_name: account.account_name!,
      bank_name: account.bank_name!,
      account_status: account.account_status ?? 'ACTIVE',
      is_primary: account.is_primary ?? true,
      created_at: account.created_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deactivated_at: account.deactivated_at,
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
        provider: record.provider,
        provider_account_id: record.provider_account_id,
        provider_reference: record.provider_reference,
        virtual_account_number: record.virtual_account_number,
        account_name: record.account_name,
        bank_name: record.bank_name,
        account_status: record.account_status,
        is_primary: record.is_primary,
        created_at: record.created_at,
        updated_at: record.updated_at,
        deactivated_at: record.deactivated_at,
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
   * Get payment account by virtual account number
   */
  async getByVirtualAccountNumber(virtual_account_number: string): Promise<PaymentAccount | undefined> {
    return db.payment_accounts
      .where('virtual_account_number')
      .equals(virtual_account_number)
      .first();
  },

  /**
   * Get primary payment account for a student
   */
  async getPrimaryByStudent(student_id: string): Promise<PaymentAccount | undefined> {
    return db.payment_accounts
      .where('student_id')
      .equals(student_id)
      .and((a) => a.is_primary === true && a.account_status === 'ACTIVE')
      .first();
  },

  /**
   * Get all payment accounts for a school
   */
  async getBySchool(school_id: string): Promise<PaymentAccount[]> {
    return LocalRepository.getPaymentAccountsBySchool(school_id);
  },

  /**
   * Get all active payment accounts for a school
   */
  async getActiveBySchool(school_id: string): Promise<PaymentAccount[]> {
    return db.payment_accounts
      .where('school_id')
      .equals(school_id)
      .and((a) => a.account_status === 'ACTIVE')
      .toArray();
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
        provider: updated.provider,
        provider_account_id: updated.provider_account_id,
        provider_reference: updated.provider_reference,
        virtual_account_number: updated.virtual_account_number,
        account_name: updated.account_name,
        bank_name: updated.bank_name,
        account_status: updated.account_status,
        is_primary: updated.is_primary,
        created_at: updated.created_at,
        updated_at: updated.updated_at,
        deactivated_at: updated.deactivated_at,
      } as Record<string, unknown>,
    });

    return updated;
  },

  /**
   * Set a payment account as primary for a student
   * This will deactivate any existing primary account for this student
   */
  async setPrimaryAccount(student_id: string, account_id: string) {
    // First, deactivate any existing primary account
    const existingPrimary = await this.getPrimaryByStudent(student_id);
    if (existingPrimary && existingPrimary.id !== account_id) {
      await this.updatePaymentAccount(existingPrimary.id, { 
        is_primary: false,
        account_status: 'INACTIVE',
        deactivated_at: new Date().toISOString()
      });
    }

    // Set the new account as primary and active
    return this.updatePaymentAccount(account_id, {
      is_primary: true,
      account_status: 'ACTIVE',
    });
  },

  /**
   * Deactivate a payment account
   */
  async deactivateAccount(account_id: string) {
    const existing = await db.payment_accounts.get(account_id);
    if (!existing) throw new Error('Payment account not found');

    const updated: PaymentAccount = {
      ...existing,
      account_status: 'INACTIVE',
      deactivated_at: new Date().toISOString(),
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
        provider: updated.provider,
        provider_account_id: updated.provider_account_id,
        provider_reference: updated.provider_reference,
        virtual_account_number: updated.virtual_account_number,
        account_name: updated.account_name,
        bank_name: updated.bank_name,
        account_status: updated.account_status,
        is_primary: updated.is_primary,
        created_at: updated.created_at,
        updated_at: updated.updated_at,
        deactivated_at: updated.deactivated_at,
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
      .and((a) => a.account_status === 'ACTIVE')
      .first();
  },
};
