/**
 * Enrollment domain — immutable academic placement history.
 *
 * A student's placement is never a mutable field: every placement lives in
 * student_enrollments. Moving or promoting a student closes the current row
 * (SUPERSEDED) and appends a new ACTIVE row. Historical financial records are
 * NEVER touched by this module.
 */

import {
  LocalRepository,
  type StudentEnrollmentRow,
  type AcademicLevelRow,
  type SchoolDivisionRow,
  type AcademicSessionRow,
  type EnrollmentReason,
} from '../../offline/localDb';
import { db } from '../../offline/localDb';

export interface EnrollInput {
  schoolId: string;
  studentId: string;
  sessionId: string;
  sectionId: string;
  levelId: string;
  reason?: Extract<EnrollmentReason, 'INITIAL' | 'IMPORT' | 'MIGRATION'>;
  effectiveDate?: string;
  createdBy?: string | null;
  source?: string | null;
}

export interface MoveInput {
  sessionId: string;
  sectionId: string;
  levelId: string;
}

export interface SkippedStudent {
  studentId: string;
  name?: string;
  reason: string;
}

export interface BulkMovePlan {
  eligible: Array<{ studentId: string; name?: string }>;
  skipped: SkippedStudent[];
  fromLevelId: string;
}

export interface ApplyMoveResult {
  moved: Array<{ studentId: string }>;
  failed: SkippedStudent[];
}

export interface EnrollmentError {
  code:
    | 'STUDENT_NOT_FOUND'
    | 'SESSION_NOT_FOUND'
    | 'SECTION_NOT_FOUND'
    | 'LEVEL_NOT_FOUND'
    | 'LEVEL_INACTIVE'
    | 'SECTION_INACTIVE'
    | 'NO_ACTIVE_ENROLLMENT'
    | 'ALREADY_AT_TARGET'
    | 'VALIDATION_ERROR'
    | 'PROMOTION_NO_NEXT_LEVEL'
    | 'UNKNOWN';
  message: string;
}

export type EnrollmentResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: EnrollmentError };

const nowIso = () => new Date().toISOString();

function err(code: EnrollmentError['code'], message: string): EnrollmentResult<never> {
  return { ok: false, error: { code, message } };
}

async function getStudent(studentId: string) {
  return db.students.get(studentId);
}

/** Resolve names for display (history rows, placement cards, exports). */
export async function hydrateEnrollment(enrollment: StudentEnrollmentRow): Promise<{
  enrollment: StudentEnrollmentRow;
  session?: AcademicSessionRow;
  section?: SchoolDivisionRow;
  level?: AcademicLevelRow;
}> {
  const [session, section, level] = await Promise.all([
    db.academic_sessions.get(enrollment.academic_session_id),
    db.school_divisions.get(enrollment.section_id),
    db.academic_levels.get(enrollment.level_id),
  ]);
  return { enrollment, session, section, level };
}

export const EnrollmentService = {
  /**
   * Create the initial ACTIVE enrollment for a student.
   * Rejects if the student already has an ACTIVE enrollment in that session.
   */
  async enrollStudent(input: EnrollInput): Promise<EnrollmentResult<StudentEnrollmentRow>> {
    const { schoolId, studentId, sessionId, sectionId, levelId } = input;
    if (!schoolId || !studentId || !sessionId || !sectionId || !levelId) {
      return err('VALIDATION_ERROR', 'school, student, session, section and level are required');
    }

    const [student, session, section, level] = await Promise.all([
      getStudent(studentId),
      db.academic_sessions.get(sessionId),
      db.school_divisions.get(sectionId),
      db.academic_levels.get(levelId),
    ]);
    if (!student) return err('STUDENT_NOT_FOUND', `Student ${studentId} not found`);
    if (!session) return err('SESSION_NOT_FOUND', 'Academic session not found');
    if (!section) return err('SECTION_NOT_FOUND', 'Academic section not found');
    if (!level) return err('LEVEL_NOT_FOUND', 'Academic level not found');
    if (level.status !== 'ACTIVE') return err('LEVEL_INACTIVE', `Academic level "${level.name}" is inactive`);
    if (section.status !== 'ACTIVE') return err('SECTION_INACTIVE', `Section "${section.name}" is inactive`);

    const existing = await LocalRepository.getActiveEnrollmentForStudent(studentId, sessionId);
    if (existing) {
      return err(
        'ALREADY_AT_TARGET',
        `Student already has an active enrollment in ${session.name}`
      );
    }

    const now = nowIso();
    const row: StudentEnrollmentRow = {
      id: crypto.randomUUID(),
      school_id: schoolId,
      student_id: studentId,
      academic_session_id: sessionId,
      section_id: sectionId,
      level_id: levelId,
      status: 'ACTIVE',
      effective_date: input.effectiveDate ?? now,
      ended_at: null,
      reason: input.reason ?? 'INITIAL',
      source: input.source ?? null,
      created_by: input.createdBy ?? null,
      created_at: now,
      updated_at: now,
    };
    await LocalRepository.saveStudentEnrollment(row);

    // Outbox upload (offline-first). Payload keys = Supabase columns.
    await LocalRepository.enqueueSyncItem({
      school_id: schoolId,
      entity_type: 'student_enrollments',
      entity_id: row.id,
      operation: 'UPSERT',
      payload: { ...row },
    });

    // Denormalized display label for legacy flows (SQL registration fn).
    await this.syncLegacyPlacementFields(studentId, schoolId);

    return { ok: true, data: row };
  },

  /** Current ACTIVE enrollment, optionally within one session. */
  async getActiveEnrollment(studentId: string, sessionId?: string) {
    return LocalRepository.getActiveEnrollmentForStudent(studentId, sessionId);
  },

  /** Full placement history, newest first. */
  async getEnrollmentHistory(studentId: string): Promise<StudentEnrollmentRow[]> {
    const rows = await LocalRepository.getEnrollmentsByStudent(studentId);
    return rows.sort((a, b) => (b.effective_date ?? '').localeCompare(a.effective_date ?? ''));
  },

  /**
   * Move a student to a new placement. Closes the current ACTIVE row
   * (SUPERSEDED + ended_at) and appends a new ACTIVE row. Never mutates
   * ledger entries, charges, payments or any other financial record.
   */
  async moveStudent(
    studentId: string,
    to: MoveInput,
    reason: Extract<EnrollmentReason, 'MOVEMENT' | 'PROMOTION'> = 'MOVEMENT',
    context?: { createdBy?: string | null; source?: string | null }
  ): Promise<EnrollmentResult<StudentEnrollmentRow>> {
    const [current, session, section, level] = await Promise.all([
      this.getActiveEnrollment(studentId, to.sessionId),
      db.academic_sessions.get(to.sessionId),
      db.school_divisions.get(to.sectionId),
      db.academic_levels.get(to.levelId),
    ]);

    const student = await getStudent(studentId);
    if (!student) return err('STUDENT_NOT_FOUND', `Student ${studentId} not found`);
    if (!session) return err('SESSION_NOT_FOUND', 'Target session not found');
    if (!section) return err('SECTION_NOT_FOUND', 'Target section not found');
    if (!level) return err('LEVEL_NOT_FOUND', 'Target academic level not found');
    if (level.status !== 'ACTIVE') return err('LEVEL_INACTIVE', `Academic level "${level.name}" is inactive`);
    if (section.status !== 'ACTIVE') return err('SECTION_INACTIVE', `Section "${section.name}" is inactive`);
    if (level.id === current?.level_id && section.id === current?.section_id) {
      return err('ALREADY_AT_TARGET', 'Student is already placed at this level');
    }
    if (!current) {
      // No existing placement in this session — treat as initial enrollment
      return this.enrollStudent({
        schoolId: student.school_id,
        studentId,
        sessionId: to.sessionId,
        sectionId: to.sectionId,
        levelId: to.levelId,
        reason: 'INITIAL',
        createdBy: context?.createdBy ?? null,
        source: context?.source ?? null,
      });
    }

    const now = nowIso();

    // Close current row (append-only history: status closure only).
    await db.student_enrollments.update(current.id, { status: 'SUPERSEDED', ended_at: now, updated_at: now });
    await LocalRepository.enqueueSyncItem({
      school_id: current.school_id,
      entity_type: 'student_enrollments',
      entity_id: current.id,
      operation: 'UPSERT',
      payload: {
        ...current,
        status: 'SUPERSEDED',
        ended_at: now,
        updated_at: now,
      },
    });

    const next: StudentEnrollmentRow = {
      id: crypto.randomUUID(),
      school_id: current.school_id,
      student_id: studentId,
      academic_session_id: to.sessionId,
      section_id: to.sectionId,
      level_id: to.levelId,
      status: 'ACTIVE',
      effective_date: now,
      ended_at: null,
      reason,
      source: context?.source ?? null,
      created_by: context?.createdBy ?? null,
      created_at: now,
      updated_at: now,
    };
    await LocalRepository.saveStudentEnrollment(next);
    await LocalRepository.enqueueSyncItem({
      school_id: next.school_id,
      entity_type: 'student_enrollments',
      entity_id: next.id,
      operation: 'UPSERT',
      payload: { ...next },
    });

    await this.syncLegacyPlacementFields(studentId, current.school_id);
    return { ok: true, data: next };
  },

  /**
   * Plan a bulk move from one level to another. Reports eligible students
   * and explicit exceptions instead of silently skipping them.
   */
  async planBulkMove(fromLevelId: string, to: MoveInput, selectedIds?: string[]): Promise<BulkMovePlan> {
    const enrollments = await db.student_enrollments
      .where('level_id')
      .equals(fromLevelId)
      .toArray();
    const active = enrollments.filter((e) => e.status === 'ACTIVE');

    const targetLevel = await db.academic_levels.get(to.levelId);
    const targetSection = targetLevel ? await db.school_divisions.get(targetLevel.section_id) : undefined;

    const eligible: BulkMovePlan['eligible'] = [];
    const skipped: SkippedStudent[] = [];

    for (const e of active) {
      if (selectedIds && !selectedIds.includes(e.student_id)) continue;
      const student = await getStudent(e.student_id);
      if (!student) {
        skipped.push({ studentId: e.student_id, reason: 'Student record not found' });
        continue;
      }
      const status = (student.status ?? '').toString().toUpperCase();
      if (['ARCHIVED', 'WITHDRAWN', 'GRADUATED'].includes(status)) {
        skipped.push({
          studentId: e.student_id,
          name: `${student.first_name ?? ''} ${student.last_name ?? ''}`.trim(),
          reason: `Student is ${status.toLowerCase()}`,
        });
        continue;
      }
      if (e.level_id === to.levelId && e.section_id === to.sectionId) {
        skipped.push({
          studentId: e.student_id,
          name: `${student.first_name ?? ''} ${student.last_name ?? ''}`.trim(),
          reason: 'Already enrolled at destination',
        });
        continue;
      }
      eligible.push({
        studentId: e.student_id,
        name: `${student.first_name ?? ''} ${student.last_name ?? ''}`.trim(),
      });
    }

    void targetLevel;
    void targetSection;
    return { eligible, skipped, fromLevelId };
  },

  /** Execute a planned bulk move. Per-student failures are reported, never silent. */
  async applyMove(
    studentIds: string[],
    to: MoveInput,
    reason: Extract<EnrollmentReason, 'MOVEMENT' | 'PROMOTION'>,
    context?: { createdBy?: string | null; source?: string | null }
  ): Promise<ApplyMoveResult> {
    const moved: ApplyMoveResult['moved'] = [];
    const failed: SkippedStudent[] = [];
    for (const studentId of studentIds) {
      const result = await this.moveStudent(studentId, to, reason, context);
      if (result.ok) moved.push({ studentId });
      else failed.push({ studentId, reason: result.error.message });
    }
    return { moved, failed };
  },

  /**
   * Promotion destination: the level with the next display_order in the same
   * section (explicit ordering — never alphabetical).
   */
  async getNextLevelInSection(sectionId: string, currentLevelId: string): Promise<EnrollmentResult<AcademicLevelRow>> {
    const levels = (await db.academic_levels.where('section_id').equals(sectionId).toArray())
      .filter((l) => l.status === 'ACTIVE')
      .sort((a, b) => a.display_order - b.display_order);
    const idx = levels.findIndex((l) => l.id === currentLevelId);
    if (idx === -1) return err('LEVEL_NOT_FOUND', 'Current level not found in section ordering');
    if (idx === levels.length - 1) {
      return err('PROMOTION_NO_NEXT_LEVEL', 'This is the final level of the section');
    }
    return { ok: true, data: levels[idx + 1] };
  },

  /**
   * Plan promotion for an entire level: everyone moves to the next level by
   * display order within the same section.
   */
  async planPromotion(fromLevelId: string, selectedIds?: string[]): Promise<
    EnrollmentResult<{ plan: BulkMovePlan; to: MoveInput; toLevelName: string }>
  > {
    const levelsWithFrom = await db.student_enrollments.where('level_id').equals(fromLevelId).toArray();
    const activeFrom = levelsWithFrom.find((e) => e.status === 'ACTIVE') ?? levelsWithFrom[0];
    if (!activeFrom) {
      return err('NO_ACTIVE_ENROLLMENT', 'No students currently enrolled at this level');
    }
    const fromLevel = await db.academic_levels.get(fromLevelId);
    if (!fromLevel) return err('LEVEL_NOT_FOUND', 'Source level not found');

    const next = await this.getNextLevelInSection(fromLevel.section_id, fromLevelId);
    if (!next.ok) return next;

    const plan = await this.planBulkMove(fromLevelId, {
      sessionId: activeFrom.academic_session_id,
      sectionId: fromLevel.section_id,
      levelId: next.data.id,
    }, selectedIds);

    return {
      ok: true,
      data: {
        plan,
        to: { sessionId: activeFrom.academic_session_id, sectionId: fromLevel.section_id, levelId: next.data.id },
        toLevelName: next.data.name,
      },
    };
  },

  /**
   * Keep students.division_id / class_name as denormalized display labels so
   * legacy flows (SQL registration function, existing UI fallbacks) keep working.
   */
  async syncLegacyPlacementFields(studentId: string, _schoolId: string): Promise<void> {
    const current = await this.getActiveEnrollment(studentId);
    if (!current) return;
    const [section, level] = await Promise.all([
      db.school_divisions.get(current.section_id),
      db.academic_levels.get(current.level_id),
    ]);
    const label = level && section ? `${level.name}` : level?.name ?? '';
    const updates: Record<string, unknown> = {};
    if (section && section.id) updates.division_id = section.id;
    if (label && label !== '__UNASSIGNED__') updates.class_name = label;
    if (Object.keys(updates).length === 0) return;
    await db.students.update(studentId, updates);
    await LocalRepository.enqueueSyncItem({
      school_id: current.school_id,
      entity_type: 'students',
      entity_id: studentId,
      operation: 'UPDATE',
      payload: { id: studentId, ...updates, updated_at: nowIso() },
    });
  },
};
