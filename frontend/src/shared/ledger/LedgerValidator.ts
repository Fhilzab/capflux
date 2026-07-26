export interface LedgerValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

export class LedgerValidator {
  static validateEntry(input: {
    entryDirection: string;
    amountMinor: number;
    sourceDocumentType: string;
    sourceDocumentId: string;
    entryType: string;
    organizationId: string;
    schoolId: string;
    studentId: string;
  }): LedgerValidationResult {
    const errors: Record<string, string> = {};

    if (!['DEBIT', 'CREDIT'].includes(input.entryDirection)) {
      errors.entryDirection = 'Entry direction must be DEBIT or CREDIT';
    }
    if (input.amountMinor <= 0) {
      errors.amountMinor = 'Amount must be greater than zero';
    }
    if (!['PAYMENT', 'CHARGE', 'REFUND', 'WAIVER', 'ADJUSTMENT'].includes(input.sourceDocumentType)) {
      errors.sourceDocumentType = 'Invalid source document type';
    }
    if (!input.sourceDocumentId) {
      errors.sourceDocumentId = 'Source document ID is required';
    }
    if (!['CHARGE', 'PAYMENT', 'WAIVER', 'REVERSAL', 'REFUND', 'ADJUSTMENT'].includes(input.entryType)) {
      errors.entryType = 'Invalid entry type';
    }
    if (!input.organizationId) {
      errors.organizationId = 'Organization is required';
    }
    if (!input.schoolId) {
      errors.schoolId = 'School is required';
    }
    if (!input.studentId) {
      errors.studentId = 'Student is required';
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors,
    };
  }

  static validateReversal(input: {
    originalEntryId: string;
    reason: string;
  }): LedgerValidationResult {
    const errors: Record<string, string> = {};

    if (!input.originalEntryId) {
      errors.originalEntryId = 'Original entry ID is required';
    }
    if (!input.reason) {
      errors.reason = 'Reversal reason is required';
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors,
    };
  }

  static validateHashChain(previousEntryHash: string | undefined, computedHash: string): LedgerValidationResult {
    const errors: Record<string, string> = {};

    if (previousEntryHash && previousEntryHash !== computedHash) {
      errors.hashChain = 'Hash chain integrity check failed. Previous entry hash does not match.';
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors,
    };
  }
}