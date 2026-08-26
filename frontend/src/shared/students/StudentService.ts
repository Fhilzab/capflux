import { SupabaseStudentProvider } from './SupabaseStudentProvider';
import { StudentProvider } from './StudentProvider';
import { StudentValidator } from './StudentValidator';
import { AdmissionNumberGenerator } from './AdmissionNumberGenerator';
import { StudentRepository } from '../repositories/StudentRepository';
import type { Student, Guardian, StudentResult } from './types';
import type { SchoolAdmissionSettings } from '../school/types';
import { db as offlineDb } from '../../offline/localDb';
import { createStudentProvider } from '../../sandbox/providers/providerFactories';

export class StudentService {
  private provider: StudentProvider;

  constructor(provider: StudentProvider = new SupabaseStudentProvider()) {
    this.provider = provider;
  }

   async createStudent(data: {
     schoolId: string;
     divisionId?: string;
     guardianId?: string;
     firstName: string;
     middleName?: string;
     lastName: string;
     gender?: string;
     dateOfBirth?: string;
     admissionNumber?: string;
     admissionDate?: string;
     registeredAt?: string;
     relationshipToGuardian?: string;
     guardianPhone?: string;
     discountRate?: number;
     status?: string;
     academicSession?: string;
     admissionSettings?: SchoolAdmissionSettings;
   }): Promise<StudentResult<Student>> {
     const validation = StudentValidator.validateCreate(data);
     if (!validation.valid) {
       return {
         data: null,
         error: {
           code: 'VALIDATION_ERROR',
           message: Object.values(validation.errors).join(', '),
         },
       };
     }

     // Handle admission number generation
     let admissionNumber = data.admissionNumber;
     if (!admissionNumber && data.admissionSettings?.mode === 'AUTO') {
       const generated = AdmissionNumberGenerator.generate(data.admissionSettings);
       admissionNumber = generated.number;
     }

     // Fallback autogeneration: the form promises "Auto-generated if left blank"
     // even when no AUTO settings are configured. Generate a collision-safe
     // sequential number against local Dexie state.
     if (!admissionNumber) {
       try {
         const existing = await offlineDb.students.toArray();
         const taken = new Set(existing.map((s) => s.admission_number).filter(Boolean));
         let n = existing.length + 1;
         while (taken.has(`CAP-${String(n).padStart(5, '0')}`)) n++;
         admissionNumber = `CAP-${String(n).padStart(5, '0')}`;
       } catch {
         // Non-fatal: leave blank rather than block creation offline.
       }
     }

     // Offline-first write path: Dexie + outbox with a client UUID.
     // The sync engine replays idempotently; no direct network call here.
     let record: any;
     try {
       record = await StudentRepository.saveStudent({
         school_id: data.schoolId,
         first_name: data.firstName,
         middle_name: data.middleName ?? null,
         last_name: data.lastName,
         gender: data.gender ?? null,
         date_of_birth: data.dateOfBirth ?? null,
         admission_number: admissionNumber ?? null,
         admission_date: data.admissionDate ?? null,
         class_name: (data as any).class_name ?? '',
         category: (data as any).category,
         guardian_id: data.guardianId ?? null,
         division_id: data.divisionId || null,
         guardian_phone: data.guardianPhone ?? null,
         status: 'ACTIVE',
       });
     } catch (e: any) {
       return { data: null, error: { code: 'STUDENT_CREATE_FAILED', message: e?.message || 'Failed to save student' } };
     }

     return { data: this.toDomainModel(record), error: null };
   }

  async updateStudent(studentId: string, data: Partial<Student>): Promise<StudentResult<Student>> {
    if (!studentId) {
      return { data: null, error: { code: 'STUDENT_NOT_FOUND', message: 'Student ID is required' } };
    }

    const validation = StudentValidator.validateUpdate(data);
    if (!validation.valid) {
      return {
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: Object.values(validation.errors).join(', '),
        },
      };
    }

    // Offline-first update path (Dexie + outbox). Accepts camelCase domain
    // fields; identity/tenant fields are preserved by the repository.
    try {
      const record = await StudentRepository.updateStudent(studentId, {
        ...(data.firstName !== undefined ? { first_name: data.firstName } : {}),
        ...(data.middleName !== undefined ? { middle_name: data.middleName ?? null } : {}),
        ...(data.lastName !== undefined ? { last_name: data.lastName } : {}),
        ...(data.gender !== undefined ? { gender: data.gender } : {}),
        ...(data.dateOfBirth !== undefined ? { date_of_birth: data.dateOfBirth ?? null } : {}),
        ...(data.admissionNumber !== undefined ? { admission_number: data.admissionNumber } : {}),
        ...(data.admissionDate !== undefined ? { admission_date: data.admissionDate } : {}),
        ...((data as any).class_name !== undefined ? { class_name: (data as any).class_name } : {}),
        ...(data.guardianId !== undefined ? { guardian_id: data.guardianId } : {}),
        ...(data.divisionId !== undefined ? { division_id: data.divisionId } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
      } as any);
      return { data: this.toDomainModel(record), error: null };
    } catch (e: any) {
      const notFound = /not found/i.test(e?.message || '');
      return {
        data: null,
        error: {
          code: notFound ? 'STUDENT_NOT_FOUND' : 'STUDENT_UPDATE_FAILED',
          message: e?.message || 'Failed to update student',
        },
      };
    }
  }

  async loadStudents(schoolId: string): Promise<StudentResult<Student[]>> {
    return this.provider.listStudents(schoolId);
  }

  async searchStudents(schoolId: string, query: string): Promise<StudentResult<Student[]>> {
    const allResult = await this.provider.listStudents(schoolId);
    if (allResult.error || !allResult.data) {
      return allResult;
    }

    if (!query.trim()) {
      return allResult;
    }

    const lowerQuery = query.toLowerCase();
    const filtered = allResult.data.filter(student => {
      const admissionMatch = student.admissionNumber?.toLowerCase().includes(lowerQuery);
      const firstNameMatch = student.firstName.toLowerCase().includes(lowerQuery);
      const lastNameMatch = student.lastName.toLowerCase().includes(lowerQuery);
      const nameMatch = `${student.firstName} ${student.lastName}`.toLowerCase().includes(lowerQuery);
      return admissionMatch || firstNameMatch || lastNameMatch || nameMatch;
    });

    return { data: filtered, error: null };
  }

  async filterByDivision(schoolId: string, divisionId: string): Promise<StudentResult<Student[]>> {
    const allResult = await this.provider.listStudents(schoolId);
    if (allResult.error || !allResult.data) {
      return allResult;
    }

    const filtered = allResult.data.filter(student => student.divisionId === divisionId);
    return { data: filtered, error: null };
  }

  async activateStudent(studentId: string): Promise<StudentResult<Student>> {
    if (!studentId) {
      return { data: null, error: { code: 'STUDENT_NOT_FOUND', message: 'Student ID is required' } };
    }
    return this.setStatus(studentId, 'ACTIVE');
  }

  async deactivateStudent(studentId: string): Promise<StudentResult<Student>> {
    if (!studentId) {
      return { data: null, error: { code: 'STUDENT_NOT_FOUND', message: 'Student ID is required' } };
    }
    // ARCHIVED is the register's archive state; carried verbatim in the sync
    // payload (Postgres status column widened to TEXT by the hardening
    // migration so legacy ARCHIVED rows keep syncing).
    return this.setStatus(studentId, 'ARCHIVED');
  }

  private async setStatus(
    studentId: string,
    status: 'ACTIVE' | 'ARCHIVED'
  ): Promise<StudentResult<Student>> {
    try {
      const record = await StudentRepository.archiveStudent(studentId, status);
      return { data: this.toDomainModel(record), error: null };
    } catch (e: any) {
      const notFound = /not found/i.test(e?.message || '');
      return {
        data: null,
        error: {
          code: notFound ? 'STUDENT_NOT_FOUND' : 'STUDENT_UPDATE_FAILED',
          message: e?.message || 'Failed to change student status',
        },
      };
    }
  }

  /** Map a snake_case Dexie/postgres row onto the camelCase domain model. */
  private toDomainModel(row: any): Student {
    return {
      id: row.id,
      schoolId: row.school_id,
      divisionId: row.division_id ?? '',
      guardianId: row.guardian_id ?? '',
      admissionNumber: row.admission_number ?? undefined,
      firstName: row.first_name,
      middleName: row.middle_name ?? undefined,
      lastName: row.last_name,
      gender: row.gender ?? '',
      dateOfBirth: row.date_of_birth ?? undefined,
      admissionDate: row.admission_date ?? '',
      registeredAt: row.created_at,
      relationshipToGuardian: (row.relationship ?? 'GUARDIAN'),
      discountRate: 0,
      status: (row.status === 'ARCHIVED' ? 'ARCHIVED' : row.status ?? 'ACTIVE') as any,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    } as Student;
  }

  // Guardian methods
  async createGuardian(data: {
    schoolId: string;
    fullName: string;
    phone: string;
    email?: string;
    occupation?: string;
    address?: string;
  }): Promise<StudentResult<Guardian>> {
    const validation = StudentValidator.validateGuardian(data);
    if (!validation.valid) {
      return {
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: Object.values(validation.errors).join(', '),
        },
      };
    }

    return this.provider.createGuardian(data);
  }

  async updateGuardian(guardianId: string, data: Partial<Guardian>): Promise<StudentResult<Guardian>> {
    if (!guardianId) {
      return { data: null, error: { code: 'GUARDIAN_NOT_FOUND', message: 'Guardian ID is required' } };
    }

    const validation = StudentValidator.validateGuardianUpdate(data);
    if (!validation.valid) {
      return {
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: Object.values(validation.errors).join(', '),
        },
      };
    }

    return this.provider.updateGuardian(guardianId, data);
  }

  async loadGuardians(schoolId: string): Promise<StudentResult<Guardian[]>> {
    return this.provider.listGuardians(schoolId);
  }

  async searchGuardians(schoolId: string, query: string): Promise<StudentResult<Guardian[]>> {
    const allResult = await this.provider.listGuardians(schoolId);
    if (allResult.error || !allResult.data) {
      return allResult;
    }

    if (!query.trim()) {
      return allResult;
    }

    const lowerQuery = query.toLowerCase();
    const filtered = allResult.data.filter(guardian => {
      const nameMatch = guardian.fullName.toLowerCase().includes(lowerQuery);
      const phoneMatch = guardian.phone.includes(query);
      return nameMatch || phoneMatch;
    });

    return { data: filtered, error: null };
  }

  async getGuardianStudents(guardianId: string): Promise<StudentResult<Student[]>> {
    if (!guardianId) {
      return { data: [], error: null };
    }

    const result = await this.provider.listGuardianStudents(guardianId);
    return result;
  }
}

export const studentService = new StudentService(createStudentProvider());