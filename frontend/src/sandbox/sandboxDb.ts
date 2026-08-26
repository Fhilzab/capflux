/**
 * CAPFLUX Sandbox database — an ISOLATED IndexedDB instance.
 *
 * The sandbox execution mode instantiates the exact same table schema as the
 * production offline cache (see ../offline/dbSchema.ts) under a separate
 * physical database name ('capflux_sandbox_db'), plus a set of sandbox-only
 * tables that back the in-browser API simulator (KYC records, settlement
 * accounts, gateway assignments, reconciliation runs, audit trail…).
 *
 * Isolation invariants:
 *  - Production code paths NEVER open this database (guarded below).
 *  - Resetting the sandbox deletes THIS database only; production caches,
 *    sessions and any remote data are unreachable from sandbox mode.
 *  - No table here is ever uploaded to Supabase: sandbox sync replays the
 *    outbox against the in-browser SandboxApiServer instead.
 */
import Dexie, { type Table } from 'dexie';
import {
  SCHEMA_V3,
  SCHEMA_V4,
  SCHEMA_V5,
  SANDBOX_EXTRA_SCHEMA,
} from '../offline/dbSchema';
import { runtimeEnvironment } from '../shared/environment/runtimeEnvironment';
import { assertSandboxMode } from './runtime/sandboxGuard';

// ---------------------------------------------------------------------------
// Sandbox-only row types (snake_case to mirror Postgres columns like the
// shared rows in offline/localDb.ts).
// ---------------------------------------------------------------------------

export type KycRecordStatus = 'NOT_STARTED' | 'UNDER_REVIEW' | 'VERIFIED' | 'REJECTED';

export interface KycRecordRow {
  id: string;
  school_id: string;
  status: KycRecordStatus;
  principal_name?: string | null;
  principal_phone?: string | null;
  official_email?: string | null;
  official_phone?: string | null;
  cac_registration_number?: string | null;
  /** Encrypted-at-rest in production; sandbox stores a non-reversible marker. */
  bvn_encrypted?: string | null;
  nin_encrypted?: string | null;
  bvn_last4?: string | null;
  nin_last4?: string | null;
  identity_match_states?: Record<string, string>;
  overall_match_state?: string;
  rejection_reason?: string | null;
  business_type?: string | null;
  submitted_at?: string | null;
  reviewed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SettlementAccountRow {
  id: string;
  school_id: string;
  status: 'PENDING_VERIFICATION' | 'VERIFIED' | 'REJECTED';
  bank_code: string;
  bank_name: string;
  account_number_sandbox: string;
  account_number_last4: string;
  account_name: string;
  bvn_last4?: string | null;
  ownership_match_state?: string;
  rejection_reason?: string | null;
  created_at: string;
  updated_at: string;
}

export interface GatewayAssignmentRow {
  id: string;
  school_id: string;
  provider: 'sandbox';
  status: 'ASSIGNED' | 'ACTIVE' | 'SUSPENDED';
  assigned_at: string;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReconciliationRunRow {
  id: string;
  school_id: string;
  status: 'COMPLETED' | 'FAILED';
  provider: string;
  transactions_checked: number;
  matches_found: number;
  mismatches_found: number;
  run_at: string;
  created_at: string;
}

export interface ReconciliationIssueRow {
  id: string;
  school_id: string;
  run_id: string;
  reference: string;
  issue_type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  detail: string;
  status: 'OPEN' | 'RESOLVED';
  resolution_note?: string | null;
  created_at: string;
  resolved_at?: string | null;
}

export interface ShareholderRow {
  id: string;
  school_id: string;
  full_name: string;
  ownership_percentage: number;
  role?: string | null;
  phone?: string | null;
  identity_nin_last4?: string | null;
  created_at: string;
}

export interface PrincipalInvitationRow {
  id: string;
  school_id: string;
  email: string;
  name: string;
  role: string;
  status: 'SENT' | 'ACCEPTED' | 'EXPIRED';
  token: string;
  expires_at: string;
  accepted: boolean;
  created_at: string;
}

export interface OnboardingProgressRow {
  school_id: string;
  profile_completed: boolean;
  organization_completed: boolean;
  school_completed: boolean;
  owner_completed: boolean;
  completed_at?: string | null;
  activated_at?: string | null;
  updated_at: string;
}

/** Append-only audit trail written by the sandbox API simulator. */
export interface AuditTrailRow {
  id: string;
  school_id: string | null;
  actor_id: string;
  actor_role: string;
  action: string;
  entity: string;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  occurred_at: string;
}

export interface SandboxMetaRow {
  key: string;
  value: unknown;
  updated_at: string;
}

/**
 * Document blobs never leave the browser in sandbox mode; we keep metadata
 * plus a truncated content marker so the documents UI has realistic data.
 */
export interface KycDocumentRow {
  id: string;
  school_id: string;
  kind: 'CAC' | 'IDENTITY';
  filename: string;
  mime_type: string;
  file_size: number;
  checksum: string;
  storage_path: string;
  status: 'UPLOADED';
  uploaded_at: string;
}

export class SandboxCapfluxDB extends Dexie {
  // Same tables as production (identical schema versions)…
  declare schools: Table<Record<string, unknown> & { id: string }, string>;
  declare students: Table<Record<string, unknown> & { id: string }, string>;
  declare guardians: Table<Record<string, unknown> & { id: string }, string>;
  declare student_guardians: Table<Record<string, unknown> & { id: string }, string>;
  declare student_enrollments: Table<Record<string, unknown> & { id: string }, string>;
  declare academic_sessions: Table<Record<string, unknown> & { id: string }, string>;
  declare academic_terms: Table<Record<string, unknown> & { id: string }, string>;
  declare school_divisions: Table<Record<string, unknown> & { id: string }, string>;
  declare academic_levels: Table<Record<string, unknown> & { id: string }, string>;
  declare ledger_entries: Table<Record<string, unknown> & { id: string }, string>;
  declare notifications: Table<Record<string, unknown> & { id: string }, string>;
  declare payment_accounts: Table<Record<string, unknown> & { id: string }, string>;
  declare payment_transactions: Table<Record<string, unknown> & { id: string }, string>;
  declare settlement_records: Table<Record<string, unknown> & { id: string }, string>;
  declare fee_rules: Table<Record<string, unknown> & { id: string }, string>;
  declare tuition_configurations: Table<Record<string, unknown> & { id: string }, string>;
  declare profiles: Table<Record<string, unknown> & { id: string }, string>;
  declare organizations: Table<Record<string, unknown> & { id: string }, string>;
  declare sync_queue: Table<Record<string, unknown> & { id: string }, string>;
  declare app_settings: Table<Record<string, unknown> & { school_id: string }, string>;

  // …plus sandbox-only tables backing the in-browser backend simulator.
  declare fees: Table<Record<string, unknown> & { id: string }, string>;
  declare kyc_records: Table<KycRecordRow, string>;
  declare kyc_documents: Table<KycDocumentRow, string>;
  declare settlement_accounts: Table<SettlementAccountRow, string>;
  declare gateway_assignments: Table<GatewayAssignmentRow, string>;
  declare reconciliation_runs: Table<ReconciliationRunRow, string>;
  declare reconciliation_issues: Table<ReconciliationIssueRow, string>;
  declare school_shareholders: Table<ShareholderRow, string>;
  declare principal_invitations: Table<PrincipalInvitationRow, string>;
  declare onboarding_progress: Table<OnboardingProgressRow, string>;
  declare audit_trail: Table<AuditTrailRow, string>;
  declare sandbox_meta: Table<SandboxMetaRow, string>;

  constructor() {
    super('capflux_sandbox_db');
    this.version(3).stores(SCHEMA_V3);
    this.version(4).stores(SCHEMA_V4);
    this.version(5).stores(SCHEMA_V5);
    // Sandbox-only surface. Version numbering intentionally far ahead of the
    // production chain so both schemas can evolve independently.
    this.version(100).stores({
      ...SANDBOX_EXTRA_SCHEMA,
      kyc_documents: 'id, school_id, kind, status, uploaded_at',
    });
  }
}

let instance: SandboxCapfluxDB | null = null;

/** Get (and lazily create) THE sandbox database. Fails closed outside sandbox mode. */
export function getSandboxDb(): SandboxCapfluxDB {
  assertSandboxMode(runtimeEnvironment.isSandbox, 'SandboxCapfluxDB');
  if (!instance) instance = new SandboxCapfluxDB();
  return instance;
}

/** Test seam: replace the singleton (used by unit tests with fake handles). */
export function __setSandboxDbForTest(db: SandboxCapfluxDB | null): void {
  instance = db;
}

/** Wipe every sandbox table (used by Reset Sandbox). Never touches other databases. */
export async function deleteSandboxDatabase(): Promise<void> {
  if (instance) {
    instance.close();
    instance = null;
  }
  await Dexie.delete('capflux_sandbox_db');
}
