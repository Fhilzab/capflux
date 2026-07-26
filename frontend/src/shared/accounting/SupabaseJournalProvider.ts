/**
 * SupabaseJournalProvider
 * Supabase-backed implementation of JournalProvider.
 * Only file that directly calls supabase for accounting/journal operations.
 */

import { JournalProvider } from './JournalProvider';
import type { JournalEntry, JournalLine, AccountingResult, PostingBatch } from './types';

export class SupabaseJournalProvider extends JournalProvider {
  async createJournal(data: Parameters<JournalProvider['createJournal']>[0]): Promise<AccountingResult<JournalEntry>> {
    return { data: null, error: { code: 'UNKNOWN', message: 'Not implemented' } };
  }

  async getJournal(_journalId: string): Promise<AccountingResult<JournalEntry | null>> {
    return { data: null, error: null };
  }

  async getJournalByNumber(_journalNumber: string): Promise<AccountingResult<JournalEntry | null>> {
    return { data: null, error: null };
  }

  async getJournalBySourceDocument(_sourceDocumentType: string, _sourceDocumentId: string): Promise<AccountingResult<JournalEntry | null>> {
    return { data: null, error: null };
  }

  async listJournals(_schoolId: string): Promise<AccountingResult<JournalEntry[]>> {
    return { data: [], error: null };
  }

  async listJournalsByBatch(_batchId: string): Promise<AccountingResult<JournalEntry[]>> {
    return { data: [], error: null };
  }

  async approveJournal(_journalId: string): Promise<AccountingResult<JournalEntry>> {
    return { data: null, error: { code: 'UNKNOWN', message: 'Not implemented' } };
  }

  async postJournal(_journalId: string, _batchId?: string): Promise<AccountingResult<JournalEntry>> {
    return { data: null, error: { code: 'UNKNOWN', message: 'Not implemented' } };
  }

  async reverseJournal(_journalId: string, _reason: string): Promise<AccountingResult<JournalEntry>> {
    return { data: null, error: { code: 'UNKNOWN', message: 'Not implemented' } };
  }

  async createPostingBatch(data: Parameters<JournalProvider['createPostingBatch']>[0]): Promise<AccountingResult<PostingBatch>> {
    return { data: null, error: { code: 'UNKNOWN', message: 'Not implemented' } };
  }

  async getPostingBatch(_batchId: string): Promise<AccountingResult<PostingBatch | null>> {
    return { data: null, error: null };
  }

  async listPostingBatches(_schoolId: string): Promise<AccountingResult<PostingBatch[]>> {
    return { data: [], error: null };
  }

  isConfigured(): boolean {
    return false;
  }
}