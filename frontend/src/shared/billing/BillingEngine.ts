import type { Fee } from '../fees/types';
import { academicService } from '../academic/AcademicService';
import { studentService } from '../students/StudentService';
import { feeService } from '../fees/FeeService';
import { EnrollmentService } from '../enrollment/EnrollmentService';
import { BillingSnapshotBuilder } from './BillingSnapshot';
import { BillingValidator } from './BillingValidator';
import { accountingService } from '../accounting/AccountingService';
import type {
  BillingProfile,
  StudentCharge,
  BillingResult,
  ChargeSource,
  ChargeStatus,
} from './types';
import type { AcademicSession, AcademicTerm } from '../academic/types';
import { auditService } from '../audit/AuditService';
import { notificationService } from '../notifications/NotificationService';
import { generateUuidV7 } from '../core/IdGenerator';
import { createAuditContext } from '../audit/AuditContext';

const BILLING_VERSION = 1;

export class BillingEngine {
  static async initializeStudentBilling(
    studentId: string,
    existingProfile: BillingProfile | null = null,
    schoolId?: string,
  ): Promise<BillingResult<{ profile: BillingProfile; charges: StudentCharge[] }>> {
    try {
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
      // Placement comes from the enrollment record (section + level); the
      // legacy student.divisionId is only a fallback for un-migrated students.
      // Historical charges/payments are never touched by this resolution.
      let divisionId = student.divisionId;
      let academicLevelId: string | null = null;
      try {
        const enrollment = await EnrollmentService.getActiveEnrollment(studentId);
        if (enrollment) {
          divisionId = enrollment.section_id;
          academicLevelId = enrollment.level_id;
        }
      } catch {
        // No local enrollment — fall back to legacy division pointer.
      }

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

      if (!existingProfile) {
        return {
          data: null,
          error: {
            code: 'BILLING_PROFILE_NOT_FOUND',
            message: 'Billing profile is required. Create one first.',
          },
        };
      }

      const applicableResult = await feeService.getApplicableFees(schoolIdFromStudent, divisionId, academicLevelId);
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

      const createdCharges: StudentCharge[] = [];

      for (const fee of feesToAssign) {
        const feeAmount = 0;
        const snapshot = BillingSnapshotBuilder.create({
          fee,
          amount: feeAmount,
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

        const sourceDocumentId = snapshot.id;

        const charge: StudentCharge = {
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
        };

        createdCharges.push(charge);

        // Create accounting journal for this student charge
        const netAmountMinor = Math.round((snapshot.netAmount || 0) * 100);
        const journalResult = await accountingService.createChargeJournal({
          organizationId: student.schoolId,
          schoolId: student.schoolId,
          transactionGroupId: existingProfile.id,
          sourceDocumentType: 'CHARGE',
          sourceDocumentId,
          description: `Fee: ${fee.name}`,
          amountMinor: netAmountMinor,
          currency: 'NGN',
          occurredAt: new Date().toISOString(),
        });

        if (journalResult.error) {
          return {
            data: null,
            error: {
              code: 'UNKNOWN',
              message: journalResult.error.message,
            },
          };
        }

        if (journalResult.data) {
          const { JournalPoster } = await import('../accounting/JournalPoster');
          const postResult = await JournalPoster.postJournal(journalResult.data, null);

          if (postResult.error) {
            return {
              data: null,
              error: {
                code: 'UNKNOWN',
                message: postResult.error.message,
              },
            };
          }
        }
      }

      // Generate a correlation ID shared across audit and notification.
      const billingCorrelationId = generateUuidV7();

      // Fire-and-forget: audit the successful billing generation.
      // Audit failure must never block the financial transaction.
      void auditService.recordBilling({
        organizationId: schoolIdFromStudent,
        schoolId: schoolIdFromStudent,
        entityId: existingProfile.id,
        description: `Billing generated for student ${studentId}: ${createdCharges.length} charges created`,
        context: createAuditContext('BILLING', {
          correlationId: billingCorrelationId,
        }),
        metadata: {
          studentId,
          billingProfileId: existingProfile.id,
          chargeCount: createdCharges.length,
          session: session.id,
          term: term.id,
        },
      });

      // Fire-and-forget: notify stakeholders of billing generation.
      // Notification failure must never block the financial transaction.
      // Reuses the same correlation ID as audit for traceability.
      void notificationService.sendBillingCreated({
        organizationId: schoolIdFromStudent,
        schoolId: schoolIdFromStudent,
        studentId,
        billingProfileId: existingProfile.id,
        correlationId: billingCorrelationId,
        variables: {
          studentName: studentId,
          amount: '0',
          term: term.id,
        },
        channels: ['EMAIL', 'SMS', 'IN_APP'],
        metadata: {
          billingProfileId: existingProfile.id,
          chargeCount: createdCharges.length,
        },
      });

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

  /**
   * Lock a student charge after successful payment allocation.
   * - Sets ledgerLocked to true
   * - Updates status to PAID or PARTIALLY_PAID
   * - Called by PaymentEngine after allocation succeeds
   */
  static async lockCharge(
    charge: StudentCharge,
    allocatedAmount: number,
    netAmount: number,
  ): Promise<BillingResult<StudentCharge>> {
    try {
      if (charge.ledgerLocked) {
        return {
          data: null,
          error: {
            code: 'CHARGE_LEDGER_LOCKED',
            message: 'This charge is already locked and cannot be modified.',
          },
        };
      }

      const isPaid = allocatedAmount >= netAmount;
      const newStatus: ChargeStatus = isPaid ? 'PAID' : 'PARTIALLY_PAID';

      const updatedCharge: StudentCharge = {
        ...charge,
        status: newStatus,
        ledgerLocked: true,
        updatedAt: new Date().toISOString(),
      };

      return {
        data: updatedCharge,
        error: null,
      };
    } catch (e: any) {
      return {
        data: null,
        error: {
          code: 'STUDENT_CHARGE_UPDATE_FAILED',
          message: e?.message || 'Failed to lock charge',
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
