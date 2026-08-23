/**
 * db — domain-facing database row types for the CAPFLUX backend.
 *
 * Phase 3 hardening: these are now DERIVED from the authoritative
 * Supabase-generated schema types (types/database.types.ts) rather than
 * hand-maintained interfaces. The generated file must be regenerated via
 * `npm run db:types` whenever the database schema changes.
 *
 * Convention:
 *   - `*Row` aliases map 1:1 to a table's generated Row type.
 *   - Embedded/joined payloads that PostgREST returns through resource
 *     embeddings (e.g. `students(...)` inside a payment row) are NOT part of
 *     Row; they are declared explicitly as `With*` extensions where used.
 */
import type { Database } from './database.types.js';

type Public = Database['public']['Tables'];

// ── Identity / platform ──────────────────────────────────────────────────

export type Uuid = string;
export type IsoTimestamp = string;
/** JSON columns as typed by PostgREST codegen. */
export type DbJson = Database['public']['Tables']['audit_logs']['Row']['metadata'];

export type UserRow = Public['users']['Row'];

export type UserProfileRow = Public['user_profiles']['Row'];

export type RoleRow = Public['roles']['Row'];
export type RoleInsert = Public['roles']['Insert'];

export type SystemRole = NonNullable<RoleRow['system_role']>;

export type PermissionRow = Public['permissions']['Row'];

export interface RolePermissionWithPermission {
  permissions?: Pick<PermissionRow, 'code'> | null;
}
export interface RolePermissionWithPermissionFull {
  permissions?: PermissionRow | null;
}

// ── Organizations / schools ──────────────────────────────────────────────

export type OrganizationRow = Public['organizations']['Row'];

export interface OrganizationMemberJoined {
  organization_id: string;
  role_id: string | null;
  joined_at: string | null;
  organizations?: OrganizationRow | null;
  roles?: Pick<RoleRow, 'id' | 'name' | 'system_role'> | null;
}
export type OrganizationMemberRow = Public['organization_members']['Row'];

export type SchoolStatus = NonNullable<SchoolRow['status']>;
export type PaymentStatus = NonNullable<SchoolRow['payment_status']>;

export type SchoolRow = Public['schools']['Row'];

export type SchoolMemberRow = Public['school_members']['Row'];
export type SchoolMemberSchoolOnly = Pick<SchoolMemberRow, 'school_id'>;

/**
 * PostgREST embedding shapes — NOT part of the base Row; declared per query.
 */
export interface SchoolMemberWithRole {
  id?: string;
  user_id?: string;
  school_id: string;
  role_id?: string | null;
  joined_at?: string | null;
  left_at?: string | null;
  is_active?: boolean | null;
  roles?: Pick<RoleRow, 'id' | 'name' | 'system_role' | 'is_system_role'> | null;
  users?: { email?: string | null } | null;
}

// ── Students ─────────────────────────────────────────────────────────────

export type StudentRow = Public['students']['Row'];
/** students(...) embedding used by payment/DVA queries. */
export type StudentEmbed = {
  id?: string;
  school_id?: string;
  first_name?: string | null;
  last_name?: string | null;
  class_name?: string | null;
  guardian_id?: string | null;
};

export type GuardianRow = Public['guardians']['Row'];
export type GuardianPhoneEmbed = { primary_phone?: string | null };

// ── Ledger / payments ────────────────────────────────────────────────────

/** Money is handled in integer minor units (kobo) via amount_minor. */
export type AmountMinor = number;

export type LedgerEntryRow = Public['ledger_entries']['Row'];
export type LedgerEntryInsert = Public['ledger_entries']['Insert'];

/**
 * Authoritative payment state machine values, derived from the live
 * PostgreSQL enum (`payment_txn_status`) via generated types.
 * PENDING -> PROCESSING -> SUCCESS | FAILED; SUCCESS -> REVERSED.
 */
export type TransactionStatus = Database['public']['Enums']['payment_txn_status'];

/**
 * Phase 1 remediation note: payment_transactions has NO created_at column.
 * Migration 0025 inserts every row with verified_at = now() atomically, so
 * verified_at is both the record-creation timestamp and the verification
 * chronology. API responses expose that value under the legacy `created_at`
 * key (mapped at the service boundary) to preserve wire contracts.
 */
export type PaymentTransactionRow = Public['payment_transactions']['Row'] & {
  /** Joined alias used by list queries. */
  students?: Pick<StudentEmbed, 'first_name' | 'last_name' | 'class_name'> | null;
};

/** Shape consumed by PaymentService.summary(). */
export interface PaymentTransactionSummaryRow {
  status: PaymentTransactionRow['status'];
  amount_minor: number | null;
  verified_at?: string | null;
}

/** Settlement records are school-scoped through the parent payment row. */
export type SettlementRecordWithParent = SettlementRecordRow & {
  payment_transactions?: { school_id?: string; reference?: string | null; student_id?: string | null } | null;
};

/** Shape consumed by reconciliation local-reference lookups. */
export interface PaymentTransactionRefRow {
  reference: string;
  gateway_txn_ref?: string | null;
  amount_minor: number | null;
  status: PaymentTransactionRow['status'];
  student_id: string;
}

export type AccountStatusTag2 = 'ACTIVE' | 'INACTIVE';
export type ProvisioningStatus =
  | 'PENDING'
  | 'PROVISIONING'
  | 'ACTIVE'
  | 'FAILED'
  | 'DISABLED';

export type PaymentAccountRow = Public['payment_accounts']['Row'] & {
  /** students!inner(...) embedding used by webhook DVA resolution. */
  students?: StudentEmbed | null;
};
export interface PaymentAccountStudentSchool {
  student_id: string;
  school_id: string;
  virtual_account_number: string | null;
}

export type GatewayAssignmentRow = Public['gateway_assignments']['Row'];

// ── Settlement / reconciliation ──────────────────────────────────────────

export type SettlementAccountRow = Public['settlement_accounts']['Row'] & {
  schools?: Pick<Public['schools']['Row'], 'id' | 'name' | 'owner_user_id'> | null;
};

export type SettlementRecordRow = Public['settlement_records']['Row'] & {
  payment_transactions?: { reference?: string | null; student_id?: string | null } | null;
};

export type ReconciliationRunRow = Public['reconciliation_runs']['Row'];

export type ReconciliationIssueRow = Public['reconciliation_issues']['Row'];

// ── KYC ──────────────────────────────────────────────────────────────────

export type KycStatus = NonNullable<KycRecordRow['status']>;

export type KycRecordRow = Public['kyc_records']['Row'] & {
  organizations?: { name?: string | null } | null;
  schools?: Pick<Public['schools']['Row'], 'id' | 'name' | 'organization_id' | 'owner_user_id'> | null;
};

export type KycVerificationRow = Public['kyc_verifications']['Row'];

export type ShareholderRow = Public['school_shareholders']['Row'];

export type PrincipalInvitationRow = Public['principal_invitations']['Row'];

// ── Notifications / audit / migrations ───────────────────────────────────

export type NotificationRow = Public['notifications']['Row'];

export type AuditLogRow = Public['audit_logs']['Row'];

export type LegacyIdentityMigrationRow = Public['legacy_identity_migrations']['Row'];
