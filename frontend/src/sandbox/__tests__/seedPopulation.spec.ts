/**
 * Sandbox population integrity — class-level enrolment constraints.
 *
 * Seed v4 builds the dataset class-first from CLASS_POPULATIONS:
 *   Nursery (each class):  15 <= pupils <= 25
 *   Primary (each class):  25 <= pupils <= 35
 *   JSS / SS (each class): 30 <= students <= 60
 * Total must land in 375–645 (target ~480).
 */
import { describe, expect, it } from 'vitest';
import {
  createFakeSandboxDb,
  useSandboxFixture,
  type FakeSandboxDb,
} from './helpers/sandboxTestHarness';
import { AGE_RANGES, CLASS_POPULATIONS, DEMO_LEVELS } from '../seed/demoData';
import type { SeedResult } from '../seed/seedSandbox';

async function rows(db: FakeSandboxDb, table: string): Promise<Array<Record<string, unknown>>> {
  return (db[table] as unknown as { toArray(): Promise<Array<Record<string, unknown>>> }).toArray();
}

describe('sandbox population integrity', () => {
  useSandboxFixture();

  async function seed(db: FakeSandboxDb): Promise<SeedResult> {
    const { seedSandboxDatabase } = await import('../seed/seedSandbox');
    return seedSandboxDatabase(db as never);
  }

  it('populates every class to its deterministic target within the required range', async () => {
    const db = createFakeSandboxDb();
    await seed(db);
    const students = await rows(db, 'students');

    for (const spec of CLASS_POPULATIONS) {
      // Deterministic enrolment target counts every placed student; the
      // archived leavers (last seats overall) still belong to their class.
      const inClass = students.filter((s) => s.class_name === spec.levelName);
      expect(inClass.length).toBe(spec.targetCount);
      // The visible (ACTIVE) roster must also satisfy the section range.
      const activeInClass = inClass.filter((s) => s.status === 'ACTIVE');
      if (spec.sectionCode === 'NUR') {
        expect(activeInClass.length).toBeGreaterThanOrEqual(15);
        expect(activeInClass.length).toBeLessThanOrEqual(25);
      } else if (spec.sectionCode === 'PRI') {
        expect(activeInClass.length).toBeGreaterThanOrEqual(25);
        expect(activeInClass.length).toBeLessThanOrEqual(35);
      } else {
        expect(activeInClass.length).toBeGreaterThanOrEqual(30);
        expect(activeInClass.length).toBeLessThanOrEqual(60);
      }
    }
  });

  it('total population is a realistic school size (375–645, target ~480)', async () => {
    const db = createFakeSandboxDb();
    const result = await seed(db);
    expect(result.students).toBeGreaterThanOrEqual(375);
    expect(result.students).toBeLessThanOrEqual(645);
    expect(result.students).toBeGreaterThanOrEqual(450);
    expect(result.students).toBeLessThanOrEqual(500);
  });

  it('covers all 15 classes across Nursery, Primary, JSS and SS', async () => {
    const db = createFakeSandboxDb();
    await seed(db);
    const levels = await rows(db, 'academic_levels');
    const names = levels.map((l) => String(l.name));
    for (const expected of ['Nursery 1', 'Nursery 2', 'Nursery 3', 'Primary 1', 'Primary 6', 'JSS 1', 'JSS 3', 'SS 1', 'SS 3']) {
      expect(names).toContain(expected);
    }
    expect(DEMO_LEVELS.length).toBe(15);
  });

  it('student ages are consistent with their class', async () => {
    const db = createFakeSandboxDb();
    await seed(db);
    const students = await rows(db, 'students');
    const currentYear = new Date().getFullYear();
    for (const s of students) {
      const levelIndex = DEMO_LEVELS.findIndex((l) => l.name === String(s.class_name));
      expect(levelIndex).toBeGreaterThanOrEqual(0);
      const range = AGE_RANGES[levelIndex]!;
      const birthYear = Number(String(s.date_of_birth).slice(0, 4));
      const age = currentYear - birthYear;
      // One-year tolerance for month/day boundaries.
      expect(age).toBeGreaterThanOrEqual(range.min - 1);
      expect(age).toBeLessThanOrEqual(range.max + 1);
    }
  });

  it('every student has an ACTIVE enrollment and at least one guardian link', async () => {
    const db = createFakeSandboxDb();
    await seed(db);
    const students = await rows(db, 'students');
    const enrollments = await rows(db, 'student_enrollments');
    const links = await rows(db, 'student_guardians');

    const activeByStudent = new Map<string, number>();
    for (const e of enrollments) {
      if (e.status === 'ACTIVE' && e.academic_session_id === 'sd-ses-cur') {
        activeByStudent.set(String(e.student_id), (activeByStudent.get(String(e.student_id)) ?? 0) + 1);
      }
    }
    const linksByStudent = new Map<string, number>();
    for (const l of links) {
      linksByStudent.set(String(l.student_id), (linksByStudent.get(String(l.student_id)) ?? 0) + 1);
    }
    for (const s of students) {
      expect(activeByStudent.get(String(s.id))).toBe(1);
      expect(linksByStudent.get(String(s.id)) ?? 0).toBeGreaterThanOrEqual(1);
    }
  });

  it('sibling groups exist — some guardians care for multiple children', async () => {
    const db = createFakeSandboxDb();
    await seed(db);
    const links = await rows(db, 'student_guardians');
    const primary = links.filter((l) => l.is_primary === true);
    const byGuardian = new Map<string, Set<string>>();
    for (const l of primary) {
      const set = byGuardian.get(String(l.guardian_id)) ?? new Set<string>();
      set.add(String(l.student_id));
      byGuardian.set(String(l.guardian_id), set);
    }
    const multiChild = [...byGuardian.values()].filter((set) => set.size >= 2);
    expect(multiChild.length).toBeGreaterThan(10);
  });

  it('siblings sharing a guardian share a family surname', async () => {
    const db = createFakeSandboxDb();
    await seed(db);
    const students = await rows(db, 'students');
    const links = await rows(db, 'student_guardians');
    const guardians = await rows(db, 'guardians');
    const studentById = new Map(students.map((s) => [String(s.id), s]));
    const guardianSurname = new Map(
      guardians.map((g) => [String(g.id), String(g.full_name).split(' ').slice(-1)[0]]),
    );
    const primary = links.filter((l) => l.is_primary === true);
    const byGuardian = new Map<string, string[]>();
    for (const l of primary) {
      const list = byGuardian.get(String(l.guardian_id)) ?? [];
      list.push(String(l.student_id));
      byGuardian.set(String(l.guardian_id), list);
    }
    let checked = 0;
    for (const [guardianId, studentIds] of byGuardian) {
      if (studentIds.length < 2) continue;
      for (const sid of studentIds) {
        expect(String(studentById.get(sid)?.last_name)).toBe(guardianSurname.get(guardianId));
        checked += 1;
        if (checked >= 25) break;
      }
      if (checked >= 25) break;
    }
    expect(checked).toBeGreaterThan(0);
  });
});
