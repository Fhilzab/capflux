import { SupabaseAcademicProvider } from './SupabaseAcademicProvider';
import { AcademicProvider } from './AcademicProvider';
import { AcademicValidator } from './AcademicValidator';
import type { AcademicSession, AcademicTerm, AcademicResult } from './types';

export class AcademicService {
  private provider: AcademicProvider;

  constructor(provider: AcademicProvider = new SupabaseAcademicProvider()) {
    this.provider = provider;
  }

  // Session methods
  async createSession(data: {
    schoolId: string;
    name: string;
    startDate: string;
    endDate: string;
  }): Promise<AcademicResult<AcademicSession>> {
    const validation = AcademicValidator.validateSession(data);
    if (!validation.valid) {
      return {
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: Object.values(validation.errors).join(', '),
        },
      };
    }

    return this.provider.createSession(data);
  }

  async updateSession(sessionId: string, data: Partial<AcademicSession>): Promise<AcademicResult<AcademicSession>> {
    if (!sessionId) {
      return { data: null, error: { code: 'SESSION_NOT_FOUND', message: 'Session ID is required' } };
    }

    const validation = AcademicValidator.validateSession({
      schoolId: data.schoolId || '',
      name: data.name || '',
      startDate: data.startDate || '',
      endDate: data.endDate || '',
    });

    if (!validation.valid) {
      return {
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: Object.values(validation.errors).join(', '),
        },
      };
    }

    return this.provider.updateSession(sessionId, data);
  }

  async loadSessions(schoolId: string): Promise<AcademicResult<AcademicSession[]>> {
    return this.provider.listSessions(schoolId);
  }

  async getCurrentSession(schoolId: string): Promise<AcademicResult<AcademicSession | null>> {
    const result = await this.provider.listSessions(schoolId);
    if (result.error) {
      return { data: null, error: result.error };
    }

    const current = result.data?.find(s => s.isCurrent && s.status === 'ACTIVE') || null;
    return { data: current, error: null };
  }

  async activateSession(sessionId: string): Promise<AcademicResult<AcademicSession>> {
    if (!sessionId) {
      return { data: null, error: { code: 'SESSION_NOT_FOUND', message: 'Session ID is required' } };
    }
    return this.provider.activateSession(sessionId);
  }

  // Term methods
  async createTerm(data: {
    sessionId: string;
    schoolId: string;
    name: string;
    termNumber: number;
    displayOrder: number;
    startDate: string;
    endDate: string;
    calendarType?: string;
  }): Promise<AcademicResult<AcademicTerm>> {
    const validation = AcademicValidator.validateTerm(data);
    if (!validation.valid) {
      return {
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: Object.values(validation.errors).join(', '),
        },
      };
    }

    return this.provider.createTerm(data);
  }

  async updateTerm(termId: string, data: Partial<AcademicTerm>): Promise<AcademicResult<AcademicTerm>> {
    if (!termId) {
      return { data: null, error: { code: 'TERM_NOT_FOUND', message: 'Term ID is required' } };
    }

    const validation = AcademicValidator.validateTerm({
      sessionId: data.sessionId || '',
      schoolId: data.schoolId || '',
      name: data.name || '',
      termNumber: data.termNumber || 1,
      displayOrder: data.displayOrder || 1,
      startDate: data.startDate || '',
      endDate: data.endDate || '',
    });

    if (!validation.valid) {
      return {
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: Object.values(validation.errors).join(', '),
        },
      };
    }

    return this.provider.updateTerm(termId, data);
  }

  async loadTerms(sessionId: string): Promise<AcademicResult<AcademicTerm[]>> {
    return this.provider.listTerms(sessionId);
  }

  async getCurrentTerm(schoolId: string): Promise<AcademicResult<AcademicTerm | null>> {
    const sessionResult = await this.getCurrentSession(schoolId);
    if (sessionResult.error || !sessionResult.data) {
      return { data: null, error: null };
    }

    const termsResult = await this.provider.listTerms(sessionResult.data.id);
    if (termsResult.error) {
      return { data: null, error: termsResult.error };
    }

    const current = termsResult.data?.find(t => t.isCurrent && t.status === 'ACTIVE') || null;
    return { data: current, error: null };
  }

  async activateTerm(termId: string): Promise<AcademicResult<AcademicTerm>> {
    if (!termId) {
      return { data: null, error: { code: 'TERM_NOT_FOUND', message: 'Term ID is required' } };
    }
    return this.provider.activateTerm(termId);
  }
}

export const academicService = new AcademicService();