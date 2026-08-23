import { defineStore } from 'pinia';
import { academicService } from '../shared/academic/AcademicService';
import { LocalRepository, db } from '../offline/localDb';
import type {
  AcademicSessionRow,
  AcademicTermRow,
  AcademicLevelRow,
} from '../offline/localDb';
import type { SchoolDivision } from '../shared/divisions/types';
import { useSchoolStore } from './schoolStore';

/**
 * academicStore — sessions, terms, sections (divisions) and academic levels.
 * Reads are local-first (Dexie cache) with a background server refresh,
 * so the UI renders instantly even while synchronization is in flight.
 */
export const useAcademicStore = defineStore('academic', {
  state: () => ({
    sessions: [] as AcademicSessionRow[],
    terms: [] as AcademicTermRow[],
    levels: [] as AcademicLevelRow[],
    loading: false as boolean,
    initialized: false as boolean,
    error: null as string | null,
  }),
  getters: {
    activeSessions: (state) => state.sessions.filter((s) => s.status === 'ACTIVE'),
    currentSession: (state): AcademicSessionRow | null =>
      state.sessions.find((s) => s.isCurrent && s.status === 'ACTIVE') ?? null,
    activeLevels: (state) => state.levels.filter((l) => l.status === 'ACTIVE'),
    levelsBySection(state): Record<string, AcademicLevelRow[]> {
      const map: Record<string, AcademicLevelRow[]> = {};
      for (const level of state.levels) {
        (map[level.section_id] ??= []).push(level);
      }
      // Explicit display order — never alphabetical.
      for (const key of Object.keys(map)) {
        map[key].sort((a, b) => a.display_order - b.display_order);
      }
      return map;
    },
  },
  actions: {
    /** Load from Dexie cache first; refresh from the server in the background. */
    async initialize() {
      if (this.initialized) return;
      this.loading = true;
      this.error = null;
      try {
        const schoolId = useSchoolStore().currentSchoolId;
        if (!schoolId) return;

        this.sessions = await LocalRepository.getAcademicSessionsBySchool(schoolId);
        this.levels = await LocalRepository.getAcademicLevelsBySchool(schoolId);

        void this.refreshFromServer(schoolId);
      } catch (e: any) {
        this.error = e?.message || 'Failed to load academic structure';
      } finally {
        this.loading = false;
        this.initialized = true;
      }
    },

    async refreshFromServer(schoolId?: string) {
      const targetSchoolId = schoolId ?? useSchoolStore().currentSchoolId;
      if (!targetSchoolId) return;
      try {
        const result = await academicService.loadSessions(targetSchoolId);
        if (result.data?.length) {
          for (const session of result.data) {
            await LocalRepository.saveAcademicSession({
              id: session.id,
              school_id: session.schoolId,
              name: session.name,
              start_date: session.startDate ?? null,
              end_date: session.endDate ?? null,
              is_current: session.isCurrent,
              status: session.status,
              created_at: session.createdAt,
              updated_at: session.updatedAt,
            });
          }
          this.sessions = await LocalRepository.getAcademicSessionsBySchool(targetSchoolId);
        }
      } catch {
        // Offline or server unreachable — local cache remains authoritative.
      }
    },

    async loadLevels(sectionId?: string) {
      const schoolId = useSchoolStore().currentSchoolId;
      if (!schoolId) return;
      this.levels = sectionId
        ? await LocalRepository.getAcademicLevelsBySection(sectionId)
        : await LocalRepository.getAcademicLevelsBySchool(schoolId);
    },

    async createSession(data: { name: string; startDate: string; endDate: string }) {
      const schoolId = useSchoolStore().currentSchoolId;
      if (!schoolId) return false;
      this.loading = true;
      this.error = null;
      try {
        const result = await academicService.createSession({ schoolId, ...data });
        if (result.error || !result.data) {
          this.error = result.error?.message ?? 'Failed to create session';
          return false;
        }
        const s = result.data;
        await LocalRepository.saveAcademicSession({
          id: s.id,
          school_id: s.schoolId,
          name: s.name,
          start_date: s.startDate ?? null,
          end_date: s.endDate ?? null,
          is_current: s.isCurrent,
          status: s.status,
          created_at: s.createdAt,
          updated_at: s.updatedAt,
        });
        this.sessions = await LocalRepository.getAcademicSessionsBySchool(schoolId);
        return true;
      } catch (e: any) {
        this.error = e?.message || 'Failed to create session';
        return false;
      } finally {
        this.loading = false;
      }
    },

    async activateSession(sessionId: string) {
      this.loading = true;
      this.error = null;
      try {
        const result = await academicService.activateSession(sessionId);
        if (result.error || !result.data) {
          this.error = result.error?.message ?? 'Failed to activate session';
          return false;
        }
        // Server enforces single-current-session; mirror it locally.
        for (const s of this.sessions) {
          const isNowCurrent = s.id === sessionId;
          await db.academic_sessions.update(s.id, {
            is_current: isNowCurrent,
            status: isNowCurrent ? 'ACTIVE' : 'COMPLETED',
          });
        }
        this.sessions = await LocalRepository.getAcademicSessionsBySchool(
          useSchoolStore().currentSchoolId!
        );
        return true;
      } catch (e: any) {
        this.error = e?.message || 'Failed to activate session';
        return false;
      } finally {
        this.loading = false;
      }
    },

    async createLevel(data: { sectionId: string; name: string; code?: string; displayOrder: number }) {
      const schoolId = useSchoolStore().currentSchoolId;
      if (!schoolId) return false;
      this.loading = true;
      this.error = null;
      try {
        // Offline-first: create locally + enqueue upload.
        const now = new Date().toISOString();
        const row: AcademicLevelRow = {
          id: crypto.randomUUID(),
          school_id: schoolId,
          section_id: data.sectionId,
          name: data.name.trim(),
          code: data.code?.trim() || null,
          display_order: data.displayOrder,
          status: 'ACTIVE',
          created_at: now,
          updated_at: now,
        };
        await LocalRepository.saveAcademicLevel(row);
        await LocalRepository.enqueueSyncItem({
          school_id: schoolId,
          entity_type: 'academic_levels',
          entity_id: row.id,
          operation: 'UPSERT',
          payload: { ...row },
        });
        await this.loadLevels();
        return true;
      } catch (e: any) {
        this.error = e?.message || 'Failed to create level';
        return false;
      } finally {
        this.loading = false;
      }
    },

    async reorderLevel(levelId: string, newOrder: number) {
      try {
        await db.academic_levels.update(levelId, { display_order: newOrder, updated_at: new Date().toISOString() });
        const level = await db.academic_levels.get(levelId);
        if (level) {
          await LocalRepository.enqueueSyncItem({
            school_id: level.school_id,
            entity_type: 'academic_levels',
            entity_id: levelId,
            operation: 'UPSERT',
            payload: { ...level },
          });
        }
        await this.loadLevels();
        return true;
      } catch (e: any) {
        this.error = e?.message || 'Failed to reorder level';
        return false;
      }
    },

    async setLevelStatus(levelId: string, status: 'ACTIVE' | 'INACTIVE') {
      try {
        await db.academic_levels.update(levelId, { status, updated_at: new Date().toISOString() });
        const level = await db.academic_levels.get(levelId);
        if (level) {
          await LocalRepository.enqueueSyncItem({
            school_id: level.school_id,
            entity_type: 'academic_levels',
            entity_id: levelId,
            operation: 'UPSERT',
            payload: { ...level },
          });
        }
        await this.loadLevels();
        return true;
      } catch (e: any) {
        this.error = e?.message || 'Failed to update level';
        return false;
      }
    },

    clear() {
      this.sessions = [];
      this.terms = [];
      this.levels = [];
      this.loading = false;
      this.initialized = false;
      this.error = null;
    },
  },
});

export type { SchoolDivision };
