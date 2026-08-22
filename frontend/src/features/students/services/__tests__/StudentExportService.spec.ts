import {
  EXPORT_FIELDS,
  prepareExportData,
  getExportSummary,
  exportToCSV,
} from '../StudentExportService';

// Mock browser APIs for CSV download
const mockBlobs: Blob[] = [];

beforeEach(() => {
  mockBlobs.length = 0;
  globalThis.Blob = class Blob {
    _parts: any[];
    constructor(parts: any[], options: any) {
      this._parts = parts;
      mockBlobs.push(this as any);
    }
    text() {
      return this._parts.join('');
    }
    get size() { return 0; }
    get type() { return 'text/csv'; }
  } as any;

  globalThis.URL.createObjectURL = () => 'blob:mock-url';
  globalThis.URL.revokeObjectURL = () => {};
  (globalThis as any).document = {
    createElement: () => ({
      click: () => {},
      href: '',
      download: '',
      style: {},
    }),
    body: {
      appendChild: () => ({}),
      removeChild: () => {},
    },
  };
});

const makeStudent = (overrides: Record<string, any> = {}) => ({
  id: 's1',
  schoolId: 'school1',
  firstName: 'Ade',
  lastName: 'Okafor',
  admissionNumber: 'ADM001',
  studentId: 'SID001',
  class: 'JSS 1',
  divisionId: 'd1',
  guardianId: 'g1',
  guardian: {
    id: 'g1',
    fullName: 'Mary Okafor',
    phone: '08012345678',
    email: 'mary@example.com',
    relationship: 'MOTHER',
    address: '123 Lagos St',
    secondaryPhone: '',
  },
  gender: 'Female',
  dateOfBirth: '2010-05-15',
  admissionDate: '2024-01-15',
  registeredAt: '2024-01-15T10:00:00Z',
  status: 'ACTIVE',
  createdAt: '2024-01-15T10:00:00Z',
  updatedAt: '2024-01-15T10:00:00Z',
  academicSession: '2024/2025',
  ...overrides,
});

const studentFields = EXPORT_FIELDS.map((f) => f.key);

describe('EXPORT_FIELDS', () => {
  it('includes student ID and admission number', () => {
    const keys = EXPORT_FIELDS.map((f) => f.key);
    expect(keys).toContain('studentId');
    expect(keys).toContain('admissionNumber');
  });

  it('includes personal info fields', () => {
    const keys = EXPORT_FIELDS.map((f) => f.key);
    expect(keys).toContain('firstName');
    expect(keys).toContain('middleName');
    expect(keys).toContain('lastName');
    expect(keys).toContain('dateOfBirth');
    expect(keys).toContain('gender');
  });

  it('includes class, session, and status info', () => {
    const keys = EXPORT_FIELDS.map((f) => f.key);
    expect(keys).toContain('class');
    expect(keys).toContain('academicSession');
    expect(keys).toContain('status');
    expect(keys).toContain('admissionDate');
  });

  it('includes guardian info', () => {
    const keys = EXPORT_FIELDS.map((f) => f.key);
    expect(keys).toContain('guardianName');
    expect(keys).toContain('guardianRelationship');
    expect(keys).toContain('guardianPhone');
    expect(keys).toContain('guardianEmail');
  });

  it('includes registration date', () => {
    const keys = EXPORT_FIELDS.map((f) => f.key);
    expect(keys).toContain('registeredAt');
  });

  it('all fields have non-empty labels and getValue functions', () => {
    EXPORT_FIELDS.forEach((f) => {
      expect(f.label).toBeTruthy();
      expect(f.label.length).toBeGreaterThan(0);
      expect(typeof f.getValue).toBe('function');
    });
  });
});

describe('prepareExportData', () => {
  it('returns array of objects with field label keys', () => {
    const student = makeStudent();
    const fields = ['firstName', 'lastName', 'class'];
    const data = prepareExportData([student], fields);
    expect(data).toHaveLength(1);
    expect(data[0]['First Name']).toBe('Ade');
    expect(data[0]['Last Name']).toBe('Okafor');
    expect(data[0]['Class']).toBe('JSS 1');
  });

  it('handles missing optional fields', () => {
    const student = makeStudent({ studentId: undefined, middleName: undefined });
    const fields = ['studentId', 'middleName'];
    const data = prepareExportData([student], fields);
    expect(data[0]['Student ID']).toBe('ADM001');
    expect(data[0]['Middle Name']).toBe('');
  });

  it('handles empty students array', () => {
    const data = prepareExportData([], ['firstName', 'lastName']);
    expect(data).toHaveLength(0);
  });

  it('handles empty fields array (returns all fields)', () => {
    const student = makeStudent();
    const data = prepareExportData([student]);
    expect(data).toHaveLength(1);
    expect(Object.keys(data[0]).length).toBeGreaterThan(0);
  });

  it('uses getValue for each field correctly', () => {
    const student = makeStudent({ firstName: 'Bola', lastName: 'Adeyemi' });
    const data = prepareExportData([student], ['firstName', 'lastName', 'guardianName', 'guardianPhone']);
    expect(data[0]['First Name']).toBe('Bola');
    expect(data[0]['Last Name']).toBe('Adeyemi');
    expect(data[0]['Guardian Name']).toBe('Mary Okafor');
    expect(data[0]['Guardian Phone']).toBe('08012345678');
  });

  it('falls back to admissionNumber for studentId', () => {
    const student = makeStudent({ studentId: undefined });
    const data = prepareExportData([student], ['studentId']);
    expect(data[0]['Student ID']).toBe('ADM001');
  });
});

describe('getExportSummary', () => {
  it('returns summary with student count for CSV', () => {
    const students = [makeStudent(), makeStudent({ id: 's2', firstName: 'Tayo' })];
    const summary = getExportSummary(students, 'csv', ['firstName', 'lastName']);
    expect(summary).toContain('2');
    expect(summary.toLowerCase()).toContain('students');
    expect(summary.toLowerCase()).toContain('csv');
  });

  it('mentions the number of fields', () => {
    const students = [makeStudent()];
    const summary = getExportSummary(students, 'csv', studentFields);
    expect(summary).toContain(String(studentFields.length));
    expect(summary.toLowerCase()).toContain('fields');
  });

  it('mentions format as Excel for xlsx', () => {
    const students = [makeStudent()];
    const summary = getExportSummary(students, 'xlsx', ['firstName']);
    expect(summary.toLowerCase()).toContain('excel');
  });

  it('handles single student without pluralizing', () => {
    const summary = getExportSummary([makeStudent()], 'csv', ['firstName']);
    expect(summary.toLowerCase()).toContain('student');
    expect(summary.toLowerCase()).not.toContain('students');
  });

  it('handles empty students list', () => {
    const summary = getExportSummary([], 'csv', ['firstName']);
    expect(summary).toContain('0');
    expect(summary.toLowerCase()).toContain('students');
  });
});

describe('exportToCSV', () => {
  it('creates a blob with CSV content', () => {
    const student = makeStudent({ firstName: 'Charlie', lastName: 'Smith' });
    exportToCSV([student], ['firstName', 'lastName'], 'students.csv');
    expect(mockBlobs).toHaveLength(1);
    const content = mockBlobs[0].text();
    expect(content).toContain('First Name');
    expect(content).toContain('Last Name');
    expect(content).toContain('Charlie');
    expect(content).toContain('Smith');
  });

  it('includes CSV header row', () => {
    exportToCSV([makeStudent()], ['firstName', 'lastName'], 'test.csv');
    const content = mockBlobs[0].text();
    const lines = content.split('\n');
    expect(lines[0]).toContain('First Name');
    expect(lines[0]).toContain('Last Name');
  });

  it('includes data rows', () => {
    const students = [
      makeStudent({ firstName: 'Alice', lastName: 'Brown' }),
      makeStudent({ id: 's2', firstName: 'Bob', lastName: 'White' }),
    ];
    exportToCSV(students, ['firstName', 'lastName'], 'test.csv');
    const content = mockBlobs[0].text();
    const lines = content.split('\n').filter((l) => l.length > 0);
    expect(lines.length).toBe(3); // header + 2 data rows
  });

  it('uses default filename when not provided', () => {
    exportToCSV([makeStudent()], ['firstName']);
    expect(mockBlobs).toHaveLength(1);
  });

  it('handles empty students list (just headers)', () => {
    exportToCSV([], ['firstName', 'lastName'], 'empty.csv');
    const content = mockBlobs[0].text();
    expect(content).toContain('First Name');
    expect(content).toContain('Last Name');
  });

  it('handles fields with commas (CSV escaping)', () => {
    const student = makeStudent({
      firstName: 'John, Jr.',
      lastName: 'Okafor',
    });
    exportToCSV([student], ['firstName', 'lastName'], 'escape.csv');
    const content = mockBlobs[0].text();
    expect(content).toContain('"John, Jr."');
  });
});
