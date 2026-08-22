import type { StudentStatus, Relationship } from '@/shared/students/types';
import type { NormalizedStudent, NormalizedGuardian, StudentSortField } from '../types';
import type { SchoolDivision } from '@/shared/divisions/types';

/**
 * Gets a field from an object that may use either snake_case or camelCase keys.
 * Tries the camelCase variant first, then the snake_case variant, then the exact key.
 */
function getField(obj: Record<string, any>, camel: string, snake?: string, fallback?: string): any {
  if (obj[camel] !== undefined && obj[camel] !== null && obj[camel] !== '') return obj[camel];
  const snakeKey = snake || camel.replace(/[A-Z]/g, (m) => '_' + m.toLowerCase());
  if (obj[snakeKey] !== undefined && obj[snakeKey] !== null && obj[snakeKey] !== '') return obj[snakeKey];
  if (fallback !== undefined) return obj[fallback];
  return undefined;
}

const ACTIVE_STATUSES: StudentStatus[] = ['ACTIVE'];

export function normalizeGuardian(raw: Record<string, any> | null | undefined): NormalizedGuardian | null {
  if (!raw) return null;

  return {
    id: getField(raw, 'id', 'id') || '',
    schoolId: getField(raw, 'schoolId', 'school_id'),
    fullName: getField(raw, 'fullName', 'full_name') || '',
    phone: getField(raw, 'phone', 'primary_phone') || '',
    secondaryPhone: getField(raw, 'secondaryPhone', 'secondary_phone') || undefined,
    email: getField(raw, 'email', 'email') || undefined,
    relationship: getField(raw, 'relationship', 'relationship') as Relationship | undefined,
    createdAt: getField(raw, 'createdAt', 'created_at'),
    updatedAt: getField(raw, 'updatedAt', 'updated_at'),
  };
}

/**
 * Extracts a guardian record from a raw student row. Handles the joined
 * `guardian` object as well as a nested `guardians` array (first entry wins),
 * which some API responses and offline joins produce.
 */
function extractGuardianSource(raw: Record<string, any>): Record<string, any> | null {
  const direct = raw.guardian ?? raw.guardians;
  if (!direct) return null;
  if (Array.isArray(direct)) return direct[0] ?? null;
  return direct;
}

/**
 * Normalizes a student row from mixed naming conventions into a consistent
 * camelCase view model. Handles both snake_case Supabase columns and
 * camelCase typed fields, and resolves the class (division) name.
 */
export function normalizeStudent(
  raw: Record<string, any>,
  divisions: SchoolDivision[] = [],
  guardianMap?: Map<string, Record<string, any>>,
): NormalizedStudent {
  const divisionId = getField(raw, 'divisionId', 'division_id');
  const guardianRecord = getField(raw, 'guardianId', 'guardian_id');
  const guardianSource = guardianMap?.get(guardianRecord) || extractGuardianSource(raw);

  const status = (getField(raw, 'status', 'status') || 'ACTIVE') as StudentStatus;
  const admissionNumber = getField(raw, 'admissionNumber', 'admission_number');

  // Resolve class name from division lookup, fall back to a class_name or
  // class column that some schemas may still carry, then to the divisionId.
  let className = '';
  if (divisionId && divisions.length) {
    const div = divisions.find((d) => d.id === divisionId || d.id === getField(raw, 'id', 'id'));
    if (div) className = div.name || div.code || '';
  }
  if (!className) {
    className = getField(raw, 'className', 'class_name') || getField(raw, 'class', 'class') || '';
  }

  const createdAt = getField(raw, 'createdAt', 'created_at') || getField(raw, 'admissionDate', 'admission_date');
  const updatedAt = getField(raw, 'updatedAt', 'updated_at') || createdAt;

  return {
    id: getField(raw, 'id', 'id') || '',
    schoolId: getField(raw, 'schoolId', 'school_id'),
    firstName: getField(raw, 'firstName', 'first_name') || '',
    middleName: getField(raw, 'middleName', 'middle_name') || undefined,
    lastName: getField(raw, 'lastName', 'last_name') || '',
    admissionNumber,
    studentId: admissionNumber || getField(raw, 'studentId', 'student_id'),
    class: className,
    divisionId: divisionId || undefined,
    guardianId: guardianRecord || undefined,
    guardian: normalizeGuardian(guardianSource),
    gender: getField(raw, 'gender', 'gender') || undefined,
    dateOfBirth: getField(raw, 'dateOfBirth', 'date_of_birth') || undefined,
    admissionDate: getField(raw, 'admissionDate', 'admission_date') || undefined,
    registeredAt: getField(raw, 'registeredAt', 'registered_at') || createdAt,
    status,
    academicSession: getField(raw, 'academicSession', 'academic_session') || undefined,
    createdAt: createdAt || new Date().toISOString(),
    updatedAt: updatedAt || createdAt,
  };
}

/**
 * Maps a StudentStatus to a display label and CmStatusChip variant.
 */
export const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Active',
  GRADUATED: 'Graduated',
  TRANSFERRED: 'Transferred',
  WITHDRAWN: 'Withdrawn',
  SUSPENDED: 'Suspended',
  ARCHIVED: 'Archived',
  INACTIVE: 'Inactive',
};

export const STATUS_CHIP_VARIANTS: Record<string, 'success' | 'warning' | 'danger' | 'info'> = {
  ACTIVE: 'success',
  GRADUATED: 'info',
  TRANSFERRED: 'info',
  WITHDRAWN: 'warning',
  SUSPENDED: 'warning',
  ARCHIVED: 'danger',
  INACTIVE: 'danger',
};

/**
 * Returns a human-readable label for a relationship value.
 */
export function relationshipLabel(rel: string | undefined): string {
  if (!rel) return '';
  const labels: Record<string, string> = {
    FATHER: 'Father',
    MOTHER: 'Mother',
    UNCLE: 'Uncle',
    AUNT: 'Aunt',
    BROTHER: 'Brother',
    SISTER: 'Sister',
    GRANDPARENT: 'Grandparent',
    GRANDFATHER: 'Grandparent',
    GRANDMOTHER: 'Grandparent',
    OTHER: 'Other',
    GUARDIAN: 'Guardian',
  };
  return labels[rel.toUpperCase()] || rel;
}

/**
 * Returns true if the student status counts as "active" (enrolled).
 */
export function isStudentActive(status: StudentStatus): boolean {
  return ACTIVE_STATUSES.includes(status);
}

/**
 * Returns true if the student status counts as "archived" (inactive/left/graduated).
 */
export function isStudentArchived(status: StudentStatus): boolean {
  return !ACTIVE_STATUSES.includes(status);
}

/**
 * Gets the initials for a student’s avatar from first/last name.
 */
export function getStudentInitials(student: NormalizedStudent): string {
  const first = student.firstName?.[0] || '';
  const last = student.lastName?.[0] || '';
  return (first + last).toUpperCase() || '?';
}

/**
 * Gets a display name for the student (First Last).
 */
export function getStudentDisplayName(student: NormalizedStudent): string {
  const parts = [student.firstName, student.middleName, student.lastName].filter(Boolean);
  return parts.join(' ') || 'Unknown Student';
}

/**
 * Sorts an array of normalized students by the given field and order.
 */
export function sortStudents(
  students: NormalizedStudent[],
  field: StudentSortField,
  order: 'asc' | 'desc',
): NormalizedStudent[] {
  const sorted = [...students].sort((a, b) => {
    let comparison = 0;
    switch (field) {
      case 'name': {
        const nameA = `${a.lastName}, ${a.firstName}`.toLowerCase();
        const nameB = `${b.lastName}, ${b.firstName}`.toLowerCase();
        comparison = nameA.localeCompare(nameB);
        break;
      }
      case 'admissionNumber':
        comparison = (a.admissionNumber || '').localeCompare(b.admissionNumber || '');
        break;
      case 'class':
        comparison = (a.class || '').localeCompare(b.class || '');
        break;
      case 'dateRegistered':
        comparison = (a.registeredAt || '').localeCompare(b.registeredAt || '');
        break;
      case 'status':
        comparison = (a.status || '').localeCompare(b.status || '');
        break;
    }
    return order === 'asc' ? comparison : -comparison;
  });
  return sorted;
}
