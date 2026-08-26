/**
 * Sandbox ledger writer/reader.
 *
 * Bridges the canonical snake_case rows stored in the sandbox database with
 * the camelCase LedgerEntry domain model used by LedgerEngine. Runtime posts
 * (simulated verified payments, reversals) go through LedgerEngine so the
 * hash chain and running balances follow EXACTLY the production algorithm;
 * this module only performs mapping, chaining lookup and append-only
 * persistence (no update/delete paths exist here by design).
 */

import type { SandboxCapfluxDB } from '../sandboxDb';
import { getSandboxDb } from '../sandboxDb';
import { LedgerEngine } from '../../shared/ledger/LedgerEngine';
import type { LedgerEntry, LedgerEntryType, EntryDirection, SourceEntity, SourceDocumentType } from '../../shared/ledger/types';

export interface LedgerRow {
  id: string;
  entry_number: string;
  sequence_number: number;
  schema_version: number;
  organization_id: string;
  school_id: string;
  student_id: string;
  billing_profile_id: string | null;
  transaction_group_id: string;
  source_document_type: string;
  source_document_id: string;
  academic_session_id: string;
  academic_term_id: string;
  entry_type: string;
  entry_direction: 'DEBIT' | 'CREDIT';
  amount_minor: number;
  amount: number; // legacy naira view
  balance_before_minor: number;
  balance_after_minor: number;
  currency: string;
  source_entity: string;
  previous_hash: string | null;
  entry_hash: string;
  hash_algorithm: string;
  reconciliation_status: string;
  metadata: Record<string, unknown> | null;
  occurred_at: string;
  posting_date: string;
  created_by?: string | null;
  created_at: string;
  device_id: string;
  client_sequence: number;
}

export function rowToDomainEntry(row: LedgerRow): LedgerEntry {
  return {
    id: row.id,
    entryNumber: row.entry_number,
    sequenceNumber: row.sequence_number,
    schemaVersion: row.schema_version,
    organizationId: row.organization_id,
    schoolId: row.school_id,
    studentId: row.student_id,
    billingProfileId: row.billing_profile_id ?? '',
    transactionGroupId: row.transaction_group_id,
    sourceDocumentType: row.source_document_type as SourceDocumentType,
    sourceDocumentId: row.source_document_id,
    academicSessionId: row.academic_session_id,
    academicTermId: row.academic_term_id,
    entryType: row.entry_type as LedgerEntryType,
    entryDirection: row.entry_direction as EntryDirection,
    amountMinor: row.amount_minor,
    balanceBeforeMinor: row.balance_before_minor,
    balanceAfterMinor: row.balance_after_minor,
    currency: row.currency,
    sourceEntity: row.source_entity as SourceEntity,
    previousHash: row.previous_hash ?? undefined,
    entryHash: row.entry_hash,
    hashAlgorithm: row.hash_algorithm as 'SHA256_V1',
    reconciliationStatus: row.reconciliation_status as 'UNRECONCILED' | 'RECONCILED' | 'DISPUTED',
    metadata: row.metadata ?? undefined,
    occurredAt: row.occurred_at,
    postingDate: row.posting_date,
    createdBy: row.created_by ?? undefined,
    createdAt: row.created_at,
  };
}

export function domainEntryToRow(entry: LedgerEntry): LedgerRow {
  return {
    id: entry.id,
    entry_number: entry.entryNumber,
    sequence_number: entry.sequenceNumber,
    schema_version: entry.schemaVersion,
    organization_id: entry.organizationId,
    school_id: entry.schoolId,
    student_id: entry.studentId,
    billing_profile_id: entry.billingProfileId || null,
    transaction_group_id: entry.transactionGroupId,
    source_document_type: entry.sourceDocumentType,
    source_document_id: entry.sourceDocumentId,
    academic_session_id: entry.academicSessionId,
    academic_term_id: entry.academicTermId,
    entry_type: entry.entryType,
    entry_direction: entry.entryDirection,
    amount_minor: entry.amountMinor,
    amount: entry.amountMinor / 100,
    balance_before_minor: entry.balanceBeforeMinor,
    balance_after_minor: entry.balanceAfterMinor,
    currency: entry.currency,
    source_entity: entry.sourceEntity,
    previous_hash: entry.previousHash ?? null,
    entry_hash: entry.entryHash,
    hash_algorithm: entry.hashAlgorithm,
    reconciliation_status: entry.reconciliationStatus,
    metadata: entry.metadata ?? null,
    occurred_at: entry.occurredAt,
    posting_date: entry.postingDate,
    created_by: entry.createdBy ?? null,
    created_at: entry.createdAt,
    device_id: 'payment-webhook',
    client_sequence: 0,
  };
}

async function getLatestStudentEntry(db: SandboxCapfluxDB, studentId: string): Promise<LedgerEntry | null> {
  const rows = (await db.ledger_entries.where('student_id').equals(studentId).toArray()) as unknown as LedgerRow[];
  if (rows.length === 0) return null;
  const latest = rows.reduce((a, b) => ((b.sequence_number ?? 0) > (a.sequence_number ?? 0) ? b : a));
  return rowToDomainEntry(latest);
}

async function getSchoolNextSequence(db: SandboxCapfluxDB, schoolId: string): Promise<number> {
  const rows = (await db.ledger_entries.where('school_id').equals(schoolId).toArray()) as unknown as LedgerRow[];
  if (rows.length === 0) return 1;
  return rows.reduce((max, r) => Math.max(max, r.sequence_number ?? 0), 0) + 1;
}

/** Idempotency guard — mirrors the unique index on source document. */
export async function findEntryBySourceDocument(
  db: SandboxCapfluxDB,
  sourceDocumentType: string,
  sourceDocumentId: string,
): Promise<LedgerRow | null> {
  const all = (await db.ledger_entries.toArray()) as unknown as LedgerRow[];
  return (
    all.find(
      (r) =>
        r.source_document_type === sourceDocumentType && r.source_document_id === sourceDocumentId,
    ) ?? null
  );
}

export interface PostPaymentCreditInput {
  schoolId: string;
  organizationId: string;
  studentId: string;
  /** Unique payment reference — doubles as the idempotency key. */
  reference: string;
  gatewayTxnRef: string;
  amountMinor: number;
  method: string;
  sessionId: string;
  termId: string;
  occurredAt: string;
  billingProfileId?: string;
  createdBy?: string;
}

/**
 * Post a verified payment: one CREDIT PAYMENT entry through LedgerEngine.
 * Duplicate references are rejected (append-only idempotency).
 */
export async function postVerifiedPaymentCredit(
  input: PostPaymentCreditInput,
  dbHandle?: SandboxCapfluxDB,
): Promise<{ ok: true; entry: LedgerRow } | { ok: false; code: 'DUPLICATE_LEDGER_ENTRY'; message: string }> {
  const db = dbHandle ?? getSandboxDb();

  const existing = await findEntryBySourceDocument(db, 'PAYMENT', input.reference);
  if (existing) {
    return { ok: false, code: 'DUPLICATE_LEDGER_ENTRY', message: `Payment ${input.reference} already posted` };
  }

  const previousEntry = await getLatestStudentEntry(db, input.studentId);
  const sequenceNumber = await getSchoolNextSequence(db, input.schoolId);

  const built = await LedgerEngine.createEntry({
    organizationId: input.organizationId,
    schoolId: input.schoolId,
    studentId: input.studentId,
    billingProfileId: input.billingProfileId ?? '',
    transactionGroupId: `txn-${input.reference}`,
    sourceDocumentType: 'PAYMENT',
    sourceDocumentId: input.reference,
    academicSessionId: input.sessionId,
    academicTermId: input.termId,
    entryType: 'PAYMENT',
    entryDirection: 'CREDIT',
    amountMinor: input.amountMinor,
    currency: 'NGN',
    sourceEntity: 'PAYMENT',
    previousEntry: previousEntry,
    reconciliationStatus: 'RECONCILED',
    paymentGatewayReference: input.gatewayTxnRef,
    paymentMethod: input.method,
    occurredAt: input.occurredAt,
    postingDate: input.occurredAt,
    createdBy: input.createdBy,
    metadata: { seeded: false },
  });

  if (!built.data) {
    throw new Error(built.error?.message || 'Ledger engine rejected payment entry');
  }

  // LedgerEngine derives per-student sequence; keep the school-wide counter authoritative.
  const row = { ...domainEntryToRow({ ...built.data, sequenceNumber }), amount: input.amountMinor / 100 };
  await db.ledger_entries.put(row as never);
  return { ok: true, entry: row };
}

export interface PostReversalInput {
  studentId: string;
  originalReference: string;
  reason: string;
  occurredAt: string;
  createdBy?: string;
}

/**
 * Reverse a posted payment credit with a compensating DEBIT REVERSAL entry.
 * The original entry is NEVER modified (append-only correction semantics).
 */
export async function postReversalForPayment(
  input: PostReversalInput,
  dbHandle?: SandboxCapfluxDB,
): Promise<{ ok: true; entry: LedgerRow } | { ok: false; code: 'LEDGER_ENTRY_NOT_FOUND'; message: string }> {
  const db = dbHandle ?? getSandboxDb();

  const originalRow = await findEntryBySourceDocument(db, 'PAYMENT', input.originalReference);
  if (!originalRow) {
    return { ok: false, code: 'LEDGER_ENTRY_NOT_FOUND', message: `No ledger entry for ${input.originalReference}` };
  }
  const existingReversal = await findEntryBySourceDocument(db, 'ADJUSTMENT', originalRow.id);
  if (existingReversal) {
    return { ok: false, code: 'LEDGER_ENTRY_NOT_FOUND', message: 'Payment already reversed' };
  }

  const original = rowToDomainEntry(originalRow);
  const previousEntry = await getLatestStudentEntry(db, input.studentId);
  const built = await LedgerEngine.createReversalEntry(original, input.reason, previousEntry);
  if (!built.data) {
    throw new Error(built.error?.message || 'Ledger engine rejected reversal');
  }

  const row = domainEntryToRow(built.data);
  await db.ledger_entries.put(row as never);
  return { ok: true, entry: row };
}
