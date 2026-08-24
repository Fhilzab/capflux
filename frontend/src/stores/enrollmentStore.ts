import { defineStore } from 'pinia';
import { EnrollmentService, hydrateEnrollment } from '../shared/enrollment/EnrollmentService';
import type {
  StudentEnrollmentRow,
  AcademicSessionRow,
  SchoolDivisionRow,
  AcademicLevelRow,
} from '../offline/localDb';
import type { BulkMovePlan, ApplyMoveResult, MoveInput } from '../shared/enrollment/EnrollmentService';
import { useAuthStore } from './authStore';

/** Actor context stamped onto every movement for the audit trail. */
function movementContext(): { createdBy: string | null; source: string | null } {
  try {
    const user = useAuthStore().user;
    return { createdBy: user?.id ?? null, source: 'UI' };
  } catch {
    return { createdBy: null, source: 'UI' };
  }
}

export interface HydratedEnrollment {
  enrollment: StudentEnrollmentRow;
  session?: AcademicSessionRow;
  section?: SchoolDivisionRow;
  level?: AcademicLevelRow;
}

/**
 * enrollmentStore — per-student placement state and bulk move planning.
 * Delegates all writes to EnrollmentService (offline-first, append-only).
 */
export const useEnrollmentStore = defineStore('enrollment', {
  state: () => ({
    history: {} as Record<string, HydratedEnrollment[]>,
    current: {} as Record<string, HydratedEnrollment | null>,
    lastPlan: null as BulkMovePlan | null,
    loading: false as boolean,
    error: null as string | null,
  }),
  actions: {
    async loadHistory(studentId: string) {
      this.loading = true;
      this.error = null;
      try {
        const rows = await EnrollmentService.getEnrollmentHistory(studentId);
        const hydrated: HydratedEnrollment[] = [];
        for (const row of rows) {
          hydrated.push(await hydrateEnrollment(row));
        }
        this.history[studentId] = hydrated;
        const active = rows.find((r) => r.status === 'ACTIVE');
        this.current[studentId] = active ? await hydrateEnrollment(active) : null;
      } catch (e: any) {
        this.error = e?.message || 'Failed to load academic history';
      } finally {
        this.loading = false;
      }
    },

    async enrollStudent(input: {
      schoolId: string;
      studentId: string;
      sessionId: string;
      sectionId: string;
      levelId: string;
      reason?: 'INITIAL' | 'IMPORT' | 'MIGRATION';
      createdBy?: string | null;
      source?: string | null;
    }) {
      this.loading = true;
      this.error = null;
      try {
        const result = await EnrollmentService.enrollStudent(input);
        if (!result.ok) {
          this.error = result.error.message;
          return false;
        }
        await this.loadHistory(input.studentId);
        return true;
      } finally {
        this.loading = false;
      }
    },

    async moveStudent(studentId: string, to: MoveInput, reason: 'MOVEMENT' | 'PROMOTION' = 'MOVEMENT') {
      this.loading = true;
      this.error = null;
      try {
        const result = await EnrollmentService.moveStudent(studentId, to, reason, movementContext());
        if (!result.ok) {
          this.error = result.error.message;
          return false;
        }
        await this.loadHistory(studentId);
        return true;
      } finally {
        this.loading = false;
      }
    },

    async planBulkMove(fromLevelId: string, to: MoveInput, selectedIds?: string[]) {
      this.loading = true;
      this.error = null;
      try {
        this.lastPlan = await EnrollmentService.planBulkMove(fromLevelId, to, selectedIds);
        return this.lastPlan;
      } catch (e: any) {
        this.error = e?.message || 'Failed to plan movement';
        return null;
      } finally {
        this.loading = false;
      }
    },

    async applyMove(studentIds: string[], to: MoveInput, reason: 'MOVEMENT' | 'PROMOTION') {
      this.loading = true;
      this.error = null;
      try {
        const result: ApplyMoveResult = await EnrollmentService.applyMove(studentIds, to, reason, movementContext());
        return result;
      } catch (e: any) {
        this.error = e?.message || 'Failed to apply movement';
        return { moved: [], failed: [{ studentId: '', reason: e?.message ?? 'Unknown error' }] };
      } finally {
        this.loading = false;
      }
    },
  },
});
