import { defineStore } from 'pinia';
import { studentService } from '../shared/students/StudentService';
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

    clear() {
      this.students = [];
      this.guardians = [];
      this.loading = false;
      this.initialized = false;
      this.error = null;
    },
  },
});