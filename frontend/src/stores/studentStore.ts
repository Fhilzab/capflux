import { defineStore } from 'pinia';
import { studentService } from '../shared/students/StudentService';
import { GuardianService } from '../shared/services/GuardianService';
import { TuitionConfigurationService } from '../shared/services/TuitionConfigurationService';
import { PaymentAccountRepository } from '../shared/repositories/PaymentAccountRepository';
import { LedgerRepository } from '../shared/repositories/LedgerRepository';
import { PaymentGateway } from '../shared/services/PaymentGateway';
import db from '../offline/localDb';
import type { Student, Guardian } from '../shared/students/types';
import { useSchoolStore } from './schoolStore';

export const useStudentStore = defineStore('student', {
  state: () => ({
    students: [] as Student[],
    guardians: [] as Guardian[],
    loading: false as boolean,
    initialized: false as boolean,
    error: null as string | null,
  }),
  getters: {
    activeStudents: (state): Student[] => state.students.filter(s => s.status === 'ACTIVE'),
    studentsByDivision: (state): Record<string, Student[]> => {
      const map: Record<string, Student[]> = {};
      for (const student of state.students) {
        if (!map[student.divisionId]) map[student.divisionId] = [];
        map[student.divisionId].push(student);
      }
      return map;
    },
    studentsByGuardian: (state): Record<string, Student[]> => {
      const map: Record<string, Student[]> = {};
      for (const student of state.students) {
        if (!map[student.guardianId]) map[student.guardianId] = [];
        map[student.guardianId].push(student);
      }
      return map;
    },
    studentCount: (state): number => state.students.length,
    guardianCount: (state): number => state.guardians.length,
  },
  actions: {
    async initialize() {
      this.loading = true;
      this.error = null;

      try {
        const schoolStore = useSchoolStore();
        const schoolId = schoolStore.currentSchoolId;

        if (schoolId) {
          const studentResult = await studentService.loadStudents(schoolId);
          if (studentResult.error) {
            this.error = studentResult.error.message;
            this.students = [];
          } else {
            this.students = studentResult.data || [];
          }

          const guardianResult = await studentService.loadGuardians(schoolId);
          if (guardianResult.error) {
            this.error = guardianResult.error.message;
            this.guardians = [];
          } else {
            this.guardians = guardianResult.data || [];
          }
        } else {
          this.students = [];
          this.guardians = [];
        }
      } catch (e: any) {
        this.error = e?.message || 'Failed to load students and guardians';
        this.students = [];
        this.guardians = [];
      } finally {
        this.loading = false;
        this.initialized = true;
      }
    },

    async loadStudents() {
      this.loading = true;
      this.error = null;

      try {
        const schoolStore = useSchoolStore();
        const schoolId = schoolStore.currentSchoolId;

        if (!schoolId) {
          this.students = [];
          return;
        }

        const result = await studentService.loadStudents(schoolId);
        if (result.error) {
          this.error = result.error.message;
          this.students = [];
        } else {
          this.students = result.data || [];
        }
      } catch (e: any) {
        this.error = e?.message || 'Failed to load students';
        this.students = [];
      } finally {
        this.loading = false;
      }
    },

    async loadGuardians() {
      this.loading = true;
      this.error = null;

      try {
        const schoolStore = useSchoolStore();
        const schoolId = schoolStore.currentSchoolId;

        if (!schoolId) {
          this.guardians = [];
          return;
        }

        const result = await studentService.loadGuardians(schoolId);
        if (result.error) {
          this.error = result.error.message;
          this.guardians = [];
        } else {
          this.guardians = result.data || [];
        }
      } catch (e: any) {
        this.error = e?.message || 'Failed to load guardians';
        this.guardians = [];
      } finally {
        this.loading = false;
      }
    },

    async createStudent(data: {
      schoolId: string;
      divisionId: string;
      guardianId: string;
      firstName: string;
      lastName: string;
      middleName?: string;
      gender: string;
      dateOfBirth?: string;
      admissionNumber?: string;
      admissionDate: string;
      registeredAt: string;
      relationshipToGuardian: string;
      discountRate: number;
    }) {
      this.loading = true;
      this.error = null;

      try {
        const result = await studentService.createStudent(data);

        if (result.error) {
          this.error = result.error.message;
          return false;
        }

        if (result.data) {
          this.students.push(result.data);
        }
        return true;
      } catch (e: any) {
        this.error = e?.message || 'Failed to create student';
        return false;
      } finally {
        this.loading = false;
      }
    },

    async updateStudent(studentId: string, data: Partial<Student>) {
      this.loading = true;
      this.error = null;

      try {
        const result = await studentService.updateStudent(studentId, data);

        if (result.error) {
          this.error = result.error.message;
          return false;
        }

        const idx = this.students.findIndex(s => s.id === studentId);
        if (idx >= 0 && result.data) {
          this.students[idx] = result.data;
        }
        return true;
      } catch (e: any) {
        this.error = e?.message || 'Failed to update student';
        return false;
      } finally {
        this.loading = false;
      }
    },

    async createGuardian(data: {
      schoolId: string;
      fullName: string;
      phone: string;
      email?: string;
      occupation?: string;
      address?: string;
    }) {
      this.loading = true;
      this.error = null;

      try {
        const result = await studentService.createGuardian(data);

        if (result.error) {
          this.error = result.error.message;
          return false;
        }

        if (result.data) {
          this.guardians.push(result.data);
        }
        return true;
      } catch (e: any) {
        this.error = e?.message || 'Failed to create guardian';
        return false;
      } finally {
        this.loading = false;
      }
    },

    async updateGuardian(guardianId: string, data: Partial<Guardian>) {
      this.loading = true;
      this.error = null;

      try {
        const result = await studentService.updateGuardian(guardianId, data);

        if (result.error) {
          this.error = result.error.message;
          return false;
        }

        const idx = this.guardians.findIndex(g => g.id === guardianId);
        if (idx >= 0 && result.data) {
          this.guardians[idx] = result.data;
        }
        return true;
      } catch (e: any) {
        this.error = e?.message || 'Failed to update guardian';
        return false;
      } finally {
        this.loading = false;
      }
    },

    async activateStudent(studentId: string) {
      this.loading = true;
      this.error = null;

      try {
        const result = await studentService.activateStudent(studentId);

        if (result.error) {
          this.error = result.error.message;
          return false;
        }

        const idx = this.students.findIndex(s => s.id === studentId);
        if (idx >= 0 && result.data) {
          this.students[idx] = result.data;
        }
        return true;
      } catch (e: any) {
        this.error = e?.message || 'Failed to activate student';
        return false;
      } finally {
        this.loading = false;
      }
    },

    async deactivateStudent(studentId: string) {
      this.loading = true;
      this.error = null;

      try {
        const result = await studentService.deactivateStudent(studentId);

        if (result.error) {
          this.error = result.error.message;
          return false;
        }

        const idx = this.students.findIndex(s => s.id === studentId);
        if (idx >= 0 && result.data) {
          this.students[idx] = result.data;
        }
        return true;
      } catch (e: any) {
        this.error = e?.message || 'Failed to deactivate student';
        return false;
      } finally {
        this.loading = false;
      }
    },

    /**
     * Search students by name within a school.
     * Delegates to studentService.
     */
    async searchStudents(schoolId: string, query: string): Promise<Student[]> {
      this.loading = true;
      this.error = null;

      try {
        const result = await studentService.searchStudents(schoolId, query);
        if (result.error) {
          this.error = result.error.message;
          return [];
        }
        return result.data || [];
      } catch (e: any) {
        this.error = e?.message || 'Failed to search students';
        return [];
      } finally {
        this.loading = false;
      }
    },

    /**
     * Get students with their guardian information attached.
     * Delegates to studentService and local DB for guardian lookup.
     */
    async getStudentsWithGuardians(schoolId: string, includeArchived = false): Promise<any[]> {
      this.loading = true;
      this.error = null;

      try {
        const result = await studentService.loadStudents(schoolId);
        if (result.error) {
          this.error = result.error.message;
          return [];
        }

        const students = result.data || [];
        const guardianIds = [...new Set(students.map((s: any) => s.guardianId || s.guardian_id).filter(Boolean))] as string[];

        const guardians = await db.guardians.where('id').anyOf(guardianIds).toArray();
        const guardianMap = new Map(guardians.map((g) => [g.id, g]));

        return students.map((student: any) => ({
          ...student,
          first_name: student.firstName || student.first_name,
          last_name: student.lastName || student.last_name,
          class_name: student.className || student.class_name,
          guardian_id: student.guardianId || student.guardian_id,
          guardian: (student.guardianId || student.guardian_id) ? guardianMap.get(student.guardianId || student.guardian_id) : null,
        }));
      } catch (e: any) {
        this.error = e?.message || 'Failed to load students with guardians';
        return [];
      } finally {
        this.loading = false;
      }
    },

    /**
     * Register a student with guardian, tuition, and payment account.
     * Delegates to GuardianService, studentService, PaymentGateway, and LedgerRepository.
     */
    async registerStudentWithGuardian(schoolId: string, studentData: {
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
    }): Promise<any> {
      this.loading = true;
      this.error = null;

      try {
        const tuitionConfig = await TuitionConfigurationService.getTuition(
          schoolId,
          studentData.academic_session,
          studentData.academic_term,
          studentData.category
        );

        if (!tuitionConfig) {
          throw new Error('No tuition configured for this category/session/term. Please configure tuition first.');
        }

        const guardian = await GuardianService.getOrCreateGuardian(schoolId, {
          full_name: studentData.guardian_full_name,
          primary_phone: studentData.guardian_phone,
          secondary_phone: studentData.guardian_secondary_phone,
          email: studentData.guardian_email,
          relationship: studentData.relationship,
        });

        const student = await studentService.createStudent({
          schoolId: schoolId,
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
          const dvaResponse = await PaymentGateway.provisionDVA(student.data?.id || '', schoolId);
          if (dvaResponse?.dva || dvaResponse?.payment_account) {
            const dva = dvaResponse.dva || dvaResponse.payment_account;
            const provider = dva.provider || 'monnify';
            const virtual_account_number = dva.dva_account_number || dva.virtual_account_number || '';
            const account_name = dva.dva_account_name || dva.account_name || '';
            const bank_name = dva.dva_bank_name || dva.bank_name || '';

            paymentAccount = await PaymentAccountRepository.savePaymentAccount({
              school_id: schoolId,
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
            school_id: schoolId,
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
      } catch (e: any) {
        this.error = e?.message || 'Failed to register student';
        throw e;
      } finally {
        this.loading = false;
      }
    },

    clear() {
      this.students = [];
      this.guardians = [];
      this.loading = false;
      this.initialized = false;
      this.error = null;
    },
  },
});
