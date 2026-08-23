/**
 * StudentExportService
 *
 * Exports NormalizedStudent records to CSV or XLSX format.
 * Reads from the existing student data source — does NOT duplicate data
 * into an export-specific store. Respects tenant isolation (only exports
 * the currently school's students passed from the composable).
 *
 * Sensitive internal/system fields are never exported.
 */

import * as XLSX from 'xlsx';
import type { NormalizedStudent } from '../types';

/* ── Available export fields ──────────────────────────────────────── */
export interface ExportField {
  key: string;
  label: string;
  getValue: (student: NormalizedStudent) => string;
}

export const EXPORT_FIELDS: ExportField[] = [
  {
    key: 'studentId',
    label: 'Student ID',
    getValue: (s) => s.admissionNumber || s.studentId || s.id || '',
  },
  {
    key: 'admissionNumber',
    label: 'Admission Number',
    getValue: (s) => s.admissionNumber || '',
  },
  {
    key: 'firstName',
    label: 'First Name',
    getValue: (s) => s.firstName,
  },
  {
    key: 'middleName',
    label: 'Middle Name',
    getValue: (s) => s.middleName || '',
  },
  {
    key: 'lastName',
    label: 'Last Name',
    getValue: (s) => s.lastName,
  },
  {
    key: 'dateOfBirth',
    label: 'Date of Birth',
    getValue: (s) => s.dateOfBirth || '',
  },
  {
    key: 'gender',
    label: 'Gender',
    getValue: (s) => s.gender || '',
  },
  {
    key: 'class',
    label: 'Class',
    getValue: (s) => s.class || '',
  },
  {
    key: 'section',
    label: 'Section',
    getValue: (s) => (s as any).sectionName || s.class || '',
  },
  {
    key: 'academicLevel',
    label: 'Academic Level',
    getValue: (s) => (s as any).levelName || s.class || '',
  },
  {
    key: 'status',
    label: 'Status',
    getValue: (s) => s.status,
  },
  {
    key: 'admissionDate',
    label: 'Admission Date',
    getValue: (s) => s.admissionDate || '',
  },
  {
    key: 'guardianName',
    label: 'Guardian Name',
    getValue: (s) => s.guardian?.fullName || '',
  },
  {
    key: 'guardianRelationship',
    label: 'Guardian Relationship',
    getValue: (s) => s.guardian?.relationship || '',
  },
  {
    key: 'guardianPhone',
    label: 'Guardian Phone',
    getValue: (s) => s.guardian?.phone || '',
  },
  {
    key: 'guardianEmail',
    label: 'Guardian Email',
    getValue: (s) => s.guardian?.email || '',
  },
  {
    key: 'registeredAt',
    label: 'Registration Date',
    getValue: (s) => s.registeredAt || s.createdAt,
  },
  {
    key: 'academicSession',
    label: 'Academic Session',
    getValue: (s) => (s as any).academicSession || '',
  },
];

/* ── CSV escaping ────────────────────────────────────────────────── */
function escapeCsvField(value: string): string {
  if (value == null) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/* ── Data preparation ─────────────────────────────────────────────── */
export function prepareExportData(
  students: NormalizedStudent[],
  fieldKeys: string[] = [],
): Record<string, string>[] {
  const fields = fieldKeys.length
    ? EXPORT_FIELDS.filter((f) => fieldKeys.includes(f.key))
    : EXPORT_FIELDS;

  return students.map((student) => {
    const row: Record<string, string> = {};
    for (const field of fields) {
      row[field.label] = field.getValue(student);
    }
    return row;
  });
}

/* ── CSV export ──────────────────────────────────────────────────── */
export function exportToCSV(
  students: NormalizedStudent[],
  fieldKeys: string[] = [],
  fileName = 'students-export.csv',
): void {
  const data = prepareExportData(students, fieldKeys);

  // Derive headers from the selected field definitions (not the first row) so
  // an empty export still produces a valid CSV with just the header row.
  const selectedFields = fieldKeys.length
    ? EXPORT_FIELDS.filter((f) => fieldKeys.includes(f.key))
    : EXPORT_FIELDS;
  const headers = selectedFields.map((f) => f.label);
  const rows = data.map((row) =>
    headers.map((h) => escapeCsvField(row[h] || '')).join(','),
  );

  const csvContent = [headers.map(escapeCsvField).join(','), ...rows].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ── XLSX export ─────────────────────────────────────────────────── */
export function exportToXLSX(
  students: NormalizedStudent[],
  fieldKeys: string[] = [],
  fileName = 'students-export.xlsx',
): void {
  const data = prepareExportData(students, fieldKeys);

  const ws = XLSX.utils.json_to_sheet(data, {
    header: data.length ? Object.keys(data[0]) : [],
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Students');
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });

  const blob = new Blob([wbout], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ── Summary info ────────────────────────────────────────────────── */
export function getExportSummary(
  students: NormalizedStudent[],
  format: 'csv' | 'xlsx',
  fieldKeys: string[] = [],
): string {
  const fields = fieldKeys.length
    ? EXPORT_FIELDS.filter((f) => fieldKeys.includes(f.key))
    : EXPORT_FIELDS;
  const ext = format === 'csv' ? 'CSV' : 'Excel (.xlsx)';
  if (students.length === 0) {
    return `Export 0 students to ${ext}`;
  }
  return `Export ${students.length} student${students.length === 1 ? '' : 's'} to ${ext} (${fields.length} fields)`;
}
