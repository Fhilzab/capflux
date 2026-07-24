/**
 * AdmissionNumberGenerator
 * Generates admission numbers for students when school uses AUTO mode
 * Format: {prefix}-{year}-{sequence} or {year}-{sequence}
 */

import type { SchoolAdmissionSettings } from '../school/types';

export interface GeneratedAdmissionNumber {
  number: string;
  sequence: number;
}

export class AdmissionNumberGenerator {
  /**
   * Generate the next admission number based on school settings
   */
  static generate(settings: SchoolAdmissionSettings): GeneratedAdmissionNumber {
    const year = new Date().getFullYear();
    const sequence = settings.currentSequence + 1;

    let number: string;
    if (settings.prefix) {
      number = `${settings.prefix}-${year}-${String(sequence).padStart(4, '0')}`;
    } else {
      number = `${year}-${String(sequence).padStart(4, '0')}`;
    }

    return {
      number,
      sequence,
    };
  }

  /**
   * Parse an admission number to extract sequence
   */
  static parseSequence(admissionNumber: string): number {
    const parts = admissionNumber.split('-');
    const lastPart = parts[parts.length - 1];
    const seq = parseInt(lastPart, 10);
    return isNaN(seq) ? 0 : seq;
  }
}