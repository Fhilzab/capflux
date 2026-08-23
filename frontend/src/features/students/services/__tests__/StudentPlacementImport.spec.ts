/**
 * Academic-placement import tests: column detection, validation errors for
 * invalid levels/sections/sessions, and enrollment creation on batchImport.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// EnrollmentService is injected as a callback into batchImport — spy on the module anyway
// so we can assert it was invoked by the dialog wiring path.
vi.mock('@/shared/enrollment/EnrollmentService', () => ({
  EnrollmentService: {
    enrollStudent: vi.fn().mockResolvedValue({ ok: true }),
  },
}));

import {
  KNOWN_COLUMN_PATTERNS,
  detectColumns,
  validateRow,
  validateAllRows,
  batchImport,
} from '../StudentImportService';
import type { ColumnMapping } from '../../types';
import type { SchoolDivision } from '@/shared/divisions/types';
import { EnrollmentService } from '@/shared/enrollment/EnrollmentService';

const STRUCTURE = {
  sessions: [{ id: 'session-1', name: '2026/2027' }],
  sections: [
    { id: 'sec-1', name: 'Primary' },
    { id: 'sec-2', name: 'Secondary' },
  ],
  levels: [
    { id: 'lvl-p3', name: 'Primary 3', sectionId: 'sec-1' },
    { id: 'lvl-p4', name: 'Primary 4', sectionId: 'sec-1' },
    { id: 'lvl-jss1', name: 'JSS 1', sectionId: 'sec-2' },
  ],
  defaultSessionId: 'session-1',
};

const DIVISIONS = [
  { id: 'sec-1', name: 'Primary', code: 'PRI', schoolId: 'school-1', displayOrder: 1, status: 'ACTIVE', createdAt: '', updatedAt: '' },
  { id: 'sec-2', name: 'Secondary', code: 'SEC', schoolId: 'school-1', displayOrder: 2, status: 'ACTIVE', createdAt: '', updatedAt: '' },
] as unknown as SchoolDivision[];

function baseRow(overrides: Record<string, string> = {}) {
  return {
    'First Name': 'Ada',
    'Last Name': 'Obi',
    'Guardian Phone': '08012345678',
    ...overrides,
  };
}

const MAPPING: ColumnMapping = detectColumns([
  'First Name', 'Last Name', 'Guardian Phone',
  'Section', 'Academic Level', 'Academic Session', 'Class',
]);

describe('placement column patterns', () => {
  it('recognizes section and level header variations', () => {
    expect(KNOWN_COLUMN_PATTERNS.section).toContain('Section');
    expect(KNOWN_COLUMN_PATTERNS.section).toContain('Arm');
    expect(KNOWN_COLUMN_PATTERNS.academicLevel).toContain('Academic Level');
    expect(KNOWN_COLUMN_PATTERNS.academicLevel).toContain('Grade Level');
  });

  it('auto-detects section/level columns from headers', () => {
    const mapping = detectColumns(['Section', 'Academic Level']);
    expect(mapping['Section']).toBe('section');
    expect(mapping['Academic Level']).toBe('academicLevel');
  });
});

describe('validateRow with academicStructure', () => {
  const options = {
    existingStudents: [],
    divisions: DIVISIONS,
    academicStructure: STRUCTURE,
  };

  it('accepts a valid placement', () => {
    const result = validateRow(baseRow({
      'Section': 'Primary',
      'Academic Level': 'Primary 4',
      'Academic Session': '2026/2027',
    }), MAPPING, options);
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it('rejects a level that does not exist ("Primary Four" vs "Primary 4")', () => {
    const result = validateRow(baseRow({
      'Section': 'Primary',
      'Academic Level': 'Primary Four',
    }), MAPPING, options);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Academic Level "Primary Four" does not exist'))).toBe(true);
  });

  it('rejects a valid level placed in the wrong section', () => {
    const result = validateRow(baseRow({
      'Section': 'Primary',
      'Academic Level': 'JSS 1',
    }), MAPPING, options);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('does not exist'))).toBe(true);
  });

  it('rejects an unknown section', () => {
    const result = validateRow(baseRow({
      'Section': 'Tertiary',
      'Academic Level': 'Primary 3',
    }), MAPPING, options);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Section "Tertiary" does not exist'))).toBe(true);
  });

  it('rejects an unknown academic session', () => {
    const result = validateRow(baseRow({
      'Academic Session': '1999/2000',
    }), MAPPING, options);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Academic session "1999/2000" does not exist'))).toBe(true);
  });
});

describe('validateAllRows summary with placements', () => {
  it('counts invalid placements in the error summary', () => {
    const rows = [
      baseRow({ 'Academic Level': 'Primary 3' }),
      baseRow({ 'First Name': 'Chidi', 'Academic Level': 'Primary Four' }),
    ];
    const { summary } = validateAllRows(rows, MAPPING, {
      existingStudents: [],
      divisions: DIVISIONS,
      academicStructure: STRUCTURE,
    });
    expect(summary.total).toBe(2);
    expect(summary.ready).toBe(1);
    expect(summary.errors).toBe(1);
  });
});

describe('batchImport creates enrollments (reason IMPORT)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls enrollStudent for each imported row with resolved IDs', async () => {
    const enrollments: any[] = [];
    const ctx = {
      schoolId: 'school-1',
      divisions: DIVISIONS,
      academicStructure: STRUCTURE,
      enrollStudent: async (input: any) => {
        enrollments.push(input);
        return { ok: true };
      },
      createStudent: async (data: any) => ({
        data: { id: `stu-${data.firstName}`, error: null },
        error: null,
      }),
      getOrCreateGuardian: async () => ({ id: 'guardian-1' }),
    };

    const rows = [
      {
        rowIndex: 2,
        mapped: {
          firstName: 'Ada',
          lastName: 'Obi',
          guardianName: 'Mrs. Obi',
          guardianPhone: '08012345678',
          relationship: 'MOTHER',
          status: 'ACTIVE',
          gender: '',
          className: '',
          section: 'Primary',
          academicLevel: 'Primary 3',
          academicSession: '2026/2027',
        },
        valid: true,
        errors: [],
        warnings: [],
        exists: false,
      },
    ];

    const result = await batchImport(rows as any, ctx as any);
    expect(result.imported).toBe(1);
    expect(enrollments).toHaveLength(1);
    expect(enrollments[0]).toMatchObject({
      sessionId: 'session-1',
      sectionId: 'sec-1',
      levelId: 'lvl-p3',
      reason: 'IMPORT',
    });

    void EnrollmentService; // imported for mock registration side effect
  });

  it('reports a failure when enrollment fails after student creation', async () => {
    const ctx = {
      schoolId: 'school-1',
      divisions: DIVISIONS,
      academicStructure: STRUCTURE,
      enrollStudent: async () => {
        throw new Error('level inactive');
      },
      createStudent: async (data: any) => ({
        data: { id: `stu-${data.firstName}`, error: null },
        error: null,
      }),
      getOrCreateGuardian: async () => ({ id: 'guardian-1' }),
    };

    const rows = [
      {
        rowIndex: 2,
        mapped: {
          firstName: 'Ada',
          lastName: 'Obi',
          guardianName: 'Mrs. Obi',
          guardianPhone: '08012345678',
          relationship: 'MOTHER',
          status: 'ACTIVE',
          gender: '',
          section: 'Primary',
          academicLevel: 'Primary 3',
          academicSession: '2026/2027',
        },
        valid: true,
        errors: [],
        warnings: [],
        exists: false,
      },
    ];

    const result = await batchImport(rows as any, ctx as any);
    expect(result.imported).toBe(0);
    expect(result.failed).toBe(1);
    expect(result.failures[0].message).toContain('placement failed');
  });
});
