import { StudentRepository } from '../repositories/StudentRepository';
import { GuardianService } from './GuardianService';
import { TuitionConfigurationService } from './TuitionConfigurationService';
import { PaymentAccountRepository } from '../repositories/PaymentAccountRepository';
import { LedgerRepository } from '../repositories/LedgerRepository';
import db from '../offline/localDb';
import type { Student, StudentCategory, AcademicTerm, LedgerEntryCategory, Guardian } from '../types/billing';

export const StudentService = {
  /**
   * Register a student with guardian linking, DVA provisioning, and tuition billing
   * Full workflow:
   * 1. Determine category
   * 2. Retrieve tuition from configuration
   * 3. Create student
   * 4. Create/Reuse guardian
   * 5. Create DVA via PaymentGateway
   * 6. Generate DEBIT ledger entry for tuition
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

    // Step 6: Create payment account (DVA) - to be done after gateway call
    // The DVA will be created via the backend API when provisioning

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
    };
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
      provider_name: 'monnify' | 'flutterwave' | 'remita';
      account_number: string;
      bank_name: string;
      account_reference: string;
      provider_student_reference?: string;
    }
  ) {
    const student = await StudentRepository.getStudentById(student_id);
    if (!student) throw new Error('Student not found');

    return PaymentAccountRepository.savePaymentAccount({
      school_id: student.school_id,
      student_id,
      ...account_data,
    });
  },

  /**
   * Get payment account for a student
   */
  async getPaymentAccount(student_id: string) {
    return PaymentAccountRepository.getByStudent(student_id);
  },
};