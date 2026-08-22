import {
  KNOWN_COLUMN_PATTERNS,
  detectColumns,
  isValidPhone,
  isValidEmail,
  normalizeStatus,
  normalizeRelationship,
  validateRow,
  validateAllRows,
  TEMPLATE_HEADERS,
  getTemplateHeaders,
  getTemplateSampleRow,
} from '../StudentImportService';
import type { ColumnMapping } from '../types';
import type { SchoolDivision } from '@/shared/divisions/types';

describe('KNOWN_COLUMN_PATTERNS', () => {
  it('recognizes first name variations', () => {
    expect(KNOWN_COLUMN_PATTERNS.firstName).toContain('First Name');
    expect(KNOWN_COLUMN_PATTERNS.firstName).toContain('firstname');
    expect(KNOWN_COLUMN_PATTERNS.firstName).toContain('FirstName');
  });

  it('recognizes last name variations', () => {
    expect(KNOWN_COLUMN_PATTERNS.lastName).toContain('Surname');
    expect(KNOWN_COLUMN_PATTERNS.lastName).toContain('Last Name');
    expect(KNOWN_COLUMN_PATTERNS.lastName).toContain('lastname');
  });

  it('recognizes class variations', () => {
    expect(KNOWN_COLUMN_PATTERNS.className).toContain('Class');
    expect(KNOWN_COLUMN_PATTERNS.className).toContain('class_name');
    expect(KNOWN_COLUMN_PATTERNS.className).toContain('Class Name');
  });

  it('recognizes guardian phone variations', () => {
    expect(KNOWN_COLUMN_PATTERNS.guardianPhone).toContain('Parent Phone');
    expect(KNOWN_COLUMN_PATTERNS.guardianPhone).toContain('Guardian Phone');
    expect(KNOWN_COLUMN_PATTERNS.guardianPhone).toContain('Phone');
  });

  it('recognizes admission number variations', () => {
    expect(KNOWN_COLUMN_PATTERNS.admissionNumber).toContain('Admission No');
    expect(KNOWN_COLUMN_PATTERNS.admissionNumber).toContain('Admission Number');
    expect(KNOWN_COLUMN_PATTERNS.admissionNumber).toContain('Student ID');
  });

  it('recognizes academic session variations', () => {
    expect(KNOWN_COLUMN_PATTERNS.academicSession).toContain('Academic Session');
    expect(KNOWN_COLUMN_PATTERNS.academicSession).toContain('Session');
    expect(KNOWN_COLUMN_PATTERNS.academicSession).toContain('Academic Year');
  });
});

describe('detectColumns', () => {
  it('detects standard headers (case-insensitive exact match)', () => {
    const headers = ['First Name', 'Last Name', 'Class', 'Parent Name', 'Parent Phone'];
    const mapping = detectColumns(headers);
    expect(mapping['First Name']).toBe('firstName');
    expect(mapping['Last Name']).toBe('lastName');
    expect(mapping['Class']).toBe('className');
    expect(mapping['Parent Name']).toBe('guardianName');
    expect(mapping['Parent Phone']).toBe('guardianPhone');
  });

  it('recognizes alternate header names', () => {
    const headers = ['Surname', 'Admission No', 'Phone', 'Student ID'];
    const mapping = detectColumns(headers);
    expect(mapping['Surname']).toBe('lastName');
    expect(mapping['Admission No']).toBe('admissionNumber');
    expect(mapping['Phone']).toBe('guardianPhone');
    expect(mapping['Student ID']).toBe('studentId');
  });

  it('returns empty mapping for unrecognized headers', () => {
    const headers = ['Color', 'Favorite Animal'];
    const mapping = detectColumns(headers);
    expect(Object.keys(mapping)).toHaveLength(0);
  });

  it('handles lowercase headers', () => {
    const headers = ['firstname', 'lastname', 'gender', 'email'];
    const mapping = detectColumns(headers);
    expect(mapping['firstname']).toBe('firstName');
    expect(mapping['lastname']).toBe('lastName');
    expect(mapping['gender']).toBe('gender');
    expect(mapping['email']).toBe('guardianEmail');
  });

  it('handles headers with extra whitespace', () => {
    const headers = [' First Name ', ' Last Name ', ' Class '];
    const mapping = detectColumns(headers);
    expect(mapping[' First Name ']).toBe('firstName');
    expect(mapping[' Last Name ']).toBe('lastName');
    expect(mapping[' Class ']).toBe('className');
  });
});

describe('isValidPhone', () => {
  it('accepts valid Nigerian phone numbers', () => {
    expect(isValidPhone('08012345678')).toBe(true);
    expect(isValidPhone('0801234567')).toBe(true);
    expect(isValidPhone('080123456789')).toBe(true);
    expect(isValidPhone('+2348012345678')).toBe(true);
    expect(isValidPhone('09012345678')).toBe(true);
  });

  it('rejects invalid phone numbers', () => {
    expect(isValidPhone('123')).toBe(false);
    expect(isValidPhone('abcdefghij')).toBe(false);
    expect(isValidPhone('')).toBe(false);
    expect(isValidPhone('no-digits-here')).toBe(false);
  });
});

describe('isValidEmail', () => {
  it('accepts valid email addresses', () => {
    expect(isValidEmail('test@example.com')).toBe(true);
    expect(isValidEmail('user.name@school.edu.ng')).toBe(true);
    expect(isValidEmail('parent@school.com')).toBe(true);
  });

  it('rejects invalid email addresses', () => {
    expect(isValidEmail('not-an-email')).toBe(false);
    expect(isValidEmail('missing@domain')).toBe(false);
    expect(isValidEmail('')).toBe(false);
    expect(isValidEmail('space in@email.com')).toBe(false);
  });
});

describe('normalizeStatus', () => {
  it('normalizes active status variants', () => {
    expect(normalizeStatus('active')).toBe('ACTIVE');
    expect(normalizeStatus('Active')).toBe('ACTIVE');
    expect(normalizeStatus('ACTIVE')).toBe('ACTIVE');
  });

  it('normalizes other status types', () => {
    expect(normalizeStatus('graduated')).toBe('GRADUATED');
    expect(normalizeStatus('transferred')).toBe('TRANSFERRED');
    expect(normalizeStatus('suspended')).toBe('SUSPENDED');
    expect(normalizeStatus('withdrawn')).toBe('WITHDRAWN');
  });

  it('defaults to ACTIVE for unknown status', () => {
    expect(normalizeStatus('unknown')).toBe('ACTIVE');
    expect(normalizeStatus('')).toBe('ACTIVE');
  });
});

describe('normalizeRelationship', () => {
  it('normalizes father relationship', () => {
    expect(normalizeRelationship('father')).toBe('FATHER');
    expect(normalizeRelationship('Father')).toBe('FATHER');
    expect(normalizeRelationship('FATHER')).toBe('FATHER');
  });

  it('normalizes mother relationship', () => {
    expect(normalizeRelationship('mother')).toBe('MOTHER');
    expect(normalizeRelationship('Mother')).toBe('MOTHER');
  });

  it('normalizes parent relationship to GUARDIAN', () => {
    expect(normalizeRelationship('parent')).toBe('GUARDIAN');
    expect(normalizeRelationship('Parent')).toBe('GUARDIAN');
    expect(normalizeRelationship('PARENT')).toBe('GUARDIAN');
  });

  it('normalizes grandfather relationship', () => {
    expect(normalizeRelationship('grandfather')).toBe('GRANDPARENT');
    expect(normalizeRelationship('Grandfather')).toBe('GRANDPARENT');
  });

  it('defaults to OTHER for unknown relationships', () => {
    expect(normalizeRelationship('unknown')).toBe('OTHER');
  });
});

describe('validateRow', () => {
  const headerToField: ColumnMapping = {
    'First Name': 'firstName',
    'Last Name': 'lastName',
    'Class': 'className',
    'Parent Name': 'guardianName',
    'Parent Phone': 'guardianPhone',
    'Admission Number': 'admissionNumber',
    'Student ID': 'studentId',
    'Email': 'guardianEmail',
  };

  const divisions: SchoolDivision[] = [
    { id: 'd1', name: 'JSS 1', code: 'JSS1', schoolId: 's1' },
    { id: 'd2', name: 'JSS 2', code: 'JSS2', schoolId: 's1' },
  ];

  it('validates a complete valid row', () => {
    const row = {
      'First Name': 'John',
      'Last Name': 'Doe',
      'Class': 'JSS 1',
      'Parent Name': 'Jane Doe',
      'Parent Phone': '08012345678',
      'Admission Number': 'ADM001',
      'Student ID': 'SID001',
    };
    const result = validateRow(row, headerToField, {
      existingStudents: [],
      divisions,
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.mapped.firstName).toBe('John');
    expect(result.mapped.lastName).toBe('Doe');
    expect(result.mapped.className).toBe('JSS 1');
  });

  it('detects missing required fields', () => {
    const row = {
      'First Name': '',
      'Last Name': 'Doe',
      'Class': 'JSS 1',
      'Parent Name': '',
      'Parent Phone': 'not-a-phone',
    };
    const result = validateRow(row, headerToField, {
      existingStudents: [],
      divisions,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('First name'))).toBe(true);
    expect(result.errors.some((e) => e.includes('Guardian full name'))).toBe(true);
    expect(result.errors.some((e) => e.includes('phone'))).toBe(true);
  });

  it('warns on invalid email instead of error', () => {
    const row = {
      'First Name': 'John',
      'Last Name': 'Doe',
      'Class': 'JSS 1',
      'Parent Name': 'Jane Doe',
      'Parent Phone': '08012345678',
      'Email': 'not-an-email',
    };
    const result = validateRow(row, { ...headerToField, 'Email': 'guardianEmail' }, {
      existingStudents: [],
      divisions,
    });
    expect(result.valid).toBe(true);
    expect(result.warnings.some((w) => w.includes('email'))).toBe(true);
  });

  it('warns on unknown class/division', () => {
    const row = {
      'First Name': 'John',
      'Last Name': 'Doe',
      'Class': 'Unknown Class',
      'Parent Name': 'Jane Doe',
      'Parent Phone': '08012345678',
    };
    const result = validateRow(row, headerToField, {
      existingStudents: [],
      divisions,
    });
    expect(result.warnings.some((w) => w.includes('Unknown class'))).toBe(true);
  });

  it('warns on invalid date formats', () => {
    const row = {
      'First Name': 'John',
      'Last Name': 'Doe',
      'Class': 'JSS 1',
      'Parent Name': 'Jane Doe',
      'Parent Phone': '08012345678',
      'DOB': 'not-a-date',
    };
    const result = validateRow(
      row,
      { ...headerToField, DOB: 'dateOfBirth' },
      { existingStudents: [], divisions },
    );
    expect(result.warnings.some((w) => w.includes('Date of birth'))).toBe(true);
  });
});

describe('validateAllRows', () => {
  const headerToField: ColumnMapping = {
    'First Name': 'firstName',
    'Last Name': 'lastName',
    'Class': 'className',
    'Parent Phone': 'guardianPhone',
    'Admission Number': 'admissionNumber',
  };

  const divisions: SchoolDivision[] = [
    { id: 'd1', name: 'JSS 1', code: 'JSS1', schoolId: 's1' },
    { id: 'd2', name: 'JSS 2', code: 'JSS2', schoolId: 's1' },
  ];

  it('validates all rows and returns summary', () => {
    const rows = [
      { 'First Name': 'Alice', 'Last Name': 'Smith', 'Class': 'JSS 1', 'Parent Phone': '08012345678', 'Admission Number': 'ADM001' },
      { 'First Name': 'Bob', 'Last Name': '', 'Class': 'JSS 2', 'Parent Phone': '08012345678', 'Admission Number': 'ADM002' },
    ];
    const result = validateAllRows(rows, headerToField, { existingStudents: [], divisions });
    expect(result.validatedRows).toHaveLength(2);
    expect(result.validatedRows[0].valid).toBe(true);
    expect(result.validatedRows[1].valid).toBe(false);
    expect(result.summary.total).toBe(2);
    expect(result.summary.ready).toBe(1);
    expect(result.summary.errors).toBe(1);
  });

  it('detects duplicate admission numbers within the same file', () => {
    const rows = [
      { 'First Name': 'Alice', 'Last Name': 'Smith', 'Class': 'JSS 1', 'Parent Phone': '08012345678', 'Admission Number': 'ADM001' },
      { 'First Name': 'Bob', 'Last Name': 'Adams', 'Class': 'JSS 2', 'Parent Phone': '08012345678', 'Admission Number': 'ADM001' },
    ];
    const result = validateAllRows(rows, headerToField, { existingStudents: [], divisions });
    expect(result.summary.errors).toBe(1);
    expect(result.validatedRows[1].errors.some((e) => e.includes('Duplicate'))).toBe(true);
  });

  it('flags students already existing in CAPFLUX', () => {
    const rows = [
      { 'First Name': 'Alice', 'Last Name': 'Smith', 'Class': 'JSS 1', 'Parent Phone': '08012345678', 'Admission Number': 'ADM001' },
    ];
    const existingStudents = [
      { admissionNumber: 'ADM001', guardian: { phone: '08012345678' } } as any,
    ];
    const result = validateAllRows(rows, headerToField, { existingStudents, divisions });
    expect(result.validatedRows[0].exists).toBe(true);
  });

  it('detects duplicate guardian phones within the file as warnings', () => {
    const rows = [
      { 'First Name': 'Alice', 'Last Name': 'Smith', 'Class': 'JSS 1', 'Parent Phone': '08011111111', 'Admission Number': 'ADM001' },
      { 'First Name': 'Bob', 'Last Name': 'Adams', 'Class': 'JSS 2', 'Parent Phone': '08011111111', 'Admission Number': 'ADM002' },
    ];
    const result = validateAllRows(rows, headerToField, { existingStudents: [], divisions });
    expect(result.validatedRows[1].warnings.some((w) => w.includes('Duplicate'))).toBe(true);
  });
});

describe('Template helpers', () => {
  it('TEMPLATE_HEADERS includes required fields', () => {
    expect(TEMPLATE_HEADERS).toContain('First Name');
    expect(TEMPLATE_HEADERS).toContain('Last Name');
    expect(TEMPLATE_HEADERS).toContain('Class');
    expect(TEMPLATE_HEADERS).toContain('Parent Name');
  });

  it('getTemplateHeaders returns array of header names', () => {
    const headers = getTemplateHeaders();
    expect(Array.isArray(headers)).toBe(true);
    expect(headers.length).toBeGreaterThan(0);
    expect(headers).toContain('First Name');
  });

  it('getTemplateSampleRow returns a valid sample row', () => {
    const sample = getTemplateSampleRow();
    expect(sample['First Name']).toBeTruthy();
    expect(sample['Last Name']).toBeTruthy();
  });
});
