/**
 * SupabaseLedgerProvider
 * Supabase-backed implementation of LedgerProvider.
 * Only file that directly calls supabase for ledger operations.
 */

import { supabase, hasSupabaseConfig } from '../services/api/supabase';
import { LedgerProvider } from './LedgerProvider';
import type { LedgerEntry, LedgerResult } from './types';
import { mapLedgerError } from './LedgerError';

export class SupabaseLedgerProvider extends LedgerProvider {
  async createEntry(data: {
    id: string;
    entryNumber: string;
    sequenceNumber: number;
    schemaVersion: number;
    organizationId: string;
    schoolId: string;
    studentId: string;
    billingProfileId: string;
    transactionGroupId: string;
    sourceDocumentType: string;
    sourceDocumentId: string;
    academicSessionId: string;
    academicTermId: string;
    entryType: string;
    entryDirection: string;
    amountMinor: number;
    balanceBeforeMinor: number;
    balanceAfterMinor: number;
    currency: string;
    sourceEntity: string;
    previousHash?: string;
    entryHash: string;
    hashAlgorithm: string;
    reconciliationStatus: string;
    metadata?: Record<string, unknown>;
    occurredAt: string;
    postingDate: string;
    createdBy?: string;
    createdAt: string;
  }): Promise<LedgerResult<LedgerEntry>> {
    if (!hasSupabaseConfig) {
      return { data: null, error: { code: 'UNKNOWN', message: 'Supabase not configured' } };
    }

    try {
      const { data: entry, error } = await (supabase.from('ledger_entries') as any)
        .insert({
          id: data.id,
          entry_number: data.entryNumber,
          sequence_number: data.sequenceNumber,
          schema_version: data.schemaVersion,
          organization_id: data.organizationId,
          school_id: data.schoolId,
          student_id: data.studentId,
          billing_profile_id: data.billingProfileId,
          transaction_group_id: data.transactionGroupId,
          source_document_type: data.sourceDocumentType,
          source_document_id: data.sourceDocumentId,
          academic_session_id: data.academicSessionId,
          academic_term_id: data.academicTermId,
          entry_type: data.entryType,
          entry_direction: data.entryDirection,
          amount_minor: data.amountMinor,
          balance_before_minor: data.balanceBeforeMinor,
          balance_after_minor: data.balanceAfterMinor,
          currency: data.currency,
          source_entity: data.sourceEntity,
          previous_hash: data.previousHash || null,
          entry_hash: data.entryHash,
          hash_algorithm: data.hashAlgorithm,
          reconciliation_status: data.reconciliationStatus,
          metadata: data.metadata || null,
          occurred_at: data.occurredAt,
          posting_date: data.postingDate,
          created_by: data.createdBy || null,
          created_at: data.createdAt,
        })
        .select()
        .single();

      if (error) {
        return { data: null, error: mapLedgerError(error, 'LEDGER_ENTRY_CREATE_FAILED') };
      }

      return { data: entry as LedgerEntry, error: null };
    } catch (error) {
      return { data: null, error: mapLedgerError(error, 'LEDGER_ENTRY_CREATE_FAILED') };
    }
  }

  async getEntry(entryId: string): Promise<LedgerResult<LedgerEntry>> {
    if (!hasSupabaseConfig) {
      return { data: null, error: { code: 'LEDGER_ENTRY_NOT_FOUND', message: 'Supabase not configured' } };
    }

    try {
      const { data, error } = await (supabase.from('ledger_entries') as any)
        .select('*')
        .eq('id', entryId)
        .single();

      if (error) {
        return { data: null, error: mapLedgerError(error, 'LEDGER_ENTRY_NOT_FOUND') };
      }

      return { data: data as LedgerEntry, error: null };
    } catch (error) {
      return { data: null, error: mapLedgerError(error, 'LEDGER_ENTRY_NOT_FOUND') };
    }
  }

  async getEntryByNumber(entryNumber: string): Promise<LedgerResult<LedgerEntry | null>> {
    if (!hasSupabaseConfig) {
      return { data: null, error: null };
    }

    try {
      const { data, error } = await (supabase.from('ledger_entries') as any)
        .select('*')
        .eq('entry_number', entryNumber)
        .maybeSingle();

      if (error) {
        return { data: null, error: mapLedgerError(error, 'LEDGER_ENTRY_NOT_FOUND') };
      }

      return { data: data as LedgerEntry | null, error: null };
    } catch (error) {
      return { data: null, error: mapLedgerError(error, 'LEDGER_ENTRY_NOT_FOUND') };
    }
  }

  async getEntryBySourceDocument(sourceDocumentType: string, sourceDocumentId: string): Promise<LedgerResult<LedgerEntry | null>> {
    if (!hasSupabaseConfig) {
      return { data: null, error: null };
    }

    try {
      const { data, error } = await (supabase.from('ledger_entries') as any)
        .select('*')
        .eq('source_document_type', sourceDocumentType)
        .eq('source_document_id', sourceDocumentId)
        .maybeSingle();

      if (error) {
        return { data: null, error: mapLedgerError(error, 'LEDGER_ENTRY_NOT_FOUND') };
      }

      return { data: data as LedgerEntry | null, error: null };
    } catch (error) {
      return { data: null, error: mapLedgerError(error, 'LEDGER_ENTRY_NOT_FOUND') };
    }
  }

  async listEntries(schoolId: string): Promise<LedgerResult<LedgerEntry[]>> {
    if (!hasSupabaseConfig) {
      return { data: [], error: null };
    }

    try {
      const { data, error } = await (supabase.from('ledger_entries') as any)
        .select('*')
        .eq('school_id', schoolId)
        .order('sequence_number', { ascending: true });

      if (error) {
        return { data: null, error: mapLedgerError(error, 'LEDGER_ENTRY_NOT_FOUND') };
      }

      return { data: (data || []) as LedgerEntry[], error: null };
    } catch (error) {
      return { data: null, error: mapLedgerError(error, 'LEDGER_ENTRY_NOT_FOUND') };
    }
  }

  async listEntriesByStudent(studentId: string): Promise<LedgerResult<LedgerEntry[]>> {
    if (!hasSupabaseConfig) {
      return { data: [], error: null };
    }

    try {
      const { data, error } = await (supabase.from('ledger_entries') as any)
        .select('*')
        .eq('student_id', studentId)
        .order('sequence_number', { ascending: true });

      if (error) {
        return { data: null, error: mapLedgerError(error, 'LEDGER_ENTRY_NOT_FOUND') };
      }

      return { data: (data || []) as LedgerEntry[], error: null };
    } catch (error) {
      return { data: null, error: mapLedgerError(error, 'LEDGER_ENTRY_NOT_FOUND') };
    }
  }

  async listEntriesBySession(schoolId: string, sessionId: string): Promise<LedgerResult<LedgerEntry[]>> {
    if (!hasSupabaseConfig) {
      return { data: [], error: null };
    }

    try {
      const { data, error } = await (supabase.from('ledger_entries') as any)
        .select('*')
        .eq('school_id', schoolId)
        .eq('academic_session_id', sessionId)
        .order('sequence_number', { ascending: true });

      if (error) {
        return { data: null, error: mapLedgerError(error, 'LEDGER_ENTRY_NOT_FOUND') };
      }

      return { data: (data || []) as LedgerEntry[], error: null };
    } catch (error) {
      return { data: null, error: mapLedgerError(error, 'LEDGER_ENTRY_NOT_FOUND') };
    }
  }

  async listEntriesByTerm(schoolId: string, termId: string): Promise<LedgerResult<LedgerEntry[]>> {
    if (!hasSupabaseConfig) {
      return { data: [], error: null };
    }

    try {
      const { data, error } = await (supabase.from('ledger_entries') as any)
        .select('*')
        .eq('school_id', schoolId)
        .eq('academic_term_id', termId)
        .order('sequence_number', { ascending: true });

      if (error) {
        return { data: null, error: mapLedgerError(error, 'LEDGER_ENTRY_NOT_FOUND') };
      }

      return { data: (data || []) as LedgerEntry[], error: null };
    } catch (error) {
      return { data: null, error: mapLedgerError(error, 'LEDGER_ENTRY_NOT_FOUND') };
    }
  }

  async getLatestEntry(studentId: string): Promise<LedgerResult<LedgerEntry | null>> {
    if (!hasSupabaseConfig) {
      return { data: null, error: null };
    }

    try {
      const { data, error } = await (supabase.from('ledger_entries') as any)
        .select('*')
        .eq('student_id', studentId)
        .order('sequence_number', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        return { data: null, error: mapLedgerError(error, 'LEDGER_ENTRY_NOT_FOUND') };
      }

      return { data: data as LedgerEntry | null, error: null };
    } catch (error) {
      return { data: null, error: mapLedgerError(error, 'LEDGER_ENTRY_NOT_FOUND') };
    }
  }

  async getNextSequenceNumber(schoolId: string): Promise<LedgerResult<number>> {
    if (!hasSupabaseConfig) {
      return { data: 1, error: null };
    }

    try {
      const { data, error } = await (supabase.from('ledger_entries') as any)
        .select('sequence_number')
        .eq('school_id', schoolId)
        .order('sequence_number', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        return { data: null, error: mapLedgerError(error, 'LEDGER_ENTRY_NOT_FOUND') };
      }

      const nextSeq = (data?.sequence_number || 0) + 1;
      return { data: nextSeq, error: null };
    } catch (error) {
      return { data: null, error: mapLedgerError(error, 'LEDGER_ENTRY_NOT_FOUND') };
    }
  }

  async reverseEntry(_originalEntryId: string, _reason: string): Promise<LedgerResult<LedgerEntry>> {
    return { data: null, error: { code: 'UNKNOWN', message: 'Not implemented' } };
  }

  async adjustEntry(_originalEntryId: string, _newAmountMinor: number, _reason: string): Promise<LedgerResult<LedgerEntry>> {
    return { data: null, error: { code: 'UNKNOWN', message: 'Not implemented' } };
  }

  async refundEntry(_originalEntryId: string, _amountMinor: number, _reason: string): Promise<LedgerResult<LedgerEntry>> {
    return { data: null, error: { code: 'UNKNOWN', message: 'Not implemented' } };
  }

  async generateStatement(_studentId: string, _fromDate: string, _toDate: string): Promise<LedgerResult<LedgerEntry[]>> {
    return { data: null, error: { code: 'UNKNOWN', message: 'Not implemented' } };
  }

  async recalculateRunningBalances(_studentId: string): Promise<LedgerResult<void>> {
    return { data: null, error: { code: 'UNKNOWN', message: 'Not implemented' } };
  }

  isConfigured(): boolean {
    return hasSupabaseConfig;
  }
}