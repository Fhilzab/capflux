import type { Fee } from '../fees/types';
import { academicService } from '../academic/AcademicService';
import { studentService } from '../students/StudentService';
import { feeService } from '../fees/FeeService';
import { BillingSnapshotBuilder } from './BillingSnapshot';
import { BillingValidator } from './BillingValidator';
import type {
  BillingProfile,
  StudentCharge,
  BillingSnapshot,
  BillingResult,
  ChargeSource,
  ChargeStatus,
  BillingInitializationStatus,
} from './types';
import type { Student } from '../students/types';
import type { AcademicSession, AcademicTerm } from '../academic/types';

const BILLING_VERSION = 1;

export class BillingEngine {
  static async initializeStudentBilling(
    studentId: string,
    existingProfile: BillingProfile | null = null,
    schoolId?: string,
  ): Promise<BillingResult<{ profile: BillingProfile; charges: StudentCharge[] }>> {
    try {
      // 1. Load student
      const studentResult = await studentService.loadStudents(schoolId || '');
      const students = studentResult.data || [];
      const student = students.find(s => s.id === studentId);
      if (!student) {
        return {
          data: null,
          error: {
            code: 'BILLING_PROFILE_NOT_FOUND',
            message: 'Student not found',
          },
        };
      }

      const schoolIdFromStudent = student.schoolId;
      const divisionId = student.divisionId;

      // 2. Resolve academic context via AcademicService
      const sessionResult = await academicService.getCurrentSession(schoolIdFromStudent);
      const termResult = await academicService.getCurrentTerm(schoolIdFromStudent);

      if (sessionResult.error || !sessionResult.data || termResult.error || !termResult.data) {
        return {
          data: null,
          error: {
            code: 'SESSION_NOT_ACTIVE',
            message: 'No active academic session or term found',
          },
        };
      }

      const session = sessionResult.data as AcademicSession;
      const term = termResult.data as AcademicTerm;

      // 3. Find or create BillingProfile (per student + session)
      if (!existingProfile) {
        return {
          data: null,
          error: {
            code: 'BILLING_PROFILE_NOT_FOUND',
            message: 'Billing profile is required. Create one first.',
          },
        };
      }

      // 4. Get applicable fees
      const applicableResult = await feeService.getApplicableFees(schoolIdFromStudent, divisionId);
      if (applicableResult.error) {
        return {
          data: null,
          error: {
            code: 'UNKNOWN',
            message: applicableResult.error.message,
          },
        };
      }

      const mandatoryFees = applicableResult.data?.mandatory || [];
      const platformFees = applicableResult.data?.platform || [];
      const feesToAssign = [...mandatoryFees, ...platformFees];

      // 5. Create charges for each fee (idempotent)
      const createdCharges: StudentCharge[] = [];

      for (const fee of feesToAssign) {
        const snapshot = BillingSnapshotBuilder.create({
          fee,
          amount: fee.amount || 0,
          studentId: student.id,
          session,
          term,
          discountApplied: existingProfile.discountRate,
          billingVersion: BILLING_VERSION,
        });

        const chargeStatus: ChargeStatus = 'ACTIVE';
        const chargeSource: ChargeSource = fee.owner === 'PLATFORM' ? 'PLATFORM' : 'MANDATORY';

        const validation = BillingValidator.validateStudentCharge({
          billingProfileId: existingProfile.id,
          snapshotId: snapshot.id,
          studentId: student.id,
          academicSessionId: session.id,
          academicTermId: term.id,
          chargeSource,
          status: chargeStatus,
        });

        if (!validation.valid) {
          continue;
        }

        createdCharges.push({
          id: '',
          billingProfileId: existingProfile.id,
          snapshotId: snapshot.id,
          studentId: student.id,
          academicSessionId: session.id,
          academicTermId: term.id,
          chargeSource,
          status: chargeStatus,
          ledgerLocked: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      return {
        data: {
          profile: existingProfile,
          charges: createdCharges,
        },
        error: null,
      };
    } catch (e: any) {
      return {
        data: null,
        error: {
          code: 'UNKNOWN',
          message: e?.message || 'Failed to initialize student billing',
        },
      };
    }
  }

  static async rebuildStudentBilling(_studentId: string): Promise<BillingResult<void>> {
    return { data: null, error: { code: 'UNKNOWN', message: 'Not implemented' } };
  }

  static async rebuildDivisionBilling(_schoolId: string, _divisionId: string): Promise<BillingResult<void>> {
    return { data: null, error: { code: 'UNKNOWN', message: 'Not implemented' } };
  }

  static async rebuildSchoolBilling(_schoolId: string): Promise<BillingResult<void>> {
    return { data: null, error: { code: 'UNKNOWN', message: 'Not implemented' } };
  }

  static async rollForwardTerm(_billingCycle: 'TERM' | 'SEMESTER' | 'SESSION'): Promise<BillingResult<void>> {
    return { data: null, error: { code: 'UNKNOWN', message: 'Not implemented' } };
  }

  static async rollForwardSession(_sessionId: string): Promise<BillingResult<void>> {
    return { data: null, error: { code: 'UNKNOWN', message: 'Not implemented' } };
  }
}