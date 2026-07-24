import { BillingEngine } from './BillingEngine';
import type { BillingProfile, StudentCharge, BillingResult } from './types';

export class BillingService {
  async initializeStudentBilling(studentId: string, profile: BillingProfile): Promise<BillingResult<{ profile: BillingProfile; charges: StudentCharge[] }>> {
    return BillingEngine.initializeStudentBilling(studentId, profile);
  }

  async rebuildStudentBilling(studentId: string): Promise<BillingResult<void>> {
    return BillingEngine.rebuildStudentBilling(studentId);
  }

  async rebuildDivisionBilling(schoolId: string, divisionId: string): Promise<BillingResult<void>> {
    return BillingEngine.rebuildDivisionBilling(schoolId, divisionId);
  }

  async rebuildSchoolBilling(schoolId: string): Promise<BillingResult<void>> {
    return BillingEngine.rebuildSchoolBilling(schoolId);
  }

  async rollForwardTerm(billingCycle: 'TERM' | 'SEMESTER' | 'SESSION'): Promise<BillingResult<void>> {
    return BillingEngine.rollForwardTerm(billingCycle);
  }

  async rollForwardSession(sessionId: string): Promise<BillingResult<void>> {
    return BillingEngine.rollForwardSession(sessionId);
  }
}

export const billingService = new BillingService();