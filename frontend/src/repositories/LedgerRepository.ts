import { LocalRepository } from '../offline/localDb';

export const LedgerRepository = {
  async createLedgerEntry(entry: Record<string, any>) {
    await LocalRepository.saveLedgerEntry(entry);
    await LocalRepository.enqueueSyncItem({
      id: `ledger-sync-${entry.id}`,
      school_id: entry.school_id,
      entity_type: 'ledger_entries',
      entity_id: entry.id,
      payload: entry,
    });
    return entry;
  },

  async getEntriesByStudent(student_id: string) {
    return LocalRepository.getLedgerEntriesByStudent(student_id);
  },

  async getEntriesBySchool(school_id: string) {
    return LocalRepository.getLedgerEntriesBySchool(school_id);
  },
};
