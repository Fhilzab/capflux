/**
 * StudentImportService
 *
 * Handles CSV/XLSX parsing, column auto-detection, row validation,
 * and batch import — all client-side for offline-first compatibility.
 *
 * Import pipeline: CSV/XLSX → parse → detect columns → validate →
 *   batchImport (GuardianService.getOrCreateGuardian + studentService.createStudent)
 *
 * The batch import accepts dependency injection so tests can provide
 * mock services. Real services are wired in by useStudentManagement.
 */

import * as XLSX from 'xlsx';
import type { StudentStatus, StudentResult, Student } from '@/shared/students/types';
import type { SchoolDivision } from '@/shared/divisions/types';

import type {
  ColumnMapping,
  ParseResult,
  StudentField,
  ValidatedRow,
  ImportSummary,
  ImportResult,
  NormalizedStudent,
} from '../types';

/* ── Supported file types ────────────────────────────────────────── */
export const SUPPORTED_IMPORT_EXTENSIONS = ['.xlsx', '.xls', '.csv'] as const;
export const SUPPORTED_IMPORT_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
  'application/csv',
  'text/plain',
];

/* ── Column auto-detection patterns ──────────────────────────────── */
/**
 * Maps each normalized field to common header-name variations.
 * Order matters: the first pattern that matches a header wins (for unambiguous
 * headers), but we try exact matches first, then fuzzy contains.
 */
export const KNOWN_COLUMN_PATTERNS: Record<string, string[]> = {
  firstName: [
    'First Name', 'FirstName', 'Firstname', 'Given Name', 'first_name', 'firstname',
    'fname', 'First', 'First Name (Given)',
  ],
  lastName: [
    'Last Name', 'LastName', 'Surname', 'Lastname', 'last_name', 'lastname',
    'Last', 'Family Name', 'family_name',
  ],
  middleName: [
    'Middle Name', 'MiddleName', 'middlename', 'middle_name', 'Middle',
  ],
  gender: ['Gender', 'Sex', 'gender', 'GENDER', 'Sex (M/F)'],
  dateOfBirth: [
    'Date of Birth', 'DOB', 'date_of_birth', 'D.O.B', 'Birth Date',
    'birth_date', 'Date Of Birth', 'DoB', 'DOB (Date of Birth)',
  ],
  // studentId precedes admissionNumber so a file carrying BOTH columns
  // maps them distinctly ("Student ID" → studentId, "Admission Number" →
  // admissionNumber); "Student ID" alone still resolves via this field.
  studentId: [
    'Student ID', 'StudentID', 'Student Id', 'student_id',
  ],
  admissionNumber: [
    'Admission Number', 'Admission No', 'AdmissionNo', 'Admission_Number',
    'admission_number', 'Admission No.', 'Student ID', 'Roll No', 'RollNo',
    'Roll Number', 'roll_number', 'Admission', 'ID',
  ],
  guardianName: [
    'Guardian', 'Parent', 'Parent Name', 'ParentName', 'guardian_name',
    'parent_name', 'Guardian Name', 'GuardianName', 'Guardian Full Name',
    'Responsible Person', 'ResponsiblePerson', 'responsible_person',
  ],
  guardianPhone: [
    'Guardian Phone', 'Parent Phone', 'parent_phone', 'Phone', 'phone',
    'Contact Phone', 'contact_phone', 'Guardian Contact', 'Mobile', 'mobile',
    'Phone Number', 'phone_number', 'Contact Number', 'contact_number',
    'Guardian Mobile', 'Parent Mobile', 'primary_phone', 'Primary Phone',
  ],
  relationship: [
    'Relationship', 'relationship', 'Guardian Relationship',
    'Parent Relationship', 'relation', 'Relation',
  ],
  guardianEmail: [
    'Guardian Email', 'Parent Email', 'parent_email', 'Email', 'email',
    'Guardian Email Address', 'email_address', 'E-mail',
  ],
  guardianSecondaryPhone: [
    'Secondary Phone', 'Alternate Phone', 'alternative_phone',
    'secondary_phone', 'Alt Phone', 'Other Phone', 'alternative phone',
    'guardian_secondary_phone',
  ],
  dateOfAdmission: [
    'Admission Date', 'Date of Admission', 'admission_date',
    'Admission_Date', 'Enrollment Date', 'enrollment_date',
  ],
  status: ['Status', 'Enrollment Status', 'status', 'Student Status'],
  className: [
    'Class', 'class', 'Class Name', 'ClassName', 'class_name',
    'Division', 'division', 'Grade', 'grade', 'Stream', 'stream',
    'Class/Division',
  ],
  academicSession: [
    'Academic Session', 'academic_session', 'Session', 'session',
    'Academic Year', 'academic_year', 'School Year', 'school_year',
  ],
  guardianAddress: [
    'Guardian Address', 'guardian_address', 'Address', 'address',
    'Home Address', 'home_address', 'Residential Address',
  ],
  previousSchool: [
    'Previous School', 'previous_school', 'Former School', 'former_school',
  ],
  medicalNotes: [
    'Medical Notes', 'medical_notes', 'Medical Information',
  ],
  specialNotes: [
    'Special Notes', 'special_notes', 'Notes', 'notes',
  ],
};

/**
 * Detect column mappings from spreadsheet headers.
 * Tries exact case-insensitive match first, then fuzzy substring match.
 * Returns a Record mapping original header → StudentField.
 */
export function detectColumns(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const assignedFields = new Set<string>();

  // Mapping keys preserve the ORIGINAL header text (including stray
  // whitespace) so mapRow and the column-mapper UI can look columns up
  // exactly as they appear in the uploaded file.
  const normalizedHeaders = headers.map((h) => h.trim());
  const originalByTrimmed = new Map<string, string>();
  headers.forEach((h, i) => originalByTrimmed.set(normalizedHeaders[i], h));

  const record = (trimmedHeader: string, field: StudentField) => {
    const original = originalByTrimmed.get(trimmedHeader)!;
    if (mapping[original] === undefined) {
      mapping[original] = field;
      assignedFields.add(field);
    }
  };

  // Pass 1: exact (case-insensitive) match
  for (const header of normalizedHeaders) {
    if (mapping[originalByTrimmed.get(header)!] !== undefined) continue;
    const lower = header.toLowerCase();
    for (const [field, patterns] of Object.entries(KNOWN_COLUMN_PATTERNS)) {
      if (assignedFields.has(field)) continue;
      if (patterns.some((p) => p.toLowerCase() === lower)) {
        record(header, field as StudentField);
        break;
      }
    }
  }

  // Pass 2: fuzzy substring match (header contains pattern or vice-versa)
  for (const header of normalizedHeaders) {
    if (mapping[originalByTrimmed.get(header)!] !== undefined) continue;
    const lower = header.toLowerCase();
    for (const [field, patterns] of Object.entries(KNOWN_COLUMN_PATTERNS)) {
      if (assignedFields.has(field)) continue;
      if (
        patterns.some(
          (p) =>
            p.toLowerCase().includes(lower) ||
            lower.includes(p.toLowerCase()),
        )
      ) {
        record(header, field as StudentField);
        break;
      }
    }
  }

  return mapping;
}

/* ── Phone / Email validation (reuses StudentValidator rules) ─────── */
const NIGERIAN_PHONE_REGEX = /^[\d+\-\s()]{10,}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidPhone(phone: string): boolean {
  if (!phone) return false;
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10;
}

export function isValidEmail(email: string): boolean {
  if (!email) return false;
  return EMAIL_REGEX.test(email.trim());
}

/* ── Status / Relationship normalization ──────────────────────────── */
const STATUS_MAP: Record<string, StudentStatus> = {
  active: 'ACTIVE',
  active_enrolled: 'ACTIVE',
  current: 'ACTIVE',
  graduated: 'GRADUATED',
  grad: 'GRADUATED',
  transferred: 'TRANSFERRED',
  transfer: 'TRANSFERRED',
  withdrawn: 'WITHDRAWN',
  withdrawn_left: 'WITHDRAWN',
  left: 'WITHDRAWN',
  suspended: 'SUSPENDED',
  inactive: 'WITHDRAWN',
  archived: 'ARCHIVED',
};

export function normalizeStatus(value: string): StudentStatus {
  if (!value) return 'ACTIVE';
  const lower = value.toLowerCase().trim();
  if (lower in STATUS_MAP) return STATUS_MAP[lower];
  const directMatch = Object.keys(STATUS_MAP).find(
    (k) => k.toLowerCase() === lower,
  );
  if (directMatch) return STATUS_MAP[directMatch];
  // Try matching against enum values directly
  const statusValues: StudentStatus[] = [
    'ACTIVE', 'GRADUATED', 'TRANSFERRED', 'WITHDRAWN', 'SUSPENDED', 'ARCHIVED',
  ];
  const upper = value.trim().toUpperCase();
  if (statusValues.includes(upper as StudentStatus)) return upper as StudentStatus;
  return 'ACTIVE';
}

const RELATIONSHIP_MAP: Record<string, string> = {
  father: 'FATHER',
  mother: 'MOTHER',
  uncle: 'UNCLE',
  aunt: 'AUNT',
  brother: 'BROTHER',
  sister: 'SISTER',
  grandparent: 'GRANDPARENT',
  grandfather: 'GRANDPARENT',
  grandmother: 'GRANDPARENT',
  other: 'OTHER',
  guardian: 'GUARDIAN',
  parent: 'GUARDIAN',
  mum: 'MOTHER',
  mom: 'MOTHER',
  dad: 'FATHER',
  daddy: 'FATHER',
};

export function normalizeRelationship(value: string): string {
  if (!value) return 'GUARDIAN';
  const lower = value.toLowerCase().trim();
  if (lower in RELATIONSHIP_MAP) return RELATIONSHIP_MAP[lower];
  const upper = value.trim().toUpperCase();
  const validRelationships = ['FATHER', 'MOTHER', 'UNCLE', 'AUNT', 'BROTHER', 'SISTER', 'GRANDPARENT', 'OTHER'];
  if (validRelationships.includes(upper)) return upper;
  return 'OTHER';
}

/* ── File parsing ─────────────────────────────────────────────────── */
export async function parseFile(file: File): Promise<ParseResult> {
  const fileName = file.name;
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error('No sheets found in the file.');
  }

  const worksheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: '',
    blankrows: false,
  }) as unknown as string[][];

  if (rows.length < 2) {
    throw new Error('The file must contain at least a header row and one data row.');
  }

  const headers = rows[0].map((h) => String(h).trim());
  const dataRows = rows.slice(1);

  const jsonData = dataRows.map((row) => {
    const obj: Record<string, string> = {};
    headers.forEach((header, idx) => {
      obj[header] = row[idx] != null ? String(row[idx]).trim() : '';
    });
    return obj;
  });

  return { fileName, headers, rows: jsonData };
}

/* ── Row mapping ──────────────────────────────────────────────────── */
interface MappedRow {
  firstName: string;
  lastName: string;
  middleName?: string;
  gender?: string;
  dateOfBirth?: string;
  admissionNumber?: string;
  guardianName: string;
  guardianPhone: string;
  relationship: string;
  guardianEmail?: string;
  guardianSecondaryPhone?: string;
  dateOfAdmission?: string;
  status: StudentStatus;
  className?: string;
  academicSession?: string;
  guardianAddress?: string;
  [key: string]: unknown;
}

function mapRow(row: Record<string, string>, mapping: ColumnMapping): MappedRow {
  const result: MappedRow = {
    firstName: '',
    lastName: '',
    guardianName: '',
    guardianPhone: '',
    relationship: 'GUARDIAN',
    status: 'ACTIVE',
    gender: '',
  };

  for (const [header, value] of Object.entries(row)) {
    const field = mapping[header];
    if (!field || !value || value.trim() === '') continue;
    const trimmed = value.trim();

    switch (field) {
      case 'firstName': result.firstName = trimmed; break;
      case 'lastName': result.lastName = trimmed; break;
      case 'middleName': result.middleName = trimmed; break;
      case 'gender': result.gender = trimmed; break;
      case 'dateOfBirth': result.dateOfBirth = trimmed; break;
      case 'admissionNumber': result.admissionNumber = trimmed; break;
      case 'guardianName': result.guardianName = trimmed; break;
      case 'guardianPhone': result.guardianPhone = trimmed; break;
      case 'relationship': result.relationship = trimmed; break;
      case 'guardianEmail': result.guardianEmail = trimmed; break;
      case 'guardianSecondaryPhone': result.guardianSecondaryPhone = trimmed; break;
      case 'dateOfAdmission': result.dateOfAdmission = trimmed; break;
      case 'status': result.status = normalizeStatus(trimmed); break;
      case 'className': result.className = trimmed; break;
      case 'academicSession': result.academicSession = trimmed; break;
      case 'guardianAddress': result.guardianAddress = trimmed; break;
      case 'previousSchool': (result as any).previousSchool = trimmed; break;
      case 'medicalNotes': (result as any).medicalNotes = trimmed; break;
      case 'specialNotes': (result as any).specialNotes = trimmed; break;
    }
  }

  // Normalize relationship
  if (result.relationship) {
    result.relationship = normalizeRelationship(result.relationship);
  }

  return result;
}

/* ── Row validation ───────────────────────────────────────────────── */
interface ValidationOptions {
  existingStudents: NormalizedStudent[];
  divisions: SchoolDivision[];
}

export function validateRow(
  row: Record<string, string>,
  mapping: ColumnMapping,
  options: ValidationOptions,
): Omit<ValidatedRow, 'rowIndex' | 'mapped'> & { mapped: MappedRow } {
  const mapped = mapRow(row, mapping);
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required: firstName (min 2 chars)
  if (!mapped.firstName || mapped.firstName.trim().length < 2) {
    errors.push('First name is required (minimum 2 characters).');
  }

  // Required: lastName (min 2 chars)
  if (!mapped.lastName || mapped.lastName.trim().length < 2) {
    errors.push('Last name is required (minimum 2 characters).');
  }

  // Required: guardianPhone (min 10 digits)
  if (!mapped.guardianPhone || !isValidPhone(mapped.guardianPhone)) {
    errors.push('A valid guardian phone number is required (minimum 10 digits).');
  }

  // Required: guardianName (min 2 chars) — only when the file actually
  // maps a guardian-name column; files without one default the guardian
  // from the student's own data at import time.
  const mapsGuardianName = Object.values(mapping).includes('guardianName');
  if (mapsGuardianName && (!mapped.guardianName || mapped.guardianName.trim().length < 2)) {
    errors.push('Guardian full name is required.');
  }

  // Email format validation
  if (mapped.guardianEmail && !isValidEmail(mapped.guardianEmail)) {
    warnings.push(`Invalid email format: ${mapped.guardianEmail}.`);
  }

  // Unknown class
  if (mapped.className && options.divisions.length > 0) {
    const classMatch = options.divisions.some(
      (d) =>
        d.name.toLowerCase() === mapped.className!.toLowerCase() ||
        d.code.toLowerCase() === mapped.className!.toLowerCase(),
    );
    if (!classMatch) {
      warnings.push(`Unknown class: "${mapped.className}". The student will be created without a class assignment.`);
    }
  }

  // Date of birth format check
  if (mapped.dateOfBirth) {
    const parsed = new Date(mapped.dateOfBirth);
    if (Number.isNaN(parsed.getTime())) {
      warnings.push(`Date of birth "${mapped.dateOfBirth}" does not appear to be a valid date.`);
    }
  }

  // Admission date format check
  if (mapped.dateOfAdmission) {
    const parsed = new Date(mapped.dateOfAdmission);
    if (Number.isNaN(parsed.getTime())) {
      warnings.push(`Admission date "${mapped.dateOfAdmission}" does not appear to be a valid date.`);
    }
  }

  return {
    mapped,
    errors,
    warnings,
    valid: errors.length === 0,
    exists: false, // set by validateAllRows
  };
}

interface BatchDuplicateCheck {
  existingAdmissionNumbers: Set<string>;
  existingPhones: Set<string>;
}

/**
 * Validate all rows and classify them as valid / warning / invalid.
 * Also detects duplicates within the file and records already in CAPFLUX.
 */
export function validateAllRows(
  rows: Record<string, string>[],
  mapping: ColumnMapping,
  options: ValidationOptions,
): {
  validatedRows: ValidatedRow[];
  summary: ImportSummary;
} {
  const validatedRows: ValidatedRow[] = [];
  const seenAdmissionNumbers = new Set<string>();
  const seenPhones = new Set<string>();

  // Pre-compute existing admission numbers for duplicate detection
  const existingAdmissionNumbers = new Set(
    options.existingStudents
      .map((s) => s.admissionNumber)
      .filter(Boolean) as string[],
  );
  const existingPhones = new Set(
    options.existingStudents
      .map((s) => s.guardian?.phone)
      .filter(Boolean) as string[],
  );

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const result = validateRow(row, mapping, options);
    const admissionNum = result.mapped.admissionNumber;
    const phone = result.mapped.guardianPhone;

    // Duplicate within file — admission number
    if (admissionNum && seenAdmissionNumbers.has(admissionNum)) {
      result.errors.push(
        `Duplicate admission number "${admissionNum}" within the import file (already seen on row ${
          validatedRows.findIndex((r) => r.mapped.admissionNumber === admissionNum) + 1
        }).`,
      );
    } else if (admissionNum) {
      seenAdmissionNumbers.add(admissionNum);
    }

    // Duplicate within file — guardian phone
    if (phone && seenPhones.has(phone)) {
      result.warnings.push(
        `Duplicate guardian phone "${phone}" within the file. A guardian with this phone may already exist.`,
      );
    } else if (phone) {
      seenPhones.add(phone);
    }

    // Existing in CAPFLUX
    if (admissionNum && existingAdmissionNumbers.has(admissionNum)) {
      result.exists = true;
      result.errors.push(
        `A student with admission number "${admissionNum}" already exists in CAPFLUX.`,
      );
    }

    if (phone && existingPhones.has(phone)) {
      result.warnings.push(
        `A guardian with phone "${phone}" already exists in CAPFLUX. The guardian will be reused.`,
      );
    }

    const valid = result.errors.length === 0;

    validatedRows.push({
      rowIndex: i + 2, // +2 because row 1 is header, and rows are 1-indexed
      mapped: result.mapped as unknown as Record<string, string>,
      valid,
      errors: result.errors,
      warnings: result.warnings,
      exists: result.exists,
    });
  }

  const summary: ImportSummary = {
    total: rows.length,
    ready: validatedRows.filter((r) => r.valid && !r.exists).length,
    warnings: validatedRows.filter(
      (r) => r.warnings.length > 0 && r.valid && !r.exists,
    ).length,
    errors: validatedRows.filter((r) => !r.valid).length,
  };

  return { validatedRows, summary };
}

/* ── Duplicate handling options ───────────────────────────────────── */
export type DuplicateHandling = 'SKIP' | 'UPDATE' | 'IMPORT_AS_NEW';

/* ── Batch import ─────────────────────────────────────────────────── */
export interface ImportBatchContext {
  schoolId: string;
  divisions: SchoolDivision[];
  createStudent: (data: {
    schoolId: string;
    divisionId: string;
    guardianId: string;
    firstName: string;
    lastName: string;
    middleName?: string;
    gender: string;
    dateOfBirth?: string;
    admissionNumber?: string;
    admissionDate: string;
    registeredAt: string;
    relationshipToGuardian: string;
    discountRate: number;
    status?: string;
    academicSession?: string;
  }) => Promise<StudentResult<Student>>;
  getOrCreateGuardian: (
    schoolId: string,
    data: {
      full_name: string;
      primary_phone: string;
      secondary_phone?: string;
      email?: string;
      relationship: string;
    },
  ) => Promise<{ id: string; [key: string]: unknown }>;
}

export interface BatchImportOptions {
  batchSize?: number;
  duplicateHandling?: DuplicateHandling;
  onProgress?: (progress: {
    imported: number;
    updated: number;
    skipped: number;
    failed: number;
    total: number;
  }) => void;
}

/**
 * Import validated rows in batches to avoid blocking the UI.
 * Each batch is processed with Promise.allSettled so partial failures
 * are captured without aborting the entire import.
 */
export async function batchImport(
  validRows: ValidatedRow[],
  ctx: ImportBatchContext,
  options: BatchImportOptions = {},
): Promise<ImportResult> {
  const batchSize = options.batchSize ?? 10;
  const duplicateHandling = options.duplicateHandling ?? 'SKIP';
  const onProgress = options.onProgress;

  const result: ImportResult = {
    imported: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    failures: [],
    importedIds: [],
  };

  const now = new Date().toISOString();
  const defaultAdmissionDate = new Date(now).toISOString().split('T')[0];

  // Pre-index existing admission numbers for duplicate handling
  // (these rows were flagged as exists=true in validation)
  const existingRows = validRows.filter((r) => r.exists && duplicateHandling === 'SKIP');

  // Helper: look up division ID by class name
  const findDivisionId = (className: string | undefined): string => {
    if (!className || ctx.divisions.length === 0) return '';
    const div = ctx.divisions.find(
      (d) =>
        d.name.toLowerCase() === className.toLowerCase() ||
        d.code.toLowerCase() === className.toLowerCase(),
    );
    return div?.id || '';
  };

  // Process in batches
  const rowsToProcess = validRows.filter(
    (r) =>
      r.valid &&
      !(r.exists && duplicateHandling === 'SKIP'),
  );

  for (let i = 0; i < rowsToProcess.length; i += batchSize) {
    const batch = rowsToProcess.slice(i, i + batchSize);

    const batchPromises = batch.map(async (row) => {
      const mapped = row.mapped as unknown as ReturnType<typeof mapRow>;

      // Determine division ID
      const divisionId = findDivisionId(mapped.className);

      // Create or find guardian
      let guardianId: string;
      try {
        const guardian = await ctx.getOrCreateGuardian(ctx.schoolId, {
          full_name: mapped.guardianName,
          primary_phone: mapped.guardianPhone.replace(/\D/g, ''),
          secondary_phone: mapped.guardianSecondaryPhone,
          email: mapped.guardianEmail,
          relationship: mapped.relationship,
        });
        guardianId = guardian.id;
      } catch (err: any) {
        throw new Error(
          `Guardian creation failed for ${mapped.firstName} ${mapped.lastName}: ${err?.message || 'Unknown error'}`,
        );
      }

      if (!guardianId) {
        throw new Error(
          `Guardian creation returned no ID for ${mapped.firstName} ${mapped.lastName}.`,
        );
      }

      // Create student
      const studentResult = await ctx.createStudent({
        schoolId: ctx.schoolId,
        divisionId,
        guardianId,
        firstName: mapped.firstName,
        lastName: mapped.lastName,
        middleName: mapped.middleName,
        gender: mapped.gender || '',
        dateOfBirth: mapped.dateOfBirth,
        admissionNumber: mapped.admissionNumber,
        admissionDate: mapped.dateOfAdmission || defaultAdmissionDate,
        registeredAt: now,
        relationshipToGuardian: mapped.relationship || 'GUARDIAN',
        discountRate: 0,
        status: mapped.status,
        academicSession: mapped.academicSession,
      });

      if (studentResult.error) {
        if (studentResult.error.code === 'DUPLICATE_ADMISSION_NUMBER') {
          return { skipped: true, message: 'Duplicate admission number' };
        }
        throw new Error(studentResult.error.message);
      }

      if (!studentResult.data?.id) {
        throw new Error('Student creation returned no ID.');
      }

      return {
        imported: true,
        id: studentResult.data.id,
        updated: false,
      };
    });

    const settled = await Promise.allSettled(batchPromises);

    for (let j = 0; j < settled.length; j++) {
      const outcome = settled[j];
      const row = batch[j];

      if (outcome.status === 'fulfilled') {
        const res = outcome.value;
        if (res.imported) {
          result.imported++;
          result.importedIds.push(res.id);
        } else if (res.updated) {
          result.updated++;
        } else if (res.skipped) {
          result.skipped++;
        }
      } else {
        result.failed++;
        result.failures.push({
          row: row.rowIndex,
          message: outcome.reason?.message || 'Unknown error',
        });
      }
    }

    // Track skipped existing rows
    result.skipped += existingRows.length;

    onProgress?.({
      imported: result.imported,
      updated: result.updated,
      skipped: result.skipped,
      failed: result.failed,
      total: rowsToProcess.length + existingRows.length,
    });

    // Yield to the event loop between batches
    if (i + batchSize < rowsToProcess.length) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  return result;
}

/* ── Import template generation ───────────────────────────────────── */
export const TEMPLATE_HEADERS = [
  'First Name',
  'Last Name',
  'Middle Name',
  'Date of Birth',
  'Gender',
  'Admission Number',
  'Class',
  'Academic Session',
  'Status',
  'Parent Name',
  'Relationship',
  'Parent Phone',
  'Guardian Secondary Phone',
  'Guardian Email',
  'Guardian Address',
] as const;

/** Returns an array of header strings for generating a template file. */
export function getTemplateHeaders(): string[] {
  return [...TEMPLATE_HEADERS];
}

/** Returns a sample row to include in the template for guidance. */
export function getTemplateSampleRow(): Record<string, string> {
  return {
    'First Name': 'Ade',
    'Last Name': 'Ogundimu',
    'Middle Name': 'Babatunde',
    'Date of Birth': '2010-05-15',
    'Gender': 'Male',
    'Admission Number': 'STU-2024-001',
    'Class': 'JSS 1',
    'Academic Session': '2024/2025',
    'Status': 'Active',
    'Parent Name': 'Mrs. Funke Ogundimu',
    'Relationship': 'Mother',
    'Parent Phone': '08012345678',
    'Guardian Secondary Phone': '08087654321',
    'Guardian Email': 'funke@example.com',
    'Guardian Address': '123 Broad Street, Lagos',
  };
}

/**
 * Generate a downloadable CSV template file.
 */
export function downloadCsvTemplate(): void {
  const headers = getTemplateHeaders();
  const sample = getTemplateSampleRow();
  const lines = [
    headers.join(','),
    headers.map((h) => `"${sample[h] || ''}"`).join(','),
  ];
  const csvContent = lines.join('\n');
  const blob = new Blob([csvContent], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'Student Import Template.csv';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Generate a downloadable XLSX template file using xlsx.
 */
export function downloadXlsxTemplate(): void {
  const headers = getTemplateHeaders();
  const sample = getTemplateSampleRow();
  const worksheetData = [
    headers,
    headers.map((h) => sample[h] || ''),
  ];
  const ws = XLSX.utils.aoa_to_sheet(worksheetData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Template');
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'Student Import Template.xlsx';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
