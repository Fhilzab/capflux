export interface JournalValidationInput {
  lines: { accountCode: string; direction: 'DEBIT' | 'CREDIT'; amountMinor: number }[];
}

export interface JournalValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

export interface ReversalValidationInput {
  originalJournalId: string;
  reason: string;
}

export class AccountingValidator {
  /**
   * Validate that a journal is balanced:
   * total debits == total credits
   */
  static validateJournal(input: JournalValidationInput): JournalValidationResult {
    const errors: Record<string, string> = {};

    if (!input.lines || input.lines.length === 0) {
      errors.journal = 'Journal must have at least one line';
      return { valid: false, errors };
    }

    const totalDebits = input.lines
      .filter(l => l.direction === 'DEBIT')
      .reduce((sum, l) => sum + l.amountMinor, 0);

    const totalCredits = input.lines
      .filter(l => l.direction === 'CREDIT')
      .reduce((sum, l) => sum + l.amountMinor, 0);

    if (totalDebits !== totalCredits) {
      errors.journal = `Journal is not balanced. Debits: ${totalDebits}, Credits: ${totalCredits}`;
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors,
    };
  }

  /**
   * Validate reversal input.
   */
  static validateReversal(input: ReversalValidationInput): JournalValidationResult {
    const errors: Record<string, string> = {};

    if (!input.originalJournalId) {
      errors.originalJournalId = 'Original journal ID is required';
    }
    if (!input.reason) {
      errors.reason = 'Reversal reason is required';
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors,
    };
  }
}