/** Shared canonical ledger-semantics helpers.
 *
 * Ledger entries as persisted in Dexie/sandboxDb carry canonical fields:
 * entry_type (CHARGE | PAYMENT | REVERSAL | ...) + entry_direction (DEBIT |
 * CREDIT) and amount_minor (integer kobo). Legacy readers also populate
 * amount (naira) / entry_type DEBIT|CREDIT for backwards compatibility.
 *
 * These helpers keep every financial surface on integer kobo arithmetic and
 * align with the approved dashboard compound chart (assessed = CHARGE DEBITs,
 * collected = PAYMENT CREDITs net of REVERSAL DEBITs, outstanding =
 * assessed - collected).
 */

export interface LedgerRowLike {
  id: string;
  student_id: string;
  amount?: number;
  amount_minor?: number;
  amountMinor?: number;
  entry_type?: string;
  entry_direction?: string;
  entry_category?: string;
  entry_description?: string;
  created_at?: string;
  occurred_at?: string;
  posting_date?: string;
}

/** Derive kobo integer from either amount_minor or legacy amount. */
export function getEntryAmountMinor(entry: LedgerRowLike): number {
  const raw = entry.amount_minor ?? entry.amountMinor;
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.trunc(raw);
  if (typeof raw === 'string' && raw !== '') {
    const n = Number(raw);
    if (Number.isFinite(n)) return Math.trunc(n);
  }
  const amt = Number(entry.amount ?? 0);
  if (!Number.isFinite(amt)) return 0;
  return Math.round(amt * 100);
}

/** Event date — seed writes occurred_at & created_at identically. */
export function getEntryDate(entry: LedgerRowLike): string | undefined {
  return entry.occurred_at ?? entry.posting_date ?? entry.created_at;
}

/** CHARGE + DEBIT. Legacy fallback: type-less DEBIT charges. */
export function isChargeEntry(entry: LedgerRowLike): boolean {
  const t = String(entry.entry_type ?? '').toUpperCase();
  const d = String(entry.entry_direction ?? '').toUpperCase();
  if (t === 'CHARGE') return d === 'DEBIT' || d === '';
  if (t === 'DEBIT') return true;
  return false;
}

/** PAYMENT + CREDIT. Legacy fallback: CREDIT type with no direction. */
export function isPaymentCreditEntry(entry: LedgerRowLike): boolean {
  const t = String(entry.entry_type ?? '').toUpperCase();
  const d = String(entry.entry_direction ?? '').toUpperCase();
  if (t === 'PAYMENT' && d === 'CREDIT') return true;
  if (t === 'CREDIT' && (d === 'CREDIT' || d === '')) return true;
  return false;
}

/** REVERSAL + DEBIT — reverses a payment credit. */
export function isReversalDebitEntry(entry: LedgerRowLike): boolean {
  const t = String(entry.entry_type ?? '').toUpperCase();
  const d = String(entry.entry_direction ?? '').toUpperCase();
  return t === 'REVERSAL' && d === 'DEBIT';
}

/** Any entry that reduces what a parent owes (payments and waivers/refunds). */
export function isCollectedEntry(entry: LedgerRowLike): boolean {
  const t = String(entry.entry_type ?? '').toUpperCase();
  const d = String(entry.entry_direction ?? '').toUpperCase();
  if (t === 'PAYMENT' && d === 'CREDIT') return true;
  if (t === 'REFUND' && d === 'CREDIT') return true;
  if (t === 'WAIVER' && d === 'CREDIT') return true;
  if (t === 'CREDIT' && (d === 'CREDIT' || d === '')) return true;
  return false;
}

export interface LedgerSummaryMinor {
  /** CHARGE debits only */
  assessedMinor: number;
  /** PAYMENT credits minus REVERSAL/REFUND debits */
  collectedMinor: number;
  /** assessed - collected */
  outstandingMinor: number;
}

/** Summarize an entry list into canonical kobo aggregates. */
export function summarizeLedger(entries: LedgerRowLike[]): LedgerSummaryMinor {
  let assessedMinor = 0;
  let paymentCreditsMinor = 0;
  let reversalDebitsMinor = 0;

  for (const entry of entries) {
    const minor = getEntryAmountMinor(entry);
    if (isChargeEntry(entry)) assessedMinor += minor;
    if (isPaymentCreditEntry(entry)) paymentCreditsMinor += minor;
    if (isReversalDebitEntry(entry)) reversalDebitsMinor += minor;
  }

  const collectedMinor = paymentCreditsMinor - reversalDebitsMinor;
  return {
    assessedMinor,
    collectedMinor,
    outstandingMinor: assessedMinor - collectedMinor,
  };
}

/** Format integer kobo as a Naira string with the ₦ symbol. */
export function formatNairaKobo(kobo: number): string {
  const naira = Math.trunc(kobo) / 100;
  return `₦${naira.toLocaleString('en-NG', { maximumFractionDigits: 2 })}`;
}