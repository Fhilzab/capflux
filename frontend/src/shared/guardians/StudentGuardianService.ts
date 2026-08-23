/**
 * StudentGuardianService — multi-guardian relationships.
 *
 * students.guardian_id remains the primary guardian pointer consumed by
 * notifications/billing; this service maintains the richer student_guardians
 * join and mirrors primary changes into the legacy pointer. On replay, the
 * server's set_student_primary_guardian RPC performs the demote→promote→
 * mirror atomically (server authority), while offline devices converge via
 * last-write-wins upserts plus the partial unique index.
 */

import { LocalRepository, db } from '../../offline/localDb';
import type { StudentGuardianRow } from '../../offline/localDb';
import { hasSupabaseConfig, getSupabase } from '../../lib/supabase';
import {
  normalizeGuardianRelationship,
  type GuardianRelationship,
} from './relationshipTypes';

export interface StudentGuardianError {
  code:
    | 'LINK_EXISTS'
    | 'LINK_NOT_FOUND'
    | 'GUARDIAN_NOT_FOUND'
    | 'STUDENT_NOT_FOUND'
    | 'VALIDATION_ERROR'
    | 'UNKNOWN';
  message: string;
}

export type StudentGuardianResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: StudentGuardianError };

function err<T>(code: StudentGuardianError['code'], message: string): StudentGuardianResult<T> {
  return { ok: false, error: { code, message } };
}

const nowIso = () => new Date().toISOString();

export interface LinkGuardianInput {
  schoolId: string;
  studentId: string;
  guardianId: string;
  relationship?: GuardianRelationship;
  isPrimary?: boolean;
}

export const StudentGuardianService = {
  /** All guardians linked to a student (with link metadata). */
  async getGuardiansForStudent(studentId: string): Promise<StudentGuardianRow[]> {
    return LocalRepository.getGuardianLinksForStudent(studentId);
  },

  /** All students linked to a guardian. */
  async getStudentsForGuardian(guardianId: string): Promise<StudentGuardianRow[]> {
    return LocalRepository.getStudentsForGuardian(guardianId);
  },

  async linkGuardian(input: LinkGuardianInput): Promise<StudentGuardianResult<StudentGuardianRow>> {
    const { schoolId, studentId, guardianId } = input;
    if (!schoolId || !studentId || !guardianId) {
      return err('VALIDATION_ERROR', 'school, student and guardian are required');
    }

    const [student, guardian] = await Promise.all([
      db.students.get(studentId),
      db.guardians.get(guardianId),
    ]);
    if (!student) return err('STUDENT_NOT_FOUND', 'Student not found');
    if (!guardian) return err('GUARDIAN_NOT_FOUND', 'Guardian not found');

    const existing = await db.student_guardians
      .where('student_id')
      .equals(studentId)
      .and((l) => l.guardian_id === guardianId)
      .first();
    if (existing) return err('LINK_EXISTS', 'This guardian is already linked to the student');

    const makePrimary = input.isPrimary ?? false;
    const row: StudentGuardianRow = {
      id: crypto.randomUUID(),
      school_id: schoolId,
      student_id: studentId,
      guardian_id: guardianId,
      relationship: normalizeGuardianRelationship(input.relationship ?? 'GUARDIAN'),
      is_primary: makePrimary,
      created_at: nowIso(),
      updated_at: nowIso(),
    };
    await LocalRepository.saveStudentGuardian(row);
    await LocalRepository.enqueueSyncItem({
      school_id: schoolId,
      entity_type: 'student_guardians',
      entity_id: row.id,
      operation: 'UPSERT',
      payload: { ...row },
    });

    if (makePrimary) await this.setPrimaryGuardian(studentId, row.id);
    return { ok: true, data: row };
  },

  async unlinkGuardian(linkId: string): Promise<StudentGuardianResult<{ id: string }>> {
    const link = await db.student_guardians.get(linkId);
    if (!link) return err('LINK_NOT_FOUND', 'Guardian link not found');

    const wasPrimary = link.is_primary;
    await LocalRepository.deleteStudentGuardian(linkId);
    // Deletion propagates via outbox as a DELETE payload handled by the
    // upload engine's delete branch for local-owned entities.
    await LocalRepository.enqueueSyncItem({
      school_id: link.school_id,
      entity_type: 'student_guardians',
      entity_id: linkId,
      operation: 'DELETE',
      payload: { id: linkId },
    });

    if (wasPrimary) {
      // Promote another linked guardian to primary so notifications keep flowing.
      const remaining = await this.getGuardiansForStudent(link.student_id);
      const next = remaining.sort((a, b) => a.created_at.localeCompare(b.created_at))[0];
      if (next) await this.setPrimaryGuardian(link.student_id, next.id);
      else {
        // No guardians remain — clear the legacy pointer too.
        await db.students.update(link.student_id, { guardian_id: undefined });
        await LocalRepository.enqueueSyncItem({
          school_id: link.school_id,
          entity_type: 'students',
          entity_id: link.student_id,
          operation: 'UPDATE',
          payload: { id: link.student_id, guardian_id: null, updated_at: nowIso() },
        });
      }
    }
    return { ok: true, data: { id: linkId } };
  },

  /**
   * Mark one link as the student's primary and mirror into
   * students.guardian_id. Enqueue order is deterministic (demote all
   * others first, then promote, then mirror the pointer) so outbox replay
   * converges even when two devices race different promotions — the
   * server's partial unique index + atomic RPC resolve the winner.
   */
  async setPrimaryGuardian(studentId: string, linkId: string): Promise<StudentGuardianResult<StudentGuardianRow>> {
    const target = await db.student_guardians.get(linkId);
    if (!target || target.student_id !== studentId) {
      return err('LINK_NOT_FOUND', 'Guardian link not found');
    }

    const links = await this.getGuardiansForStudent(studentId);
    // Demote first — never two primaries, even mid-replay.
    for (const link of links) {
      if (link.id !== linkId && link.is_primary) {
        const demoted = { ...link, is_primary: false, updated_at: nowIso() };
        await db.student_guardians.update(link.id, { is_primary: false, updated_at: demoted.updated_at });
        await LocalRepository.enqueueSyncItem({
          school_id: link.school_id,
          entity_type: 'student_guardians',
          entity_id: link.id,
          operation: 'UPSERT',
          payload: demoted as unknown as Record<string, unknown>,
        });
      }
    }

    const promoted = { ...target, is_primary: true, updated_at: nowIso() };
    await db.student_guardians.update(linkId, { is_primary: true, updated_at: promoted.updated_at });

    // Online fast path: the server RPC performs demote→promote→mirror in one
    // transaction (server authority for primary conflicts). Offline — or if
    // the RPC is unavailable — the deterministic outbox upserts below still
    // converge: last-write-wins plus the partial unique index on the server.
    let rpcApplied = false;
    if (hasSupabaseConfig && typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        const { error } = await getSupabase().rpc('set_student_primary_guardian', {
          p_school_id: target.school_id,
          p_student_id: studentId,
          p_guardian_id: target.guardian_id,
        });
        if (!error) rpcApplied = true;
      } catch {
        // fall through to outbox path
      }
    }

    if (!rpcApplied) {
      await LocalRepository.enqueueSyncItem({
        school_id: target.school_id,
        entity_type: 'student_guardians',
        entity_id: linkId,
        operation: 'UPSERT',
        payload: promoted as unknown as Record<string, unknown>,
      });
    }

    // Mirror to legacy pointer (notifications/billing read this field).
    await db.students.update(studentId, { guardian_id: target.guardian_id });
    if (!rpcApplied) {
      await LocalRepository.enqueueSyncItem({
        school_id: target.school_id,
        entity_type: 'students',
        entity_id: studentId,
        operation: 'UPDATE',
        payload: { id: studentId, guardian_id: target.guardian_id, updated_at: nowIso() },
      });
    }

    return { ok: true, data: promoted };
  },

  /** Update the relationship type on an existing link. */
  async updateRelationshipType(
    linkId: string,
    relationship: GuardianRelationship
  ): Promise<StudentGuardianResult<StudentGuardianRow>> {
    const link = await db.student_guardians.get(linkId);
    if (!link) return err('LINK_NOT_FOUND', 'Guardian link not found');

    const updated: StudentGuardianRow = {
      ...link,
      relationship: normalizeGuardianRelationship(relationship),
      updated_at: nowIso(),
    };
    await LocalRepository.saveStudentGuardian(updated);
    await LocalRepository.enqueueSyncItem({
      school_id: link.school_id,
      entity_type: 'student_guardians',
      entity_id: linkId,
      operation: 'UPSERT',
      payload: updated as unknown as Record<string, unknown>,
    });
    return { ok: true, data: updated };
  },

  /** Search guardians by name/phone within a school (for the link picker). */
  async searchGuardians(schoolId: string, query: string) {
    const normalized = query.trim().toLowerCase();
    const all = await db.guardians.where('school_id').equals(schoolId).toArray();
    if (!normalized) return all.slice(0, 20);
    return all
      .filter(
        (g) =>
          (g.full_name ?? '').toLowerCase().includes(normalized) ||
          (g.primary_phone ?? '').includes(normalized) ||
          (g.email ?? '').toLowerCase().includes(normalized)
      )
      .slice(0, 20);
  },

  /**
   * Local consistency repair: ensure exactly one primary link exists and
   * that students.guardian_id mirrors it. Used when a link row arrives
   * from sync in a state the local device never produced (e.g. after a
   * conflicting replay on another device).
   */
  async repairLocalConsistency(studentId: string): Promise<void> {
    const links = await this.getGuardiansForStudent(studentId);
    if (links.length === 0) return;

    const primaries = links.filter((l) => l.is_primary);
    const student = await db.students.get(studentId);

    let winner: StudentGuardianRow | undefined;
    if (primaries.length > 1) {
      // Last-write-wins by updated_at, then created_at as tiebreaker.
      winner = [...primaries].sort(
        (a, b) =>
          (b.updated_at ?? b.created_at).localeCompare(a.updated_at ?? a.created_at) ||
          b.created_at.localeCompare(a.created_at)
      )[0];
    } else if (primaries.length === 1) {
      winner = primaries[0];
    } else {
      // No primary at all — oldest link wins.
      winner = [...links].sort((a, b) => a.created_at.localeCompare(b.created_at))[0];
      await db.student_guardians.update(winner.id, { is_primary: true });
    }

    for (const link of links) {
      const should = link.id === winner!.id;
      if (link.is_primary !== should) {
        await db.student_guardians.update(link.id, { is_primary: should });
      }
    }

    if (student && student.guardian_id !== winner!.guardian_id) {
      await db.students.update(studentId, { guardian_id: winner!.guardian_id });
    }
  },
};
