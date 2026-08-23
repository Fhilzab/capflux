/**
 * Centralized guardian relationship types.
 *
 * Single source of truth for the per-link `relationship` value stored on
 * student_guardians (and mirrored onto guardians.relationship defaults).
 * Values MUST stay in sync with the `guardian_relationship` Postgres enum
 * (see supabase/migrations/202608230001_guardian_relationships.sql).
 */

export type GuardianRelationship =
  | 'FATHER'
  | 'MOTHER'
  | 'GUARDIAN'
  | 'SPONSOR'
  | 'SIBLING'
  | 'RELATIVE'
  | 'GRANDPARENT'
  | 'UNCLE'
  | 'AUNT'
  | 'BROTHER'
  | 'SISTER'
  | 'OTHER';

export const GUARDIAN_RELATIONSHIP_VALUES: readonly GuardianRelationship[] = [
  'FATHER',
  'MOTHER',
  'GUARDIAN',
  'SPONSOR',
  'SIBLING',
  'RELATIVE',
  'GRANDPARENT',
  'UNCLE',
  'AUNT',
  'BROTHER',
  'SISTER',
  'OTHER',
] as const;

export interface GuardianRelationshipOption {
  value: GuardianRelationship;
  label: string;
}

export const GUARDIAN_RELATIONSHIP_OPTIONS: GuardianRelationshipOption[] = [
  { value: 'FATHER', label: 'Father' },
  { value: 'MOTHER', label: 'Mother' },
  { value: 'GUARDIAN', label: 'Guardian' },
  { value: 'SPONSOR', label: 'Sponsor' },
  { value: 'SIBLING', label: 'Sibling' },
  { value: 'GRANDPARENT', label: 'Grandparent' },
  { value: 'UNCLE', label: 'Uncle' },
  { value: 'AUNT', label: 'Aunt' },
  { value: 'BROTHER', label: 'Brother' },
  { value: 'SISTER', label: 'Sister' },
  { value: 'RELATIVE', label: 'Relative' },
  { value: 'OTHER', label: 'Other' },
];

export function isGuardianRelationship(value: unknown): value is GuardianRelationship {
  return (
    typeof value === 'string' &&
    GUARDIAN_RELATIONSHIP_VALUES.includes(value as GuardianRelationship)
  );
}

/** Normalize arbitrary input (imports, legacy rows) into a valid enum value. */
export function normalizeGuardianRelationship(value: unknown): GuardianRelationship {
  if (isGuardianRelationship(value)) return value;
  return 'OTHER';
}

export function guardianRelationshipLabel(value: string | null | undefined): string {
  const option = GUARDIAN_RELATIONSHIP_OPTIONS.find((o) => o.value === value);
  return option?.label ?? 'Other';
}
