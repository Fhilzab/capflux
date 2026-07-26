import type { PostingBatch, AccountingResult } from './types';

export class PostingBatchProvider {
  async createPostingBatch(data: {
    id: string;
    batchNumber: string;
    organizationId: string;
    schoolId: string;
    journalIds: string[];
    description?: string;
    occurredAt: string;
    createdBy?: string;
    createdAt: string;
  }): Promise<AccountingResult<PostingBatch>> {
    return { data: null, error: { code: 'UNKNOWN', message: 'Not implemented' } };
  }

  async getPostingBatch(_batchId: string): Promise<AccountingResult<PostingBatch | null>> {
    return { data: null, error: null };
  }

  async listPostingBatches(_schoolId: string): Promise<AccountingResult<PostingBatch[]>> {
    return { data: [], error: null };
  }
}