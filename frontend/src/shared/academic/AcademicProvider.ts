import type { AcademicSession, AcademicTerm, AcademicResult } from './types';

/**
 * Academic Provider Interface
 * Abstract contract for academic session providers
 */
export abstract class AcademicProvider {
  // Session CRUD
  abstract createSession(data: {
    schoolId: string;
    name: string;
    startDate: string;
    endDate: string;
  }): Promise<AcademicResult<AcademicSession>>;

  abstract updateSession(sessionId: string, data: Partial<AcademicSession>): Promise<AcademicResult<AcademicSession>>;
  abstract getSession(sessionId: string): Promise<AcademicResult<AcademicSession>>;
  abstract listSessions(schoolId: string): Promise<AcademicResult<AcademicSession[]>>;
  abstract activateSession(sessionId: string): Promise<AcademicResult<AcademicSession>>;

  // Term CRUD
  abstract createTerm(data: {
    sessionId: string;
    schoolId: string;
    name: string;
    termNumber: number;
    displayOrder: number;
    startDate: string;
    endDate: string;
  }): Promise<AcademicResult<AcademicTerm>>;

  abstract updateTerm(termId: string, data: Partial<AcademicTerm>): Promise<AcademicResult<AcademicTerm>>;
  abstract getTerm(termId: string): Promise<AcademicResult<AcademicTerm>>;
  abstract listTerms(sessionId: string): Promise<AcademicResult<AcademicTerm[]>>;
  abstract activateTerm(termId: string): Promise<AcademicResult<AcademicTerm>>;

  // Future stubs
  abstract rolloverSession?(sessionId: string): Promise<AcademicResult<void>>;
  abstract promoteStudents?(sessionId: string): Promise<AcademicResult<void>>;
  abstract archivePreviousSession?(sessionId: string): Promise<AcademicResult<void>>;

  abstract isConfigured(): boolean;
}