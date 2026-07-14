import { LocalRepository } from '../offline/localDb';
import type { LedgerEntry, LedgerEntryCategory } from '../types/billing';

export const LedgerRepository = {
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
    const { v4: uuidv4 } = await import('uuid');
    const record: LedgerEntry = {
      id: entry.id ?? uuidv4(),
      school_id: entry.school_id,
      student_id: entry.student_id,
      amount: entry.amount,
      entry_type: entry.entry_type,
      entry_category: entry.entry_category,
      entry_description: entry.entry_description,
      reference_id: undefined,
      metadata: entry.metadata ?? {},
      client_sequence: 0,
      device_id: 'local-client',
      created_at: new Date().toISOString(),
    };

    await LocalRepository.saveLedgerEntry(record);
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
      } as Record<string, unknown>,
    });
    return record;
  },

  async getEntriesByStudent(student_id: string): Promise<LedgerEntry[]> {
    return LocalRepository.getLedgerEntriesByStudent(student_id);
  },

  async getEntriesBySchool(school_id: string): Promise<LedgerEntry[]> {
    return LocalRepository.getLedgerEntriesBySchool(school_id);
  },
};