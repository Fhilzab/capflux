import { LocalRepository } from '../../offline/localDb';
import { EntityOwnership } from '../../offline/localDb';
import type { LedgerEntry, LedgerEntryCategory } from '../types/billing';

export const LedgerRepository = {
  /**
   * Create a DEBIT ledger entry only (CREDIT entries are created server-side)
   * Enforces financial immutability - CREDIT entries must come from verified payments
   */
  async createDebitLedgerEntry(entry: {
    id?: string;
    school_id: string;
    student_id: string;
    amount: number;
    entry_category: LedgerEntryCategory;
    entry_description?: string;
    metadata?: Record<string, unknown>;
  }): Promise<LedgerEntry> {
    const { v4: uuidv4 } = await import('uuid');
    const record: LedgerEntry = {
      id: entry.id ?? uuidv4(),
      school_id: entry.school_id,
      student_id: entry.student_id,
      amount: entry.amount,
      entry_type: 'DEBIT', // Only DEBIT allowed locally
      entry_category: entry.entry_category,
      entry_description: entry.entry_description,
      reference_id: undefined,
      metadata: entry.metadata ?? {},
      client_sequence: 0,
      device_id: 'local-client',
      created_at: new Date().toISOString(),
    };

    // Save to local DB with source tracking
    await LocalRepository.saveLedgerEntry({
      ...record,
      source: 'LOCAL',
    });

    // Enqueue for upload sync
    await LocalRepository.enqueueSyncItem({
      school_id: record.school_id,
      entity_type: 'ledger_entries',
      entity_id: record.id,
      payload: {
        id: record.id,
        school_id: record.school_id,
        student_id: record.student_id,
        amount: record.amount,
        entry_type: record.entry_type,
        entry_category: record.entry_category,
        entry_description: record.entry_description,
        metadata: record.metadata,
        client_sequence: record.client_sequence,
        device_id: record.device_id,
        created_at: record.created_at,
        source: 'LOCAL',
      } as Record<string, unknown>,
    });
    return record;
  },

  /**
   * DEPRECATED: Use createDebitLedgerEntry instead
   * This enforces that CREDIT entries cannot be created locally
   */
  async createLedgerEntry(entry: {
    id?: string;
    school_id: string;
    student_id: string;
    amount: number;
    entry_type: 'DEBIT' | 'CREDIT';
    entry_category: LedgerEntryCategory;
    entry_description?: string;
    metadata?: Record<string, unknown>;
  }): Promise<LedgerEntry> {
    // Enforce immutability: Only DEBIT entries allowed locally
    if (entry.entry_type === 'CREDIT') {
      throw new Error('CREDIT ledger entries cannot be created locally. Only DEBIT entries (tuition charges) are allowed.');
    }
    return this.createDebitLedgerEntry(entry);
  },

  // Read-only methods - no update/delete allowed
  async getEntriesByStudent(student_id: string): Promise<LedgerEntry[]> {
    return LocalRepository.getLedgerEntriesByStudent(student_id);
  },

  async getEntriesBySchool(school_id: string): Promise<LedgerEntry[]> {
    return LocalRepository.getLedgerEntriesBySchool(school_id);
  },

  /**
   * Calculate student balance from immutable ledger entries
   * Balance = sum(DEBIT) - sum(CREDIT)
   */
  async calculateStudentBalance(student_id: string): Promise<number> {
    const entries = await LocalRepository.getLedgerEntriesByStudent(student_id);
    return entries.reduce((balance, entry) => {
      if (entry.entry_type === 'DEBIT') {
        return balance + Number(entry.amount);
      }
      return balance - Number(entry.amount);
    }, 0);
  },

  /**
   * Calculate school balance from immutable ledger entries
   */
  async calculateSchoolBalance(school_id: string): Promise<number> {
    const entries = await LocalRepository.getLedgerEntriesBySchool(school_id);
    return entries.reduce((balance, entry) => {
      if (entry.entry_type === 'DEBIT') {
        return balance + Number(entry.amount);
      }
      return balance - Number(entry.amount);
    }, 0);
  },

  // No update or delete methods - ledger is append-only
};

export default LedgerRepository;