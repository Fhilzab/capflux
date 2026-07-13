import { LocalRepository } from '../offline/localDb';

export const LedgerRepository = {
  async createLedgerEntry(entry: Record<string, any>) {
    const { v4: uuidv4 } = await import('uuid');
    const record = {
      id: entry.id ?? uuidv4(),
      ...entry,
    } as Record<string, any>;

    await LocalRepository.saveLedgerEntry(record);
    await LocalRepository.enqueueSyncItem({
      id: `ledger-sync-${record.id}-${Date.now()}`,
      school_id: record.school_id,
      entity_type: 'ledger_entries',
      entity_id: record.id,
      payload: record,
    });
    return record;
  },

  async getEntriesByStudent(student_id: string) {
    return LocalRepository.getLedgerEntriesByStudent(student_id);
  },

  async getEntriesBySchool(school_id: string) {
    return LocalRepository.getLedgerEntriesBySchool(school_id);
  },
};
