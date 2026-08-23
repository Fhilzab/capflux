import { defineStore } from 'pinia';
import { GuardianService } from '../shared/services/GuardianService';
import { StudentGuardianService } from '../shared/guardians/StudentGuardianService';
import { db } from '../offline/localDb';
import type { StudentGuardianRow } from '../offline/localDb';
import { useSchoolStore } from './schoolStore';
import type { GuardianRelationship } from '../shared/guardians/relationshipTypes';

/** Legacy snake_case guardian row as stored in Dexie. */
export interface GuardianRow {
  id: string;
  school_id: string;
  full_name: string;
  primary_phone: string;
  secondary_phone?: string | null;
  email?: string | null;
  relationship?: 'FATHER' | 'MOTHER' | 'GUARDIAN' | 'OTHER' | string;
  created_at: string;
  updated_at: string;
}

/**
 * guardianStore — guardians registry + student↔guardian relationships.
 */
export const useGuardianStore = defineStore('guardian', {
  state: () => ({
    guardians: [] as GuardianRow[],
    linksByStudent: {} as Record<string, StudentGuardianRow[]>,
    studentsByGuardian: {} as Record<string, string[]>, // guardian_id → student_ids
    loading: false as boolean,
    initialized: false as boolean,
    error: null as string | null,
  }),
  getters: {
    guardianCount: (state) => state.guardians.length,
  },
  actions: {
    async initialize() {
      if (this.initialized) return;
      await this.loadGuardians();
      this.initialized = true;
    },

    async loadGuardians() {
      const schoolId = useSchoolStore().currentSchoolId;
      if (!schoolId) return;
      this.loading = true;
      this.error = null;
      try {
        // Local-first; the legacy service already reads Dexie and refreshes.
        this.guardians = await db.guardians.where('school_id').equals(schoolId).toArray();
      } catch (e: any) {
        this.error = e?.message || 'Failed to load guardians';
      } finally {
        this.loading = false;
      }
    },

    async searchGuardians(query: string): Promise<GuardianRow[]> {
      const schoolId = useSchoolStore().currentSchoolId;
      if (!schoolId) return [];
      if (!query.trim()) return this.guardians;
      return StudentGuardianService.searchGuardians(schoolId, query) as Promise<GuardianRow[]>;
    },

    async createGuardian(data: {
      full_name: string;
      primary_phone: string;
      secondary_phone?: string;
      email?: string;
      relationship?: GuardianRow['relationship'];
    }): Promise<GuardianRow | null> {
      const schoolId = useSchoolStore().currentSchoolId;
      if (!schoolId) return null;
      this.loading = true;
      this.error = null;
      try {
        const guardian = await GuardianService.getOrCreateGuardian(schoolId, data);
        await this.loadGuardians();
        return guardian as unknown as GuardianRow;
      } catch (e: any) {
        this.error = e?.message || 'Failed to save guardian';
        return null;
      } finally {
        this.loading = false;
      }
    },

    async updateGuardian(guardianId: string, updates: Partial<GuardianRow>) {
      this.loading = true;
      this.error = null;
      try {
        await GuardianService.updateGuardian(guardianId, updates);
        await this.loadGuardians();
        return true;
      } catch (e: any) {
        this.error = e?.message || 'Failed to update guardian';
        return false;
      } finally {
        this.loading = false;
      }
    },

    async loadLinksForStudent(studentId: string) {
      try {
        this.linksByStudent[studentId] = await StudentGuardianService.getGuardiansForStudent(studentId);
      } catch (e: any) {
        this.error = e?.message || 'Failed to load guardian links';
      }
    },

    async loadStudentsForGuardian(guardianId: string) {
      try {
        const links = await StudentGuardianService.getStudentsForGuardian(guardianId);
        this.studentsByGuardian[guardianId] = links.map((l) => l.student_id);
      } catch (e: any) {
        this.error = e?.message || 'Failed to load linked students';
      }
    },

    /** Hydrated detail rows (link + student), primary first. */
    async loadGuardianDetail(guardianId: string): Promise<
      { link: StudentGuardianRow; student: any | null }[]
    > {
      try {
        const links = await StudentGuardianService.getStudentsForGuardian(guardianId);
        this.studentsByGuardian[guardianId] = links.map((l) => l.student_id);
        const students = await Promise.all(links.map((l) => db.students.get(l.student_id)));
        return links
          .map((link, i) => ({ link, student: students[i] ?? null }))
          .sort((a, b) => {
            if (a.link.is_primary !== b.link.is_primary) return a.link.is_primary ? -1 : 1;
            return a.link.created_at.localeCompare(b.link.created_at);
          });
      } catch (e: any) {
        this.error = e?.message || 'Failed to load linked students';
        return [];
      }
    },

    async updateRelationshipType(studentId: string, linkId: string, relationship: GuardianRelationship) {
      this.loading = true;
      this.error = null;
      try {
        const result = await StudentGuardianService.updateRelationshipType(linkId, relationship);
        if (!result.ok) {
          this.error = result.error.message;
          return false;
        }
        await this.loadLinksForStudent(studentId);
        return true;
      } finally {
        this.loading = false;
      }
    },

    /** Refresh linked-student counts for the registry page. */
    async refreshStudentCounts(): Promise<Record<string, number>> {
      try {
        const counts: Record<string, number> = {};
        const allLinks = await db.student_guardians.toArray();
        for (const link of allLinks) {
          counts[link.guardian_id] = (counts[link.guardian_id] ?? 0) + 1;
        }
        return counts;
      } catch (e: any) {
        this.error = e?.message || 'Failed to count linked students';
        return {};
      }
    },

    async linkGuardian(input: {
      schoolId: string;
      studentId: string;
      guardianId: string;
      relationship?: StudentGuardianRow['relationship'];
      isPrimary?: boolean;
    }) {
      this.loading = true;
      this.error = null;
      try {
        const result = await StudentGuardianService.linkGuardian(input);
        if (!result.ok) {
          this.error = result.error.message;
          return false;
        }
        await this.loadLinksForStudent(input.studentId);
        return true;
      } finally {
        this.loading = false;
      }
    },

    async unlinkGuardian(linkId: string, studentId: string) {
      this.loading = true;
      this.error = null;
      try {
        const result = await StudentGuardianService.unlinkGuardian(linkId);
        if (!result.ok) {
          this.error = result.error.message;
          return false;
        }
        await this.loadLinksForStudent(studentId);
        return true;
      } finally {
        this.loading = false;
      }
    },

    async setPrimaryGuardian(studentId: string, linkId: string) {
      this.loading = true;
      this.error = null;
      try {
        const result = await StudentGuardianService.setPrimaryGuardian(studentId, linkId);
        if (!result.ok) {
          this.error = result.error.message;
          return false;
        }
        await this.loadLinksForStudent(studentId);
        return true;
      } finally {
        this.loading = false;
      }
    },
  },
});
