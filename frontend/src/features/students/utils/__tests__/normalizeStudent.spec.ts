import type { NormalizedStudent } from '../types';
import { sortStudents, normalizeStudent, isStudentActive, isStudentArchived } from '../normalizeStudent';

const makeStudent = (
  overrides: Partial<NormalizedStudent> = {},
): NormalizedStudent => ({
  id: overrides.id ?? 's1',
  schoolId: overrides.schoolId ?? 'school1',
  firstName: overrides.firstName ?? 'John',
  middleName: overrides.middleName,
  lastName: overrides.lastName ?? 'Doe',
  admissionNumber: overrides.admissionNumber,
  studentId: overrides.studentId,
  class: overrides.class ?? 'JSS 1',
  divisionId: overrides.divisionId ?? 'div1',
  guardianId: overrides.guardianId,
  guardian: overrides.guardian ?? null,
  gender: overrides.gender,
  dateOfBirth: overrides.dateOfBirth,
  admissionDate: overrides.admissionDate,
  registeredAt: overrides.registeredAt ?? '2024-01-15T10:00:00.000Z',
  status: overrides.status ?? 'ACTIVE',
  createdAt: overrides.createdAt ?? '2024-01-15T10:00:00.000Z',
  updatedAt: overrides.updatedAt ?? '2024-01-15T10:00:00.000Z',
  academicSession: overrides.academicSession,
});

describe('sortStudents', () => {
  const students = [
    makeStudent({ firstName: 'Alice', lastName: 'Smith', admissionNumber: 'ADM003', class: 'JSS 2', registeredAt: '2024-03-01T00:00:00Z', status: 'ACTIVE' }),
    makeStudent({ id: 's2', firstName: 'Bob', lastName: 'Adams', admissionNumber: 'ADM001', class: 'JSS 1', registeredAt: '2024-01-01T00:00:00Z', status: 'ARCHIVED' }),
    makeStudent({ id: 's3', firstName: 'Charlie', lastName: 'Brown', admissionNumber: 'ADM002', class: 'JSS 1', registeredAt: '2024-02-01T00:00:00Z', status: 'ACTIVE' }),
  ];

  it('sorts by name ascending', () => {
    const result = sortStudents(students, 'name', 'asc');
    expect(result[0].lastName).toBe('Adams');
    expect(result[2].lastName).toBe('Smith');
  });

  it('sorts by name descending', () => {
    const result = sortStudents(students, 'name', 'desc');
    expect(result[0].lastName).toBe('Smith');
    expect(result[2].lastName).toBe('Adams');
  });

  it('sorts by admission number ascending', () => {
    const result = sortStudents(students, 'admissionNumber', 'asc');
    expect(result[0].admissionNumber).toBe('ADM001');
    expect(result[2].admissionNumber).toBe('ADM003');
  });

  it('sorts by admission number descending', () => {
    const result = sortStudents(students, 'admissionNumber', 'desc');
    expect(result[0].admissionNumber).toBe('ADM003');
    expect(result[2].admissionNumber).toBe('ADM001');
  });

  it('sorts by class ascending', () => {
    const result = sortStudents(students, 'class', 'asc');
    expect(result[0].class).toBe('JSS 1');
    expect(result[1].class).toBe('JSS 1');
    expect(result[2].class).toBe('JSS 2');
  });

  it('sorts by date registered ascending', () => {
    const result = sortStudents(students, 'dateRegistered', 'asc');
    expect(result[0].registeredAt).toBe('2024-01-01T00:00:00Z');
    expect(result[2].registeredAt).toBe('2024-03-01T00:00:00Z');
  });

  it('sorts by status ascending', () => {
    const result = sortStudents(students, 'status', 'asc');
    expect(result[0].status).toBe('ACTIVE');
    expect(result[2].status).toBe('ARCHIVED');
  });

  it('returns a new array (does not mutate original)', () => {
    const original = [...students];
    sortStudents(students, 'name', 'asc');
    expect(students[0].firstName).toBe(original[0].firstName);
  });
});

describe('normalizeStudent', () => {
  it('normalizes snake_case raw data to camelCase', () => {
    const raw = {
      id: 'stu-123',
      school_id: 'sch-456',
      first_name: 'Grace',
      last_name: 'Okello',
      admission_number: 'ADM-789',
      class: 'SS 2',
      status: 'ACTIVE',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      gender: 'Female',
    };

    const result = normalizeStudent(raw);
    expect(result.id).toBe('stu-123');
    expect(result.schoolId).toBe('sch-456');
    expect(result.firstName).toBe('Grace');
    expect(result.lastName).toBe('Okello');
    expect(result.admissionNumber).toBe('ADM-789');
    expect(result.class).toBe('SS 2');
    expect(result.status).toBe('ACTIVE');
    expect(result.gender).toBe('Female');
  });

  it('falls back to camelCase keys when snake_case are missing', () => {
    const raw = {
      id: 'u1',
      schoolId: 's1',
      firstName: 'Ada',
      lastName: 'Lovelace',
      status: 'ACTIVE',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };

    const result = normalizeStudent(raw);
    expect(result.firstName).toBe('Ada');
    expect(result.lastName).toBe('Lovelace');
  });

  it('normalizes guardian nested object', () => {
    const raw = {
      id: 'stu-1',
      schoolId: 'sch-1',
      first_name: 'John',
      last_name: 'Doe',
      status: 'ACTIVE',
      guardians: [{
        id: 'g1',
        full_name: 'Jane Doe',
        primary_phone: '08012345678',
        email: 'jane@example.com',
      }],
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    };

    const result = normalizeStudent(raw);
    expect(result.guardian).not.toBeNull();
    expect(result.guardian?.fullName).toBe('Jane Doe');
    expect(result.guardian?.phone).toBe('08012345678');
  });

  it('handles missing optional fields', () => {
    const raw = {
      id: 'stu-2',
      school_id: 's2',
      first_name: 'Minimal',
      last_name: 'Student',
      status: 'ACTIVE',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    };

    const result = normalizeStudent(raw);
    expect(result.admissionNumber).toBeUndefined();
    expect(result.gender).toBeUndefined();
    expect(result.dateOfBirth).toBeUndefined();
    expect(result.divisionId).toBeUndefined();
    expect(result.guardian).toBeNull();
  });
});

describe('isStudentActive / isStudentArchived', () => {
  it('returns true for active status', () => {
    expect(isStudentActive(makeStudent({ status: 'ACTIVE' }).status)).toBe(true);
  });

  it('returns false for non-active status', () => {
    expect(isStudentActive(makeStudent({ status: 'ARCHIVED' }).status)).toBe(false);
  });

  it('returns true for archived status', () => {
    expect(isStudentArchived(makeStudent({ status: 'ARCHIVED' }).status)).toBe(true);
  });

  it('returns false for active status', () => {
    expect(isStudentArchived(makeStudent({ status: 'ACTIVE' }).status)).toBe(false);
  });
});
