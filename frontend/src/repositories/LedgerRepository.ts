import { LocalRepository } from '../offline/localDb';

export const LedgerRepository = {
  async createLedgerEntry(entry: Record<string, any>) {
    return LocalRepository.saveLedgerEntry(entry);
  },

  async getEntriesByStudent(student_id: string) {
    return LocalRepository.getLedgerEntriesByStudent(student_id);
  },
};
