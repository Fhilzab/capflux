/**
 * Sandbox domain providers — Dexie-backed implementations of the existing
 * hexagonal provider interfaces. Domain services keep running UNCHANGED;
 * only the persistence adapter differs (isolated sandbox database instead
 * of Supabase). Every constructor fails closed outside sandbox mode.
 */

import { runtimeEnvironment } from '../../shared/environment/runtimeEnvironment';
import { assertSandboxMode } from '../runtime/sandboxGuard';
import { getSandboxDb, type SandboxCapfluxDB } from '../sandboxDb';

import { StudentProvider } from '../../shared/students/StudentProvider';
import type { Student, Guardian, StudentResult, Relationship } from '../../shared/students/types';
import { AcademicProvider } from '../../shared/academic/AcademicProvider';
import type {
  AcademicSession,
  AcademicTerm,
} from '../../shared/academic/types';
import type { AcademicResult, AcademicError } from '../../shared/academic/types';
import { DivisionProvider } from '../../shared/divisions/DivisionProvider';
import type { SchoolDivision, DivisionResult, DivisionError } from '../../shared/divisions/types';
import { FeeProvider } from '../../shared/fees/FeeProvider';
import type { Fee, FeeResult, FeeError } from '../../shared/fees/types';
import { LedgerProvider } from '../../shared/ledger/LedgerProvider';
import type { LedgerEntry, LedgerResult, LedgerError } from '../../shared/ledger/types';
import { AuditProvider } from '../../shared/audit/AuditProvider';
import type { AuditEntry, AuditResult } from '../../shared/audit/types';
import type { AuditFilter, AuditFilterResult } from '../../shared/audit/AuditFilter';
import { domainEntryToRow, rowToDomainEntry } from '../api/ledgerWriter';
import { DEMO_ORG_ID } from '../seed/demoData';

type AnyRow = Record<string, unknown>;

function ok<T>(data: T): { data: T; error: null } {
  return { data, error: null };
}

function fail<T>(code: string, message: string): { data: null; error: { code: never; message: string } } {
  return { data: null, error: { code: code as never, message } };
}

// ---------------------------------------------------------------------------
// Students & guardians
// ---------------------------------------------------------------------------

function studentRowToDomain(row: AnyRow): Student {
  return {
    id: String(row.id),
    schoolId: String(row.school_id ?? ''),
    divisionId: (row.division_id as string) ?? '',
    guardianId: (row.guardian_id as string) ?? '',
    admissionNumber: (row.admission_number as string) ?? undefined,
    firstName: String(row.first_name ?? ''),
    middleName: (row.middle_name as string) ?? undefined,
    lastName: String(row.last_name ?? ''),
    gender: String(row.gender ?? ''),
    dateOfBirth: (row.date_of_birth as string) ?? undefined,
    admissionDate: (row.admission_date as string) ?? '',
    registeredAt: String(row.created_at ?? ''),
    relationshipToGuardian: ((row.relationship as Relationship) ?? 'GUARDIAN'),
    discountRate: Number(row.discount_rate ?? 0),
    status: ((row.status as Student['status']) ?? 'ACTIVE'),
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? row.created_at ?? ''),
  };
}

function guardianRowToDomain(row: AnyRow): Guardian {
  return {
    id: String(row.id),
    schoolId: String(row.school_id ?? ''),
    fullName: String(row.full_name ?? ''),
    phone: String(row.primary_phone ?? ''),
    email: (row.email as string) ?? undefined,
    occupation: (row.occupation as string) ?? undefined,
    address: (row.address as string) ?? undefined,
    status: 'ACTIVE',
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? row.created_at ?? ''),
  };
}

export class SandboxStudentProvider extends StudentProvider {
  private db: SandboxCapfluxDB;

  constructor() {
    super();
    assertSandboxMode(runtimeEnvironment.isSandbox, 'SandboxStudentProvider');
    this.db = getSandboxDb();
  }

  async createStudent(): Promise<StudentResult<Student>> {
    return fail('STUDENT_CREATE_FAILED', 'Use the offline-first repository path for student creation');
  }

  async updateStudent(studentId: string, data: Partial<Student>): Promise<StudentResult<Student>> {
    const row = await this.db.students.get(studentId);
    if (!row) return fail('STUDENT_NOT_FOUND', 'Student not found');
    const updates: AnyRow = { updated_at: new Date().toISOString() };
    if (data.firstName !== undefined) updates.first_name = data.firstName;
    if (data.lastName !== undefined) updates.last_name = data.lastName;
    if (data.middleName !== undefined) updates.middle_name = data.middleName ?? null;
    if (data.gender !== undefined) updates.gender = data.gender;
    if (data.dateOfBirth !== undefined) updates.date_of_birth = data.dateOfBirth ?? null;
    if (data.admissionNumber !== undefined) updates.admission_number = data.admissionNumber;
    if (data.status !== undefined) updates.status = data.status;
    if (data.divisionId !== undefined) updates.division_id = data.divisionId || null;
    if (data.guardianId !== undefined) updates.guardian_id = data.guardianId || null;
    await this.db.students.update(studentId, updates);
    return ok(studentRowToDomain({ ...row, ...updates }));
  }

  async getStudent(studentId: string): Promise<StudentResult<Student>> {
    const row = await this.db.students.get(studentId);
    if (!row) return fail('STUDENT_NOT_FOUND', 'Student not found');
    return ok(studentRowToDomain(row));
  }

  async listStudents(schoolId: string): Promise<StudentResult<Student[]>> {
    const rows = await this.db.students.where('school_id').equals(schoolId).toArray();
    return ok(rows.map((r) => studentRowToDomain(r)));
  }

  async activateStudent(studentId: string): Promise<StudentResult<Student>> {
    return this.updateStudent(studentId, { status: 'ACTIVE' });
  }

  async deactivateStudent(studentId: string): Promise<StudentResult<Student>> {
    return this.updateStudent(studentId, { status: 'ARCHIVED' });
  }

  async createGuardian(data: {
    schoolId: string;
    fullName: string;
    phone: string;
    email?: string;
    occupation?: string;
    address?: string;
  }): Promise<StudentResult<Guardian>> {
    const nowIso = new Date().toISOString();
    // Phone uniqueness within school mirrors the production constraint.
    const existing = await this.db.guardians
      .where('school_id')
      .equals(data.schoolId)
      .and((g) => g.primary_phone === data.phone)
      .first();
    if (existing) return fail('DUPLICATE_PHONE', 'A guardian with this phone number already exists');

    const row: AnyRow = {
      id: crypto.randomUUID(),
      school_id: data.schoolId,
      full_name: data.fullName,
      primary_phone: data.phone,
      secondary_phone: null,
      email: data.email ?? null,
      relationship: 'GUARDIAN',
      occupation: data.occupation ?? null,
      address: data.address ?? null,
      created_at: nowIso,
      updated_at: nowIso,
      source: 'LOCAL',
      version: 1,
    };
    await this.db.guardians.add(row as never);
    return ok(guardianRowToDomain(row));
  }

  async updateGuardian(guardianId: string, data: Partial<Guardian>): Promise<StudentResult<Guardian>> {
    const row = await this.db.guardians.get(guardianId);
    if (!row) return fail('GUARDIAN_NOT_FOUND', 'Guardian not found');
    const updates: AnyRow = { updated_at: new Date().toISOString() };
    if (data.fullName !== undefined) updates.full_name = data.fullName;
    if (data.phone !== undefined) updates.primary_phone = data.phone;
    if (data.email !== undefined) updates.email = data.email ?? null;
    if (data.occupation !== undefined) updates.occupation = data.occupation ?? null;
    if (data.address !== undefined) updates.address = data.address ?? null;
    await this.db.guardians.update(guardianId, updates);
    return ok(guardianRowToDomain({ ...row, ...updates }));
  }

  async getGuardian(guardianId: string): Promise<StudentResult<Guardian>> {
    const row = await this.db.guardians.get(guardianId);
    if (!row) return fail('GUARDIAN_NOT_FOUND', 'Guardian not found');
    return ok(guardianRowToDomain(row));
  }

  async listGuardians(schoolId: string): Promise<StudentResult<Guardian[]>> {
    const rows = await this.db.guardians.where('school_id').equals(schoolId).toArray();
    return ok(rows.map((r) => guardianRowToDomain(r)));
  }

  override async listGuardianStudents(guardianId: string): Promise<StudentResult<Student[]>> {
    const links = await this.db.student_guardians.where('guardian_id').equals(guardianId).toArray();
    const students = await Promise.all(links.map((l) => this.db.students.get(l.student_id)));
    return ok(students.filter(Boolean).map((s) => studentRowToDomain(s!)));
  }

  isConfigured(): boolean {
    return true;
  }
}

// ---------------------------------------------------------------------------
// Academic sessions/terms
// ---------------------------------------------------------------------------

export class SandboxAcademicProvider extends AcademicProvider {
  private db: SandboxCapfluxDB;

  constructor() {
    super();
    assertSandboxMode(runtimeEnvironment.isSandbox, 'SandboxAcademicProvider');
    this.db = getSandboxDb();
  }

  private sessionToDomain(row: AnyRow): AcademicSession {
    return {
      id: String(row.id),
      schoolId: String(row.school_id ?? ''),
      name: String(row.name ?? ''),
      startDate: (row.start_date as string) ?? '',
      endDate: (row.end_date as string) ?? '',
      isCurrent: Boolean(row.is_current),
      status: ((row.status as AcademicSession['status']) ?? 'UPCOMING'),
      createdAt: String(row.created_at ?? ''),
      updatedAt: String(row.updated_at ?? ''),
    };
  }

  private termToDomain(row: AnyRow): AcademicTerm {
    return {
      id: String(row.id),
      sessionId: String(row.session_id ?? ''),
      schoolId: String(row.school_id ?? ''),
      name: String(row.name ?? ''),
      termNumber: Number(row.term_number ?? 1),
      displayOrder: Number(row.display_order ?? 1),
      startDate: (row.start_date as string) ?? '',
      endDate: (row.end_date as string) ?? '',
      isCurrent: Boolean(row.is_current),
      status: ((row.status as AcademicTerm['status']) ?? 'UPCOMING'),
      createdAt: String(row.created_at ?? ''),
      updatedAt: String(row.updated_at ?? ''),
    };
  }

  async createSession(data: { schoolId: string; name: string; startDate: string; endDate: string }): Promise<AcademicResult<AcademicSession>> {
    const duplicate = await this.db.academic_sessions
      .where('school_id')
      .equals(data.schoolId)
      .and((s) => s.name === data.name)
      .first();
    if (duplicate) return fail('SESSION_CREATE_FAILED', `Session "${data.name}" already exists`);

    const nowIso = new Date().toISOString();
    const row: AnyRow = {
      id: crypto.randomUUID(),
      school_id: data.schoolId,
      name: data.name,
      start_date: data.startDate,
      end_date: data.endDate,
      is_current: false,
      status: 'UPCOMING',
      created_at: nowIso,
      updated_at: nowIso,
      source: 'LOCAL',
      version: 1,
    };
    await this.db.academic_sessions.add(row as never);
    return ok(this.sessionToDomain(row));
  }

  async updateSession(sessionId: string, data: Partial<AcademicSession>): Promise<AcademicResult<AcademicSession>> {
    const row = await this.db.academic_sessions.get(sessionId);
    if (!row) return fail('SESSION_NOT_FOUND', 'Session not found');
    const updates: AnyRow = { updated_at: new Date().toISOString() };
    if (data.name !== undefined) updates.name = data.name;
    if (data.startDate !== undefined) updates.start_date = data.startDate;
    if (data.endDate !== undefined) updates.end_date = data.endDate;
    await this.db.academic_sessions.update(sessionId, updates);
    return ok(this.sessionToDomain({ ...row, ...updates }));
  }

  async getSession(sessionId: string): Promise<AcademicResult<AcademicSession>> {
    const row = await this.db.academic_sessions.get(sessionId);
    if (!row) return fail('SESSION_NOT_FOUND', 'Session not found');
    return ok(this.sessionToDomain(row));
  }

  async listSessions(schoolId: string): Promise<AcademicResult<AcademicSession[]>> {
    const rows = await this.db.academic_sessions.where('school_id').equals(schoolId).toArray();
    const mapped = rows.map((r) => this.sessionToDomain(r)).sort((a, b) => a.name.localeCompare(b.name));
    return ok(mapped);
  }

  /**
   * Activate one session atomically (mirrors the RPC semantics: demote all,
   * promote one — including locally cached Dexie rows).
   */
  async activateSession(sessionId: string): Promise<AcademicResult<AcademicSession>> {
    const target = await this.db.academic_sessions.get(sessionId);
    if (!target) return fail('SESSION_NOT_FOUND', 'Session not found');
    const all = await this.db.academic_sessions.where('school_id').equals(target.school_id).toArray();
    const nowIso = new Date().toISOString();
    for (const s of all) {
      const updates = s.id === sessionId
        ? { is_current: true, status: 'ACTIVE' as const, updated_at: nowIso }
        : { is_current: false, ...(s.status === 'ACTIVE' ? { status: 'COMPLETED' as const } : {}), updated_at: nowIso };
      await this.db.academic_sessions.update(s.id, updates);
    }
    return ok(this.sessionToDomain({ ...target, is_current: true, status: 'ACTIVE' }));
  }

  async createTerm(data: { sessionId: string; schoolId: string; name: string; termNumber: number; displayOrder: number; startDate: string; endDate: string }): Promise<AcademicResult<AcademicTerm>> {
    const duplicate = await this.db.academic_terms
      .where('session_id')
      .equals(data.sessionId)
      .and((t) => t.name === data.name)
      .first();
    if (duplicate) return fail('TERM_CREATE_FAILED', `Term "${data.name}" already exists in this session`);

    const nowIso = new Date().toISOString();
    const row: AnyRow = {
      id: crypto.randomUUID(),
      session_id: data.sessionId,
      school_id: data.schoolId,
      name: data.name,
      term_number: data.termNumber,
      display_order: data.displayOrder,
      start_date: data.startDate,
      end_date: data.endDate,
      is_current: false,
      status: 'UPCOMING',
      created_at: nowIso,
      updated_at: nowIso,
      source: 'LOCAL',
      version: 1,
    };
    await this.db.academic_terms.add(row as never);
    return ok(this.termToDomain(row));
  }

  async updateTerm(termId: string, data: Partial<AcademicTerm>): Promise<AcademicResult<AcademicTerm>> {
    const row = await this.db.academic_terms.get(termId);
    if (!row) return fail('TERM_NOT_FOUND', 'Term not found');
    const updates: AnyRow = { updated_at: new Date().toISOString() };
    if (data.name !== undefined) updates.name = data.name;
    if (data.startDate !== undefined) updates.start_date = data.startDate;
    if (data.endDate !== undefined) updates.end_date = data.endDate;
    await this.db.academic_terms.update(termId, updates);
    return ok(this.termToDomain({ ...row, ...updates }));
  }

  async getTerm(termId: string): Promise<AcademicResult<AcademicTerm>> {
    const row = await this.db.academic_terms.get(termId);
    if (!row) return fail('TERM_NOT_FOUND', 'Term not found');
    return ok(this.termToDomain(row));
  }

  async listTerms(sessionId: string): Promise<AcademicResult<AcademicTerm[]>> {
    const rows = await this.db.academic_terms.where('session_id').equals(sessionId).toArray();
    return ok(rows.map((r) => this.termToDomain(r)).sort((a, b) => a.displayOrder - b.displayOrder));
  }

  async activateTerm(termId: string): Promise<AcademicResult<AcademicTerm>> {
    const target = await this.db.academic_terms.get(termId);
    if (!target) return fail('TERM_NOT_FOUND', 'Term not found');
    const siblings = await this.db.academic_terms.where('session_id').equals(target.session_id).toArray();
    const nowIso = new Date().toISOString();
    for (const t of siblings) {
      await this.db.academic_terms.update(t.id, {
        is_current: t.id === termId,
        status: t.id === termId ? 'ACTIVE' : t.status === 'ACTIVE' ? 'COMPLETED' : t.status,
        updated_at: nowIso,
      });
    }
    return ok(this.termToDomain({ ...target, is_current: true, status: 'ACTIVE' }));
  }

  isConfigured(): boolean {
    return true;
  }
}

// ---------------------------------------------------------------------------
// Divisions (sections)
// ---------------------------------------------------------------------------

export class SandboxDivisionProvider extends DivisionProvider {
  private db: SandboxCapfluxDB;

  constructor() {
    super();
    assertSandboxMode(runtimeEnvironment.isSandbox, 'SandboxDivisionProvider');
    this.db = getSandboxDb();
  }

  private toDomain(row: AnyRow): SchoolDivision {
    return {
      id: String(row.id),
      schoolId: String(row.school_id ?? ''),
      name: String(row.name ?? ''),
      code: String(row.code ?? ''),
      displayOrder: Number(row.display_order ?? 0),
      status: ((row.status as SchoolDivision['status']) ?? 'ACTIVE'),
      description: (row.description as string) ?? undefined,
      createdAt: String(row.created_at ?? ''),
      updatedAt: String(row.updated_at ?? ''),
    };
  }

  async getDivision(divisionId: string): Promise<DivisionResult<SchoolDivision>> {
    const row = await this.db.school_divisions.get(divisionId);
    if (!row) return fail('DIVISION_NOT_FOUND' as never, 'Section not found');
    return ok(this.toDomain(row));
  }

  async listDivisions(schoolId: string): Promise<DivisionResult<SchoolDivision[]>> {
    const rows = await this.db.school_divisions.where('school_id').equals(schoolId).toArray();
    return ok(rows.map((r) => this.toDomain(r)).sort((a, b) => a.displayOrder - b.displayOrder));
  }

  async createDivision(data: { schoolId: string; name: string; code: string; displayOrder: number; description?: string }): Promise<DivisionResult<SchoolDivision>> {
    const duplicate = await this.db.school_divisions
      .where('school_id')
      .equals(data.schoolId)
      .and((d) => d.code === data.code || d.name === data.name)
      .first();
    if (duplicate) return fail('DIVISION_CREATE_FAILED' as never, `Section "${data.name}" already exists`);
    const nowIso = new Date().toISOString();
    const row: AnyRow = {
      id: crypto.randomUUID(),
      school_id: data.schoolId,
      name: data.name,
      code: data.code,
      display_order: data.displayOrder,
      description: data.description ?? null,
      status: 'ACTIVE',
      created_at: nowIso,
      updated_at: nowIso,
      source: 'LOCAL',
      version: 1,
    };
    await this.db.school_divisions.add(row as never);
    return ok(this.toDomain(row));
  }

  async updateDivision(divisionId: string, data: Partial<SchoolDivision>): Promise<DivisionResult<SchoolDivision>> {
    const row = await this.db.school_divisions.get(divisionId);
    if (!row) return fail('DIVISION_NOT_FOUND' as never, 'Section not found');
    const updates: AnyRow = { updated_at: new Date().toISOString() };
    if (data.name !== undefined) updates.name = data.name;
    if (data.code !== undefined) updates.code = data.code;
    if (data.description !== undefined) updates.description = data.description ?? null;
    await this.db.school_divisions.update(divisionId, updates);
    return ok(this.toDomain({ ...row, ...updates }));
  }

  private async setStatus(divisionId: string, status: 'ACTIVE' | 'INACTIVE'): Promise<DivisionResult<SchoolDivision>> {
    const row = await this.db.school_divisions.get(divisionId);
    if (!row) return fail('DIVISION_NOT_FOUND' as never, 'Section not found');
    const updates = { status, updated_at: new Date().toISOString() };
    await this.db.school_divisions.update(divisionId, updates);
    return ok(this.toDomain({ ...row, ...updates }));
  }

  deactivateDivision(divisionId: string): Promise<DivisionResult<SchoolDivision>> {
    return this.setStatus(divisionId, 'INACTIVE');
  }

  activateDivision(divisionId: string): Promise<DivisionResult<SchoolDivision>> {
    return this.setStatus(divisionId, 'ACTIVE');
  }

  isConfigured(): boolean {
    return true;
  }
}

// ---------------------------------------------------------------------------
// Fees
// ---------------------------------------------------------------------------

export class SandboxFeeProvider extends FeeProvider {
  private db: SandboxCapfluxDB;

  constructor() {
    super();
    assertSandboxMode(runtimeEnvironment.isSandbox, 'SandboxFeeProvider');
    this.db = getSandboxDb();
  }

  private toDomain(row: AnyRow): Fee {
    return {
      id: String(row.id),
      owner: ((row.owner as Fee['owner']) ?? 'SCHOOL'),
      schoolId: (row.school_id as string) ?? null,
      divisionId: (row.division_id as string) ?? null,
      academicLevelId: (row.academic_level_id as string) ?? null,
      name: String(row.name ?? ''),
      code: String(row.code ?? ''),
      isMandatory: Boolean(row.is_mandatory),
      isActive: (row.status as string) === 'ACTIVE',
      description: (row.description as string) ?? undefined,
      createdAt: String(row.created_at ?? ''),
      updatedAt: String(row.updated_at ?? ''),
    };
  }

  async listSchoolFees(schoolId: string): Promise<FeeResult<Fee[]>> {
    const rows = await this.db.fees.where('school_id').equals(schoolId).toArray();
    return ok(rows.map((r) => this.toDomain(r)));
  }

  async listPlatformFees(): Promise<FeeResult<Fee[]>> {
    // The demo dataset carries no platform-owned fees; platform levy is
    // computed by FeeRuleRepository in the billing path.
    return ok([]);
  }

  async createSchoolFee(data: { schoolId: string; divisionId: string; name: string; code: string; isMandatory: boolean; description?: string }): Promise<FeeResult<Fee>> {
    const duplicate = await this.db.fees
      .where('school_id')
      .equals(data.schoolId)
      .and((f) => f.division_id === data.divisionId && f.code === data.code)
      .first();
    if (duplicate) return fail('FEE_CREATE_FAILED' as never, `Fee "${data.code}" already exists for this section`);
    const nowIso = new Date().toISOString();
    const row: AnyRow = {
      id: crypto.randomUUID(),
      school_id: data.schoolId,
      division_id: data.divisionId,
      academic_level_id: null,
      name: data.name,
      code: data.code,
      amount_minor: null,
      currency: 'NGN',
      is_mandatory: data.isMandatory,
      owner: 'SCHOOL',
      description: data.description ?? null,
      status: 'ACTIVE',
      created_at: nowIso,
      updated_at: nowIso,
      source: 'LOCAL',
      version: 1,
    };
    await this.db.fees.add(row as never);
    return ok(this.toDomain(row));
  }

  async updateSchoolFee(feeId: string, data: Partial<Fee>): Promise<FeeResult<Fee>> {
    const row = await this.db.fees.get(feeId);
    if (!row) return fail('FEE_NOT_FOUND' as never, 'Fee not found');
    const updates: AnyRow = { updated_at: new Date().toISOString() };
    if (data.name !== undefined) updates.name = data.name;
    if (data.description !== undefined) updates.description = data.description ?? null;
    if (data.isActive !== undefined) updates.status = data.isActive ? 'ACTIVE' : 'INACTIVE';
    await this.db.fees.update(feeId, updates);
    return ok(this.toDomain({ ...row, ...updates }));
  }

  private async setActive(feeId: string, active: boolean): Promise<FeeResult<Fee>> {
    return this.updateSchoolFee(feeId, { isActive: active });
  }

  deactivateSchoolFee(feeId: string): Promise<FeeResult<Fee>> {
    return this.setActive(feeId, false);
  }

  activateSchoolFee(feeId: string): Promise<FeeResult<Fee>> {
    return this.setActive(feeId, true);
  }

  isConfigured(): boolean {
    return true;
  }
}

// ---------------------------------------------------------------------------
// Ledger (append-only)
// ---------------------------------------------------------------------------

export class SandboxLedgerProvider extends LedgerProvider {
  private db: SandboxCapfluxDB;

  constructor() {
    super();
    assertSandboxMode(runtimeEnvironment.isSandbox, 'SandboxLedgerProvider');
    this.db = getSandboxDb();
  }

  /** Append-only: entries are inserted once and never mutated afterwards. */
  override async createEntry(data: LedgerEntry): Promise<LedgerResult<LedgerEntry>> {
    // Source-document idempotency (mirrors uq_ledger_source_document).
    const all = await this.db.ledger_entries.toArray();
    const duplicate = all.find(
      (r) =>
        r.source_document_type === data.sourceDocumentType &&
        r.source_document_id === data.sourceDocumentId &&
        r.entry_type !== 'REVERSAL',
    );
    if (duplicate) {
      return {
        data: null,
        error: { code: 'DUPLICATE_LEDGER_ENTRY', message: 'An entry already exists for this source document' },
      };
    }
    await this.db.ledger_entries.put(domainEntryToRow(data) as never);
    return { data, error: null };
  }

  override async getEntry(entryId: string): Promise<LedgerResult<LedgerEntry>> {
    const row = await this.db.ledger_entries.get(entryId);
    if (!row) return ledgerNotFound();
    return ok(rowToDomainEntry(asLedgerRow(row)));
  }

  override async getEntryByNumber(entryNumber: string): Promise<LedgerResult<LedgerEntry | null>> {
    const all = await this.db.ledger_entries.toArray();
    const row = all.find((r) => r.entry_number === entryNumber);
    return ok(row ? rowToDomainEntry(asLedgerRow(row)) : null);
  }

  override async getEntryBySourceDocument(sourceDocumentType: string, sourceDocumentId: string): Promise<LedgerResult<LedgerEntry | null>> {
    const all = await this.db.ledger_entries.toArray();
    const row = all.find(
      (r) => r.source_document_type === sourceDocumentType && r.source_document_id === sourceDocumentId,
    );
    return ok(row ? rowToDomainEntry(asLedgerRow(row)) : null);
  }

  override async listEntries(schoolId: string): Promise<LedgerResult<LedgerEntry[]>> {
    const rows = await this.db.ledger_entries.where('school_id').equals(schoolId).toArray();
    const entries = rows
      .map((r) => rowToDomainEntry(asLedgerRow(r)))
      .sort((a, b) => a.sequenceNumber - b.sequenceNumber);
    return ok(entries);
  }

  override async listEntriesByStudent(studentId: string): Promise<LedgerResult<LedgerEntry[]>> {
    const rows = await this.db.ledger_entries.where('student_id').equals(studentId).toArray();
    const entries = rows
      .map((r) => rowToDomainEntry(asLedgerRow(r)))
      .sort((a, b) => a.sequenceNumber - b.sequenceNumber);
    return ok(entries);
  }

  override async listEntriesBySession(schoolId: string, sessionId: string): Promise<LedgerResult<LedgerEntry[]>> {
    const rows = (await this.db.ledger_entries.where('school_id').equals(schoolId).toArray())
      .filter((r) => r.academic_session_id === sessionId);
    return ok(rows.map((r) => rowToDomainEntry(asLedgerRow(r))).sort((a, b) => a.sequenceNumber - b.sequenceNumber));
  }

  override async listEntriesByTerm(schoolId: string, termId: string): Promise<LedgerResult<LedgerEntry[]>> {
    const rows = (await this.db.ledger_entries.where('school_id').equals(schoolId).toArray())
      .filter((r) => r.academic_term_id === termId);
    return ok(rows.map((r) => rowToDomainEntry(asLedgerRow(r))).sort((a, b) => a.sequenceNumber - b.sequenceNumber));
  }

  override async getLatestEntry(studentId: string): Promise<LedgerResult<LedgerEntry | null>> {
    const rows = await this.db.ledger_entries.where('student_id').equals(studentId).toArray();
    if (rows.length === 0) return ok(null);
    const latest = rows.reduce((a, b) => ((b.sequence_number ?? 0) > (a.sequence_number ?? 0) ? b : a));
    return ok(rowToDomainEntry(asLedgerRow(latest)));
  }

  override async getNextSequenceNumber(schoolId: string): Promise<LedgerResult<number>> {
    const rows = await this.db.ledger_entries.where('school_id').equals(schoolId).toArray();
    if (rows.length === 0) return ok(1);
    return ok(rows.reduce((max, r) => Math.max(max, Number(r.sequence_number ?? 0)), 0) + 1);
  }

  isConfigured(): boolean {
    return true;
  }
}

type LedgerishRow = Record<string, unknown>;

function asLedgerRow(row: LedgerishRow): Parameters<typeof rowToDomainEntry>[0] {
  return row as Parameters<typeof rowToDomainEntry>[0];
}

function ledgerNotFound(): { data: null; error: LedgerError } {
  return { data: null, error: { code: 'LEDGER_ENTRY_NOT_FOUND', message: 'Ledger entry not found' } };
}

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------

export class SandboxAuditProvider extends AuditProvider {
  private db: SandboxCapfluxDB;

  constructor() {
    super();
    assertSandboxMode(runtimeEnvironment.isSandbox, 'SandboxAuditProvider');
    this.db = getSandboxDb();
  }

  override async createEntry(entryInput: Omit<AuditEntry, 'id' | 'auditNumber' | 'createdAt'>): Promise<AuditResult<AuditEntry>> {
    const full: AuditEntry = {
      ...entryInput,
      id: crypto.randomUUID(),
      auditNumber: `AUD-SBX-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    // Persist into the append-only audit trail (sandbox-only table).
    await this.db.audit_trail.add({
      id: full.id,
      school_id: full.schoolId ?? DEMO_ORG_ID,
      actor_id: full.userId ?? 'unknown',
      actor_role: (full.metadata?.actorRole as string) ?? 'SYSTEM',
      action: full.action,
      entity: full.entity,
      entity_id: full.entityId ?? null,
      metadata: {
        environment: 'sandbox',
        ...full.metadata,
        description: full.description,
        severity: full.severity,
        result: full.result,
        sourceModule: full.sourceModule,
      },
      occurred_at: full.occurredAt,
    });
    return ok(full);
  }

  override async listEntries(filter: AuditFilter): Promise<AuditResult<AuditFilterResult>> {
    const rows = await this.db.audit_trail.toArray();
    const filtered = rows
      .filter((r) => !filter.schoolId || r.school_id === filter.schoolId)
      .map((r) => ({
        id: r.id,
        auditNumber: `AUD-SBX-${r.id.slice(0, 8)}`,
        organizationId: DEMO_ORG_ID,
        schoolId: r.school_id ?? undefined,
        userId: r.actor_id,
        sourceModule: (r.metadata?.sourceModule as string) ?? 'SYSTEM',
        action: r.action,
        entity: r.entity,
        entityId: r.entity_id ?? undefined,
        description: (r.metadata?.description as string) ?? `${r.action} on ${r.entity}`,
        severity: (r.metadata?.severity as string) ?? 'INFO',
        result: (r.metadata?.result as string) ?? 'SUCCESS',
        metadata: r.metadata ?? {},
        occurredAt: r.occurred_at,
        createdAt: r.occurred_at,
      }))
      .filter((e) => !filter.action || e.action === filter.action)
      .filter((e) => !filter.entityId || e.entityId === filter.entityId)
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));

    const page = filter.page ?? 1;
    const pageSize = filter.pageSize ?? 25;
    const start = (page - 1) * pageSize;
    return ok({
      entries: filtered.slice(start, start + pageSize),
      total: filtered.length,
      page,
      pageSize,
    });
  }

  override async getEntry(id: string): Promise<AuditResult<AuditEntry | null>> {
    const row = await this.db.audit_trail.get(id);
    if (!row) return ok(null);
    return ok({
      id: row.id,
      auditNumber: `AUD-SBX-${row.id.slice(0, 8)}`,
      organizationId: DEMO_ORG_ID,
      schoolId: row.school_id ?? undefined,
      userId: row.actor_id,
      sourceModule: 'SYSTEM',
      action: row.action,
      entity: row.entity,
      entityId: row.entity_id ?? undefined,
      description: (row.metadata?.description as string) ?? `${row.action} on ${row.entity}`,
      severity: 'INFO',
      result: 'SUCCESS',
      metadata: row.metadata ?? {},
      occurredAt: row.occurred_at,
      createdAt: row.occurred_at,
    } as unknown as AuditEntry);
  }

  override async countEntries(filter: Omit<AuditFilter, 'page' | 'pageSize'>): Promise<AuditResult<number>> {
    const rows = await this.db.audit_trail.toArray();
    return ok(rows.filter((r) => !filter.schoolId || r.school_id === filter.schoolId).length);
  }
}
