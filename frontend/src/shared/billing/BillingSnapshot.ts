import type { Fee } from '../fees/types';
import type { AcademicSession, AcademicTerm } from '../academic/types';

export interface CreateSnapshotInput {
  fee: Fee;
  amount: number;                // fee amount at time of billing
  studentId: string;
  session: AcademicSession;
  term: AcademicTerm;
  discountApplied: number;
  billingVersion: number;
}

export interface BillingSnapshot {
  id: string;
  feeId: string;
  feeName: string;
  feeCode: string;
  amount: number;
  currency: string;
  owner: 'SCHOOL' | 'PLATFORM';
  isMandatory: boolean;
  divisionId: string;
  academicSessionId: string;
  academicTermId: string;
  discountApplied: number;
  netAmount: number;
  billingVersion: number;         // starts at 1 — future-proof for algorithm changes
  createdAt: string;
}

export class BillingSnapshotBuilder {
  static create(input: CreateSnapshotInput): BillingSnapshot {
    const netAmount = input.amount - input.discountApplied;
    return {
      id: crypto.randomUUID(),
      feeId: input.fee.id,
      feeName: input.fee.name,
      feeCode: input.fee.code,
      amount: input.amount,
      currency: 'NGN',
      owner: input.fee.owner,
      isMandatory: input.fee.isMandatory,
      divisionId: input.fee.divisionId ?? '',
      academicSessionId: input.session.id,
      academicTermId: input.term.id,
      discountApplied: input.discountApplied,
      netAmount: netAmount >= 0 ? netAmount : 0,
      billingVersion: input.billingVersion,
      createdAt: new Date().toISOString(),
    };
  }

  static fromSnapshot(snapshot: BillingSnapshot): BillingSnapshot {
    return { ...snapshot };
  }
}