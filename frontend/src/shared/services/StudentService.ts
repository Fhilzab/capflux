import { StudentRepository } from '../repositories/StudentRepository';
import { GuardianService } from './GuardianService';
import { TuitionConfigurationService } from './TuitionConfigurationService';
import { PaymentAccountRepository } from '../repositories/PaymentAccountRepository';
import { LedgerRepository } from '../repositories/LedgerRepository';
import { PaymentGateway } from './PaymentGateway';
import db from '../../offline/localDb';
import type { Student, StudentCategory, AcademicTerm, LedgerEntryCategory, Guardian, PaymentAccount, DVAResponse } from '../types/billing';

export const StudentService = {
  /**
   * Register a student with guardian linking, payment account provisioning, and tuition billing
   * Full workflow:
   * 1. Determine category
   * 2. Retrieve tuition from configuration
   * 3. Create student
   * 4. Create/Reuse guardian
   * 5. Create payment account via backend API
   * 6. Save payment account to local DB
   * 7. Generate DEBIT ledger entry for tuition
   */
  async registerStudentWithGuardian(school_id: string, studentData: {
    first_name: string;
    last_name: string;
    class_name: string;
    category: StudentCategory;
    academic_session: string;
    academic_term: AcademicTerm;
    guardian_full_name: string;
    guardian_phone: string;
    guardian_secondary_phone?: string;
    guardian_email?: string;
    relationship?: 'FATHER' | 'MOTHER' | 'GUARDIAN' | 'OTHER';
  }) {
    // Step 1 & 2: Get tuition configuration
    const tuitionConfig = await TuitionConfigurationService.getTuition(
      school_id,
      studentData.academic_session,
      studentData.academic_term,
      studentData.category
    );

    if (!tuitionConfig) {
      throw new Error('No tuition configured for this category/session/term. Please configure tuition first.');
    }

    // Step 3 & 4: Get or create guardian
    const guardian = await GuardianService.getOrCreateGuardian(school_id, {
      full_name: studentData.guardian_full_name,
      primary_phone: studentData.guardian_phone,
      secondary_phone: studentData.guardian_secondary_phone,
      email: studentData.guardian_email,
      relationship: studentData.relationship,
    });

    // Step 5: Create student linked to guardian
    const student = await StudentRepository.saveStudent({
      school_id,
      first_name: studentData.first_name,
      last_name: studentData.last_name,
      class_name: studentData.class_name,
      category: studentData.category,
      guardian_id: guardian.id,
      status: 'ACTIVE',
      client_sequence: 0,
      device_id: 'local-client',
    });

    // Step 6: Provision payment account via backend API
    let paymentAccount: PaymentAccount | undefined;
    try {
      const dvaResponse = await PaymentGateway.provisionDVA(student.id, school_id);
      if (dvaResponse?.dva || dvaResponse?.payment_account) {
        const dva = dvaResponse.dva || dvaResponse.payment_account;
        paymentAccount = await this.linkPaymentAccountFromDVA(student.id, dva);
      }
    } catch (error) {
      console.warn('Payment account provisioning failed:', error);
      // Continue without payment account - can be provisioned later
    }

    // Step 7: Generate tuition DEBIT ledger entry
    await LedgerRepository.createLedgerEntry({
      school_id,
      student_id: student.id,
      amount: tuitionConfig.tuition_amount,
      entry_type: 'DEBIT',
      entry_category: 'TUITION' as LedgerEntryCategory,
      entry_description: `Tuition for ${tuitionConfig.academic_session} - ${tuitionConfig.academic_term} term - ${tuitionConfig.category}`,
      metadata: {
        academic_session: tuitionConfig.academic_session,
        academic_term: tuitionConfig.academic_term,
        category: tuitionConfig.category,
        tuition_config_id: tuitionConfig.id,
      },
    });

    // Return the complete registration result
    return {
      student,
      guardian,
      tuition_config: tuitionConfig,
      payment_account: paymentAccount,
    };
  },

  /**
   * Link payment account from DVA response
   */
  async linkPaymentAccountFromDVA(student_id: string, dva: DVAResponse | PaymentAccount) {
    const student = await StudentRepository.getStudentById(student_id);
    if (!student) throw new Error('Student not found');

    // Extract values with proper null checks - DVAResponse uses dva_ prefixed fields
    const provider = dva.provider || 'monnify';
    const virtual_account_number = dva.dva_account_number || dva.virtual_account_number || '';
    const account_name = dva.dva_account_name || dva.account_name || '';
    const bank_name = dva.dva_bank_name || dva.bank_name || '';

    return PaymentAccountRepository.savePaymentAccount({
      school_id: student.school_id,
      student_id,
      provider: provider as 'monnify' | 'flutterwave' | 'remita',
      provider_account_id: dva.provider_account_id,
      provider_reference: dva.provider_ref || dva.provider_reference,
      virtual_account_number,
      account_name,
      bank_name,
      account_status: 'ACTIVE',
      is_primary: true,
    });
  },

  async saveStudent(student: Partial<Student>) {
    return StudentRepository.saveStudent(student);
  },

  async updateStudent(student_id: string, updates: Partial<Student>) {
    return StudentRepository.updateStudent(student_id, updates);
  },

  async archiveStudent(student_id: string, status: 'ACTIVE' | 'GRADUATED' | 'LEFT') {
    return StudentRepository.archiveStudent(student_id, status);
  },

  async getStudentsBySchool(school_id: string, includeArchived = false) {
    return StudentRepository.getStudentsBySchool(school_id, includeArchived);
  },

  async getStudentById(student_id: string): Promise<Student | undefined> {
    return StudentRepository.getStudentById(student_id);
  },

  async searchStudents(school_id: string, query: string, includeArchived = false) {
    return StudentRepository.searchStudents(school_id, query, includeArchived);
  },

  /**
   * Get students with their guardian info populated
   * Useful for views that need to display guardian data
   */
  async getStudentsWithGuardians(school_id: string, includeArchived = false) {
    const students = await this.getStudentsBySchool(school_id, includeArchived);
    
    // Fetch guardians for each student
    const guardianIds = [...new Set(students.map((s) => s.guardian_id).filter(Boolean))] as string[];
    
    const guardians = await db.guardians.where('id').anyOf(guardianIds).toArray();
    const guardianMap = new Map(guardians.map((g) => [g.id, g]));

    return students.map((student) => ({
      ...student,
      guardian: student.guardian_id ? guardianMap.get(student.guardian_id) : null,
    }));
  },

  /**
   * Link payment account to student
   */
  async linkPaymentAccount(
    student_id: string,
    account_data: {
      provider: 'monnify' | 'flutterwave' | 'remita';
      provider_account_id?: string;
      provider_reference?: string;
      virtual_account_number: string;
      account_name: string;
      bank_name: string;
    }
  ) {
    const student = await StudentRepository.getStudentById(student_id);
    if (!student) throw new Error('Student not found');

    return PaymentAccountRepository.savePaymentAccount({
      school_id: student.school_id,
      student_id,
      ...account_data,
      account_status: 'ACTIVE',
      is_primary: true,
    });
  },

  /**
   * Get payment account for a student
   */
  async getPaymentAccount(student_id: string) {
    return PaymentAccountRepository.getByStudent(student_id);
  },
};