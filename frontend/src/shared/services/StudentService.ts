import { studentService } from '../students/StudentService';
import { GuardianService } from './GuardianService';
import { TuitionConfigurationService } from './TuitionConfigurationService';
import { PaymentAccountRepository } from '../repositories/PaymentAccountRepository';
import { LedgerRepository } from '../repositories/LedgerRepository';
import { PaymentGateway } from './PaymentGateway';
import db from '../../offline/localDb';
import { rbacService } from '../rbac/RBACService';
import { PERMISSIONS } from '../rbac/permissions';

/**
 * @deprecated
 * Compatibility adapter.
 *
 * Scheduled removal after Phase 2 frontend migration.
 *
 * Delegates to the new domain StudentService at:
 *   shared/students/StudentService.ts
 *
 * No business logic remains in this file.
 */

export const StudentService = {
  /**
   * @deprecated Use studentStore or the new studentService.
   */
  async registerStudentWithGuardian(school_id: string, studentData: {
    first_name: string;
    last_name: string;
    class_name: string;
    category: string;
    academic_session: string;
    academic_term: string;
    guardian_full_name: string;
    guardian_phone: string;
    guardian_secondary_phone?: string;
    guardian_email?: string;
    relationship?: 'FATHER' | 'MOTHER' | 'GUARDIAN' | 'OTHER';
  }) {
    // Assert permission to create students
    await rbacService.assertCan(PERMISSIONS.STUDENT.CREATE);

    const tuitionConfig = await TuitionConfigurationService.getTuition(
      school_id,
      studentData.academic_session,
      studentData.academic_term,
      studentData.category
    );

    if (!tuitionConfig) {
      throw new Error('No tuition configured for this category/session/term. Please configure tuition first.');
    }

    const guardian = await GuardianService.getOrCreateGuardian(school_id, {
      full_name: studentData.guardian_full_name,
      primary_phone: studentData.guardian_phone,
      secondary_phone: studentData.guardian_secondary_phone,
      email: studentData.guardian_email,
      relationship: studentData.relationship,
    });

    const student = await studentService.createStudent({
      schoolId: school_id,
      divisionId: '',
      guardianId: guardian.id,
      firstName: studentData.first_name,
      lastName: studentData.last_name,
      gender: '',
      admissionDate: new Date().toISOString(),
      registeredAt: new Date().toISOString(),
      relationshipToGuardian: studentData.relationship || 'GUARDIAN',
      discountRate: 0,
    });

    let paymentAccount;
    try {
      const dvaResponse = await PaymentGateway.provisionDVA(student.data?.id || '', school_id);
      if (dvaResponse?.dva || dvaResponse?.payment_account) {
        const dva = dvaResponse.dva || dvaResponse.payment_account;
        const provider = dva.provider || 'monnify';
        const virtual_account_number = dva.dva_account_number || dva.virtual_account_number || '';
        const account_name = dva.dva_account_name || dva.account_name || '';
        const bank_name = dva.dva_bank_name || dva.bank_name || '';

        paymentAccount = await PaymentAccountRepository.savePaymentAccount({
          school_id,
          student_id: student.data?.id || '',
          provider: provider as 'monnify' | 'flutterwave' | 'remita',
          provider_account_id: dva.provider_account_id,
          provider_reference: dva.provider_ref || dva.provider_reference,
          virtual_account_number,
          account_name,
          bank_name,
          account_status: 'ACTIVE',
          is_primary: true,
        });
      }
    } catch (error) {
      console.warn('Payment account provisioning failed:', error);
    }

    if (student.data?.id) {
      await LedgerRepository.createLedgerEntry({
        school_id,
        student_id: student.data?.id,
        amount: tuitionConfig.tuition_amount,
        entry_type: 'DEBIT',
        entry_category: 'TUITION',
        entry_description: `Tuition for ${tuitionConfig.academic_session} - ${tuitionConfig.academic_term} term - ${tuitionConfig.category}`,
        metadata: {
          academic_session: tuitionConfig.academic_session,
          academic_term: tuitionConfig.academic_term,
          category: tuitionConfig.category,
          tuition_config_id: tuitionConfig.id,
        },
      });
    }

    return {
      student: student.data,
      guardian,
      tuition_config: tuitionConfig,
      payment_account: paymentAccount,
    };
  },

  /**
   * @deprecated Use studentStore or the new studentService.
   */
  async linkPaymentAccountFromDVA(student_id: string, dva: any) {
    const student = await studentService.loadStudents('');
    if (!student.data) throw new Error('Student not found');

    return PaymentAccountRepository.savePaymentAccount({
      school_id: '',
      student_id,
      provider: dva.provider || 'monnify',
      provider_account_id: dva.provider_account_id,
      provider_reference: dva.provider_ref || dva.provider_reference,
      virtual_account_number: dva.dva_account_number || dva.virtual_account_number || '',
      account_name: dva.dva_account_name || dva.account_name || '',
      bank_name: dva.dva_bank_name || dva.bank_name || '',
      account_status: 'ACTIVE',
      is_primary: true,
    });
  },

  /**
   * @deprecated Use studentStore or the new studentService.
   */
  async saveStudent(student: any) {
    return studentService.createStudent(student);
  },

  /**
   * @deprecated Use studentStore or the new studentService.
   */
  async updateStudent(student_id: string, updates: any) {
    return studentService.updateStudent(student_id, updates);
  },

  /**
   * @deprecated Use studentStore or the new studentService.
   */
  async archiveStudent(student_id: string, status: 'ACTIVE' | 'GRADUATED' | 'LEFT') {
    if (status === 'ACTIVE') {
      return studentService.activateStudent(student_id);
    }
    return studentService.deactivateStudent(student_id);
  },

  /**
   * @deprecated Use studentStore or the new studentService.
   */
  async getStudentsBySchool(school_id: string, includeArchived = false) {
    const result = await studentService.loadStudents(school_id);
    if (result.error) {
      return [];
    }
    return result.data || [];
  },

  /**
   * @deprecated Use studentStore or the new studentService.
   */
  async getStudentById(student_id: string) {
    const result = await studentService.loadStudents('');
    return result.data?.find((s: any) => s.id === student_id);
  },

  /**
   * @deprecated Use studentStore or the new studentService.
   */
  async searchStudents(school_id: string, query: string, includeArchived = false) {
    return studentService.searchStudents(school_id, query);
  },

  /**
   * @deprecated Use studentStore or the new studentService.
   */
  async getStudentsWithGuardians(school_id: string, includeArchived = false) {
    const students = await this.getStudentsBySchool(school_id, includeArchived);

    const guardianIds = [...new Set(students.map((s: any) => s.guardian_id).filter(Boolean))] as string[];

    const guardians = await db.guardians.where('id').anyOf(guardianIds).toArray();
    const guardianMap = new Map(guardians.map((g) => [g.id, g]));

    return students.map((student: any) => ({
      ...student,
      guardian: student.guardian_id ? guardianMap.get(student.guardian_id) : null,
    }));
  },

  /**
   * @deprecated Use studentStore or the new studentService.
   */
  async linkPaymentAccount(student_id: string, account_data: any) {
    const student = await this.getStudentById(student_id);
    if (!student) throw new Error('Student not found');

    return PaymentAccountRepository.savePaymentAccount({
      school_id: '',
      student_id,
      ...account_data,
      account_status: 'ACTIVE',
      is_primary: true,
    });
  },

  /**
   * @deprecated Use studentStore or the new studentService.
   */
  async getPaymentAccount(student_id: string) {
    return PaymentAccountRepository.getByStudent(student_id);
  },
};