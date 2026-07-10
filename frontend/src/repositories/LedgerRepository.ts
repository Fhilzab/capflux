import { LocalRepository } from '../offline/localDb';

export const LedgerRepository = {
  async createLedgerEntry(entry: Record<string, any>) {
    return LocalRepository.saveLedgerEntry(entry);
  },
};
