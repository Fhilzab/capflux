import { defineStore } from 'pinia';
import { academicService } from '../shared/academic/AcademicService';
import type { AcademicSession, AcademicTerm, AcademicResult } from '../shared/academic/types';
import { useSchoolStore } from './schoolStore';

export const useSessionStore = defineStore('session', {
  state: () => ({
    sessions: [] as AcademicSession[],
    terms: [] as AcademicTerm[],
    loading: false as boolean,
    initialized: false as boolean,
    error: null as string | null,
  }),
  getters: {
    currentSession: (state): AcademicSession | undefined => state.sessions.find(s => s.isCurrent && s.status === 'ACTIVE'),
    currentTerm: (state): AcademicTerm | undefined => {
      const session = state.sessions.find(s => s.isCurrent && s.status === 'ACTIVE');
      if (!session) return undefined;
      return state.terms.find(t => t.isCurrent && t.status === 'ACTIVE' && t.sessionId === session.id);
    },
    currentAcademicContext: (state): { session: AcademicSession | undefined; term: AcademicTerm | undefined } => ({
      session: state.sessions.find(s => s.isCurrent && s.status === 'ACTIVE'),
      term: state.terms.find(t => t.isCurrent && t.status === 'ACTIVE'),
    }),
    activeSessions: (state): AcademicSession[] => state.sessions.filter(s => s.status === 'ACTIVE'),
    activeTerms: (state): AcademicTerm[] => state.terms.filter(t => t.status === 'ACTIVE'),
    hasCurrentSession: (state): boolean => state.sessions.some(s => s.isCurrent && s.status === 'ACTIVE'),
    hasCurrentTerm: (state): boolean => state.terms.some(t => t.isCurrent && t.status === 'ACTIVE'),
  },
  actions: {
    async initialize() {
      this.loading = true;
      this.error = null;

      try {
        const schoolStore = useSchoolStore();
        const schoolId = schoolStore.currentSchoolId;

        if (schoolId) {
          const sessionResult = await academicService.loadSessions(schoolId);
          if (sessionResult.error) {
            this.error = sessionResult.error.message;
            this.sessions = [];
          } else {
            this.sessions = sessionResult.data || [];
          }

          // Load terms for current session
          const currentSession = this.sessions.find(s => s.isCurrent && s.status === 'ACTIVE');
          if (currentSession) {
            const termResult = await academicService.loadTerms(currentSession.id);
            if (termResult.error) {
              this.error = termResult.error.message;
              this.terms = [];
            } else {
              this.terms = termResult.data || [];
            }
          } else {
            this.terms = [];
          }
        } else {
          this.sessions = [];
          this.terms = [];
        }
      } catch (e: any) {
        this.error = e?.message || 'Failed to load academic data';
        this.sessions = [];
        this.terms = [];
      } finally {
        this.loading = false;
        this.initialized = true;
      }
    },

    async loadSessions() {
      this.loading = true;
      this.error = null;

      try {
        const schoolStore = useSchoolStore();
        const schoolId = schoolStore.currentSchoolId;

        if (!schoolId) {
          this.sessions = [];
          return;
        }

        const result = await academicService.loadSessions(schoolId);
        if (result.error) {
          this.error = result.error.message;
          this.sessions = [];
        } else {
          this.sessions = result.data || [];
        }
      } catch (e: any) {
        this.error = e?.message || 'Failed to load sessions';
        this.sessions = [];
      } finally {
        this.loading = false;
      }
    },

    async loadTerms(sessionId: string) {
      this.loading = true;
      this.error = null;

      try {
        const result = await academicService.loadTerms(sessionId);
        if (result.error) {
          this.error = result.error.message;
          this.terms = [];
        } else {
          this.terms = result.data || [];
        }
      } catch (e: any) {
        this.error = e?.message || 'Failed to load terms';
        this.terms = [];
      } finally {
        this.loading = false;
      }
    },

    async createSession(data: {
      schoolId: string;
      name: string;
      startDate: string;
      endDate: string;
    }) {
      this.loading = true;
      this.error = null;

      try {
        const result = await academicService.createSession(data);

        if (result.error) {
          this.error = result.error.message;
          return false;
        }

        if (result.data) {
          this.sessions.push(result.data);
        }
        return true;
      } catch (e: any) {
        this.error = e?.message || 'Failed to create session';
        return false;
      } finally {
        this.loading = false;
      }
    },

    async createTerm(data: {
      sessionId: string;
      schoolId: string;
      name: string;
      termNumber: number;
      displayOrder: number;
      startDate: string;
      endDate: string;
    }) {
      this.loading = true;
      this.error = null;

      try {
        const result = await academicService.createTerm(data);

        if (result.error) {
          this.error = result.error.message;
          return false;
        }

        if (result.data) {
          this.terms.push(result.data);
        }
        return true;
      } catch (e: any) {
        this.error = e?.message || 'Failed to create term';
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

        if (result.error) {
          this.error = result.error.message;
          return false;
        }

        if (result.data) {
          const idx = this.sessions.findIndex(s => s.id === sessionId);
          if (idx >= 0) {
            this.sessions[idx] = result.data;
          }
        }
        return true;
      } catch (e: any) {
        this.error = e?.message || 'Failed to activate session';
        return false;
      } finally {
        this.loading = false;
      }
    },

    async activateTerm(termId: string) {
      this.loading = true;
      this.error = null;

      try {
        const result = await academicService.activateTerm(termId);

        if (result.error) {
          this.error = result.error.message;
          return false;
        }

        if (result.data) {
          const idx = this.terms.findIndex(t => t.id === termId);
          if (idx >= 0) {
            this.terms[idx] = result.data;
          }
        }
        return true;
      } catch (e: any) {
        this.error = e?.message || 'Failed to activate term';
        return false;
      } finally {
        this.loading = false;
      }
    },

    clear() {
      this.sessions = [];
      this.terms = [];
      this.loading = false;
      this.initialized = false;
      this.error = null;
    },
  },
});