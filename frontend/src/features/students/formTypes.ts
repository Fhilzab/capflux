/**
 * Shared form-facing types for the Students feature.
 * Re-exported from the offline layer so row shapes stay single-sourced.
 */

export type {
  AcademicSessionRow,
  SchoolDivisionRow,
  AcademicLevelRow,
} from '../../offline/localDb';

/** Minimal guardian shape used by pickers (legacy snake_case rows). */
export interface GuardianRowLike {
  id: string;
  full_name?: string;
  primary_phone?: string;
  email?: string | null;
}
