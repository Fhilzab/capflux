import { describe, it, expect } from 'vitest';
import {
  getEntryAmountMinor,
  getEntryDate,
  isChargeEntry,
  isPaymentCreditEntry,
  isReversalDebitEntry,
  isCollectedEntry,
  summarizeLedger,
  formatNairaKobo,
  type LedgerRowLike,
} from '../ledgerSemantics';

const charge = (over: Partial<LedgerRowLike> = {}): LedgerRowLike => ({
  id: 'c1',
  student_id: 'stu-1',
  entry_type: 'CHARGE',
  entry_direction: 'DEBIT',
  amount_minor: 1_000_000,
  ...over,
});

describe('ledgerSemantics', () => {
  describe('getEntryAmountMinor', () => {
    it('prefers canonical amount_minor over legacy amount', () => {
      expect(getEntryAmountMinor(charge({ amount_minor: 250050, amount: 2500.5 }))).toBe(250050);
    });

    it('falls back to legacy amount (naira) scaled to kobo', () => {
      expect(getEntryAmountMinor(charge({ amount_minor: undefined, amount: 2500.5 }))).toBe(250050);
    });

    it('accepts amount_minor as a numeric string', () => {
      expect(getEntryAmountMinor(charge({ amount_minor: '250050' as unknown as number }))).toBe(250050);
    });

    it('returns 0 for missing amounts', () => {
      expect(getEntryAmountMinor(charge({ amount_minor: undefined, amount: undefined }))).toBe(0);
    });
  });

  describe('entry classifiers (canonical + legacy)', () => {
    it('classifies CHARGE+DEBIT as a charge debit', () => {
      expect(isChargeEntry(charge())).toBe(true);
      expect(isPaymentCreditEntry(charge())).toBe(false);
    });

    it('classifies PAYMENT+CREDIT as a payment credit', () => {
      const entry = charge({ entry_type: 'PAYMENT', entry_direction: 'CREDIT' });
      expect(isPaymentCreditEntry(entry)).toBe(true);
      expect(isChargeEntry(entry)).toBe(false);
    });

    it('classifies REVERSAL+DEBIT as a reversal debit', () => {
      const entry = charge({ entry_type: 'REVERSAL', entry_direction: 'DEBIT' });
      expect(isReversalDebitEntry(entry)).toBe(true);
      expect(isPaymentCreditEntry(entry)).toBe(false);
    });

    it('maps legacy DEBIT rows to charges', () => {
      const entry = charge({ entry_type: 'DEBIT', entry_direction: undefined, amount_minor: undefined, amount: 50000 });
      expect(isChargeEntry(entry)).toBe(true);
      expect(getEntryAmountMinor(entry)).toBe(5_000_000);
    });

    it('maps legacy CREDIT rows to payment credits', () => {
      const entry = charge({ entry_type: 'CREDIT', entry_direction: undefined, amount_minor: undefined, amount: 25000 });
      expect(isPaymentCreditEntry(entry)).toBe(true);
      expect(isCollectedEntry(entry)).toBe(true);
    });
  });

  describe('summarizeLedger', () => {
    it('aggregates assessed / collected / outstanding in kobo', () => {
      const entries: LedgerRowLike[] = [
        charge({ id: 'e1', amount_minor: 200_000 }),             // assessed +20_000 naira
        charge({ id: 'e2', amount_minor: 400_000 }),             // assessed +40_000 naira
        charge({ id: 'e3', entry_type: 'PAYMENT', entry_direction: 'CREDIT', amount_minor: 150_000 }),
        charge({ id: 'e4', entry_type: 'REVERSAL', entry_direction: 'DEBIT', amount_minor: 50_000 }),
      ];
      const summary = summarizeLedger(entries);
      expect(summary.assessedMinor).toBe(600_000);
      expect(summary.collectedMinor).toBe(100_000); // 150,000 - 50,000
      expect(summary.outstandingMinor).toBe(500_000);
    });

    it('handles an empty ledger', () => {
      expect(summarizeLedger([])).toEqual({ assessedMinor: 0, collectedMinor: 0, outstandingMinor: 0 });
    });
  });

  describe('getEntryDate', () => {
    it('prefers occurred_at then posting_date then created_at', () => {
      expect(getEntryDate(charge({ occurred_at: '2026-09-12T10:00:00Z' }))).toBe('2026-09-12T10:00:00Z');
      expect(
        getEntryDate(charge({ occurred_at: undefined, posting_date: '2026-09-11T00:00:00Z' })),
      ).toBe('2026-09-11T00:00:00Z');
      expect(getEntryDate(charge({ occurred_at: undefined, posting_date: undefined, created_at: '2026-09-10T00:00:00Z' })))
        .toBe('2026-09-10T00:00:00Z');
    });
  });

  describe('formatNairaKobo', () => {
    it('formats integer kobo with a Naira symbol', () => {
      expect(formatNairaKobo(6_712_100_000)).toBe('₦67,121,000');
      expect(formatNairaKobo(0)).toBe('₦0');
    });
  });
});