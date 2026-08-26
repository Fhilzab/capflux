import Dexie, { Table } from 'dexie';
import type {
  School,
  Profile,
  Guardian,
  Student,
  LedgerEntry,
  Notification,
  SyncQueueItem,
  PaymentGatewayConfig,
  PaymentTransaction,
  PaymentAccount,
  TuitionConfiguration,
  FeeRule,
} from '../types/billing';
import type { GuardianRelationship } from '../shared/guardians/relationshipTypes';
import { runtimeEnvironment } from '../shared/environment/runtimeEnvironment';
import { getSandboxDb } from '../sandbox/sandboxDb';
import { SCHEMA_V3, SCHEMA_V4, SCHEMA_V5 } from './dbSchema';

// ============================================================================
// STUDENTS & ACADEMIC STRUCTURE ROW TYPES (snake_case = Supabase columns)
// ============================================================================

export interface AcademicSessionRow {
  id: string;
  school_id: string;
  name: string;
  start_date?: string | null;
  end_date?: string | null;
  is_current: boolean;
  status: 'UPCOMING' | 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';
  created_at: string;
  updated_at: string;
}

export interface AcademicTermRow {
  id: string;
  session_id: string;
  school_id: string;
  name: string;
  term_number: number;
  display_order: number;
  start_date?: string | null;
  end_date?: string | null;
  is_current: boolean;
  status: 'UPCOMING' | 'ACTIVE' | 'COMPLETED';
  created_at: string;
  updated_at: string;
}

export interface SchoolDivisionRow {
  id: string;
  school_id: string;
  name: string;
  code: string;
  display_order: number;
  description?: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  created_at: string;
  updated_at: string;
}

export interface AcademicLevelRow {
  id: string;
  school_id: string;
  section_id: string;
  name: string;
  code?: string | null;
  display_order: number;
  status: 'ACTIVE' | 'INACTIVE';
  created_at: string;
  updated_at: string;
}

export type EnrollmentStatus = 'ACTIVE' | 'SUPERSEDED' | 'COMPLETED' | 'WITHDRAWN';
export type EnrollmentReason = 'INITIAL' | 'MOVEMENT' | 'PROMOTION' | 'IMPORT' | 'MIGRATION';

export interface StudentEnrollmentRow {
  id: string;
  school_id: string;
  student_id: string;
  academic_session_id: string;
  section_id: string;
  level_id: string;
  status: EnrollmentStatus;
  effective_date: string;
  ended_at?: string | null;
  reason?: EnrollmentReason | null;
  source?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface StudentGuardianRow {
  id: string;
  school_id: string;
  student_id: string;
  guardian_id: string;
  relationship: GuardianRelationship;
  is_primary: boolean;
  created_at: string;
  /** Server-set on upsert; locally set when a link row is mutated offline. */
  updated_at?: string;
}

// Source tracking types for data ownership
export type DataSource = 'LOCAL' | 'SERVER' | 'WEBHOOK';
export type EntitySource = {
  source: DataSource;
  version: number;
  updated_at: string;
};

// Extend Dexie to include our tables
class CapfluxDB extends Dexie {
  schools!: Table<School & EntitySource, string>;
  profiles!: Table<Profile & EntitySource, string>;
  students!: Table<Student & EntitySource, string>;
  guardians!: Table<Guardian & EntitySource, string>;
  ledger_entries!: Table<LedgerEntry & EntitySource, string>;
  notifications!: Table<Notification & EntitySource, string>;
  sync_queue!: Table<SyncQueueItem, string>;
  payment_gateway_config!: Table<PaymentGatewayConfig & EntitySource, string>;
  payment_accounts!: Table<PaymentAccount & EntitySource, string>;
  payment_transactions!: Table<PaymentTransaction & EntitySource, string>;
  tuition_configurations!: Table<TuitionConfiguration & EntitySource, string>;
  fee_rules!: Table<FeeRule & EntitySource, string>;
  settlement_records!: Table<{
    id: string;
    payment_transaction_id: string;
    destination: string;
    account_number: string;
    bank_name: string;
    amount: number;
    settled_at: string;
    source: DataSource;
    version: number;
    updated_at: string;
    raw_response: Record<string, unknown>;
  }, string>;
  academic_sessions!: Table<AcademicSessionRow & EntitySource, string>;
  academic_terms!: Table<AcademicTermRow & EntitySource, string>;
  school_divisions!: Table<SchoolDivisionRow & EntitySource, string>;
  academic_levels!: Table<AcademicLevelRow & EntitySource, string>;
  student_enrollments!: Table<StudentEnrollmentRow & EntitySource, string>;
  student_guardians!: Table<StudentGuardianRow & EntitySource, string>;
  /** Flat key-value settings rows (school settings, sync cursors). */
  app_settings!: Table<Record<string, any> & { school_id: string }, string>;

  /**
   * @param dbName Physical IndexedDB database name. The sandbox execution
   * mode instantiates this schema under a SEPARATE database name
   * ('capflux_sandbox_db') so production cached data is never touched.
   */
  constructor(dbName = 'capflux_local_db') {
    super(dbName);
    this.version(3).stores(SCHEMA_V3);
    // v4: Students & Academic Structure — sessions/terms/divisions/levels
    // cached locally, enrollments + student_guardians offline-first.
    this.version(4).stores(SCHEMA_V4);
    // v5: Students-domain hardening — compound indexes for active-lookup
    // patterns (see ./dbSchema.ts for the per-version notes).
    this.version(5).stores(SCHEMA_V5);
  }
}

/**
 * The single local database handle used by repositories, domain services and
 * stores. In production mode this is the regular offline cache; in sandbox
 * mode the SAME schema is instantiated under an isolated database name so
 * sandbox activity can never read or clobber production data.
 */
const db: CapfluxDB = runtimeEnvironment.isSandbox ? getSandboxDb() : new CapfluxDB();


// ============================================================================
// ENTITY OWNERSHIP CLASSIFICATION
// ============================================================================

// LOCAL OWNED entities - created locally, synced upward
const LOCAL_OWNED_ENTITIES = [
  'students',
  'guardians',
  'tuition_configurations',
  'fee_rules',
  'notifications',
  // Students & Academic Structure (offline-first)
  'academic_sessions',
  'academic_terms',
  'school_divisions',
  'academic_levels',
  'student_enrollments',
  'student_guardians',
] as const;

// CLOUD OWNED entities - created by backend, read-only in browser
const CLOUD_OWNED_ENTITIES = ['payment_transactions', 'settlement_records'] as const;

// HYBRID entities - created locally, confirmed by server
const HYBRID_ENTITIES = ['ledger_entries', 'payment_accounts'] as const;

export const EntityOwnership = {
  isLocalOwned(entityType: string): boolean {
    return LOCAL_OWNED_ENTITIES.includes(entityType as typeof LOCAL_OWNED_ENTITIES[number]);
  },
  isCloudOwned(entityType: string): boolean {
    return CLOUD_OWNED_ENTITIES.includes(entityType as typeof CLOUD_OWNED_ENTITIES[number]);
  },
  isHybrid(entityType: string): boolean {
    return HYBRID_ENTITIES.includes(entityType as typeof HYBRID_ENTITIES[number]);
  },
};

// ============================================================================
// LOCAL REPOSITORY METHODS
// ============================================================================

export const LocalRepository = {
  // Guardian methods (LOCAL OWNED)
  async saveGuardian(guardian: Guardian) {
    const entity: Guardian & EntitySource = {
      ...guardian,
      source: 'LOCAL',
      version: 1,
      updated_at: new Date().toISOString(),
    };
    await db.guardians.put(entity);
    return entity;
  },

  getGuardiansBySchool(school_id: string) {
    return db.guardians.where('school_id').equals(school_id).toArray();
  },

  findGuardianByPhone(school_id: string, phone: string) {
    return db.guardians
      .where('school_id')
      .equals(school_id)
      .and((g) => g.primary_phone === phone)
      .first();
  },

  // Student methods (LOCAL OWNED)
  async saveStudent(student: Student) {
    const entity: Student & EntitySource = {
      ...student,
      source: 'LOCAL',
      version: 1,
      updated_at: new Date().toISOString(),
    };
    await db.students.put(entity);
    return entity;
  },

  getStudentsBySchool(school_id: string) {
    return db.students.where('school_id').equals(school_id).toArray();
  },

  getStudentById(id: string) {
    return db.students.get(id);
  },

  searchStudentsBySchool(school_id: string, query: string) {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return this.getStudentsBySchool(school_id);
    }

    return db.students
      .where('school_id')
      .equals(school_id)
      .filter((student) => {
        const name = `${student.first_name} ${student.last_name}`.toLowerCase();
        return name.includes(normalized) || student.class_name.toLowerCase().includes(normalized);
      })
      .toArray();
  },

  // Ledger methods (HYBRID - but CREDIT entries are read-only)
  saveLedgerEntry(entry: LedgerEntry & Partial<EntitySource>) {
    const entity = {
      ...entry,
      source: entry.source || 'LOCAL',
      version: entry.version || 1,
      updated_at: entry.updated_at || new Date().toISOString(),
    };
    return db.ledger_entries.put(entity);
  },

  // Only DEBIT entries can be created locally
  createDebitLedgerEntry(entry: LedgerEntry) {
    if (entry.entry_type !== 'DEBIT') {
      throw new Error('Only DEBIT entries can be created locally');
    }
    return this.saveLedgerEntry(entry);
  },

  getLedgerEntriesByStudent(student_id: string) {
    return db.ledger_entries.where('student_id').equals(student_id).toArray();
  },

  getLedgerEntriesBySchool(school_id: string) {
    return db.ledger_entries.where('school_id').equals(school_id).toArray();
  },

  // Notification methods (HYBRID)
  async saveNotification(notification: Notification) {
    const entity: Notification & EntitySource = {
      ...notification,
      source: notification.delivery_status === 'PENDING' ? 'LOCAL' : 'SERVER',
      version: 1,
      updated_at: new Date().toISOString(),
    };
    await db.notifications.put(entity);
    return entity;
  },

  getNotificationsByStudent(student_id: string) {
    return db.notifications.where('student_id').equals(student_id).toArray();
  },

  getNotificationsByGuardian(guardian_id: string) {
    return db.notifications.where('guardian_id').equals(guardian_id).toArray();
  },

  // Profile methods (LOCAL OWNED)
  saveProfile(profile: Profile) {
    const entity: Profile & EntitySource = {
      ...profile,
      source: 'LOCAL',
      version: 1,
      updated_at: new Date().toISOString(),
    };
    return db.profiles.put(entity);
  },

  // Payment account methods (HYBRID)
  async savePaymentAccount(account: PaymentAccount & Partial<EntitySource>) {
    const entity = {
      ...account,
      source: account.source || 'LOCAL',
      version: account.version || 1,
      updated_at: account.updated_at || new Date().toISOString(),
    };
    await db.payment_accounts.put(entity);
    return entity;
  },

  // Payment accounts are created via gateway API, so this is for updates only
  getPaymentAccountByStudent(student_id: string) {
    return db.payment_accounts.where('student_id').equals(student_id).first();
  },

  getPaymentAccountsBySchool(school_id: string) {
    return db.payment_accounts.where('school_id').equals(school_id).toArray();
  },

  // Tuition configuration methods (LOCAL OWNED)
  async saveTuitionConfiguration(config: TuitionConfiguration) {
    const entity: TuitionConfiguration & EntitySource = {
      ...config,
      source: 'LOCAL',
      version: 1,
      updated_at: new Date().toISOString(),
    };
    await db.tuition_configurations.put(entity);
    return entity;
  },

  getTuitionConfiguration(school_id: string, academic_session: string, academic_term: string, category: string) {
    return db.tuition_configurations
      .where('school_id')
      .equals(school_id)
      .and((c) => 
        c.academic_session === academic_session && 
        c.academic_term === academic_term && 
        c.category === category
      )
      .first();
  },

  getTuitionConfigurationsBySchool(school_id: string) {
    return db.tuition_configurations.where('school_id').equals(school_id).toArray();
  },

  // Fee rules methods (LOCAL OWNED)
  async saveFeeRule(rule: FeeRule) {
    const entity: FeeRule & EntitySource = {
      ...rule,
      source: 'LOCAL',
      version: 1,
      updated_at: new Date().toISOString(),
    };
    await db.fee_rules.put(entity);
    return entity;
  },

  getActiveFeeRule(school_id: string) {
    return db.fee_rules
      .where('school_id')
      .equals(school_id)
      .and((r) => r.is_active)
      .first();
  },

  getFeeRulesBySchool(school_id: string) {
    return db.fee_rules.where('school_id').equals(school_id).toArray();
  },

  // Academic structure methods (LOCAL OWNED, cached from server or created locally)
  async saveAcademicSession(session: AcademicSessionRow) {
    const entity: AcademicSessionRow & EntitySource = { ...session, source: 'LOCAL', version: 1, updated_at: new Date().toISOString() };
    await db.academic_sessions.put(entity);
    return entity;
  },

  getAcademicSessionsBySchool(school_id: string) {
    return db.academic_sessions.where('school_id').equals(school_id).toArray();
  },

  async saveAcademicTerm(term: AcademicTermRow) {
    const entity: AcademicTermRow & EntitySource = { ...term, source: 'LOCAL', version: 1, updated_at: new Date().toISOString() };
    await db.academic_terms.put(entity);
    return entity;
  },

  getAcademicTermsBySession(session_id: string) {
    return db.academic_terms.where('session_id').equals(session_id).toArray();
  },

  async saveSchoolDivision(division: SchoolDivisionRow) {
    const entity: SchoolDivisionRow & EntitySource = { ...division, source: 'LOCAL', version: 1, updated_at: new Date().toISOString() };
    await db.school_divisions.put(entity);
    return entity;
  },

  getSchoolDivisionsBySchool(school_id: string) {
    return db.school_divisions.where('school_id').equals(school_id).toArray();
  },

  async saveAcademicLevel(level: AcademicLevelRow) {
    const entity: AcademicLevelRow & EntitySource = { ...level, source: 'LOCAL', version: 1, updated_at: new Date().toISOString() };
    await db.academic_levels.put(entity);
    return entity;
  },

  getAcademicLevelsBySection(section_id: string) {
    return db.academic_levels.where('section_id').equals(section_id).toArray();
  },

  getAcademicLevelsBySchool(school_id: string) {
    return db.academic_levels.where('school_id').equals(school_id).toArray();
  },

  // Enrollment methods (LOCAL OWNED - immutable history rows)
  async saveStudentEnrollment(enrollment: StudentEnrollmentRow) {
    const entity: StudentEnrollmentRow & EntitySource = { ...enrollment, source: 'LOCAL', version: 1, updated_at: new Date().toISOString() };
    await db.student_enrollments.put(entity);
    return entity;
  },

  getEnrollmentsByStudent(student_id: string) {
    return db.student_enrollments.where('student_id').equals(student_id).toArray();
  },

  getEnrollmentsBySchool(school_id: string) {
    return db.student_enrollments.where('school_id').equals(school_id).toArray();
  },

  getActiveEnrollmentForStudent(student_id: string, academic_session_id?: string) {
    return db.student_enrollments
      .where('student_id')
      .equals(student_id)
      .and((e) =>
        e.status === 'ACTIVE' &&
        (!academic_session_id || e.academic_session_id === academic_session_id)
      )
      .last();
  },

  /** Active enrollment via the [student_id+status] compound index (v5). */
  getActiveEnrollmentIndexed(student_id: string) {
    return db.student_enrollments
      .where('[student_id+status]')
      .equals([student_id, 'ACTIVE'])
      .last();
  },

  /** Active roster for a level via the [level_id+status] compound index (v5). */
  getActiveEnrollmentsForLevel(level_id: string) {
    return db.student_enrollments
      .where('[level_id+status]')
      .equals([level_id, 'ACTIVE'])
      .toArray();
  },

  // Student-guardian link methods (LOCAL OWNED)
  async saveStudentGuardian(link: StudentGuardianRow) {
    const entity: StudentGuardianRow & EntitySource = { ...link, source: 'LOCAL', version: 1, updated_at: new Date().toISOString() };
    await db.student_guardians.put(entity);
    return entity;
  },

  deleteStudentGuardian(id: string) {
    return db.student_guardians.delete(id);
  },

  getGuardianLinksForStudent(student_id: string) {
    return db.student_guardians.where('student_id').equals(student_id).toArray();
  },

  getStudentsForGuardian(guardian_id: string) {
    return db.student_guardians.where('guardian_id').equals(guardian_id).toArray();
  },

  // Sync queue methods
  enqueueSyncItem(item: Partial<SyncQueueItem> & { 
    school_id: string; 
    entity_type: string; 
    entity_id: string; 
    payload: Record<string, unknown> 
  }) {
    const fullItem: SyncQueueItem = {
      id: item.id ?? `sync-${item.entity_type}-${item.entity_id}-${Date.now()}`,
      school_id: item.school_id,
      entity_type: item.entity_type,
      entity_id: item.entity_id,
      operation: item.operation ?? 'UPSERT',
      payload: item.payload,
      status: item.status ?? 'PENDING',
      retry_count: item.retry_count ?? 0,
      created_at: item.created_at ?? new Date().toISOString(),
      processed_at: item.processed_at ?? undefined,
      error_message: item.error_message ?? undefined,
    };
    return db.sync_queue.add(fullItem);
  },

  getPendingSyncItems() {
    return db.sync_queue.where('status').equals('PENDING').toArray();
  },

  getFailedSyncItems() {
    return db.sync_queue.where('status').equals('FAILED').toArray();
  },

  getSyncItemById(id: string) {
    return db.sync_queue.get(id);
  },

  updateSyncItem(id: string, updates: Partial<SyncQueueItem>) {
    return db.sync_queue.update(id, updates);
  },

  updateSyncItemStatus(id: string, status: string) {
    return this.updateSyncItem(id, { status });
  },

  deleteSyncItem(id: string) {
    return db.sync_queue.delete(id);
  },

  // Download methods for CLOUD OWNED entities
  savePaymentTransaction(transaction: PaymentTransaction & EntitySource) {
    return db.payment_transactions.put(transaction);
  },

  getPaymentTransactionByReference(reference: string) {
    return db.payment_transactions.where('reference').equals(reference).first();
  },

  getPaymentTransactionsByStudent(student_id: string) {
    return db.payment_transactions.where('student_id').equals(student_id).toArray();
  },

  saveSettlementRecord(record: {
    id: string;
    payment_transaction_id: string;
    destination: string;
    account_number: string;
    bank_name: string;
    amount: number;
    settled_at: string;
    source: DataSource;
    version: number;
    updated_at: string;
    raw_response: Record<string, unknown>;
  }) {
    return db.settlement_records.put(record);
  },

  // Clear read-only entities for refresh
  async clearFinancialData(school_id?: string) {
    await db.payment_transactions.clear();
    await db.settlement_records.clear();
  },

  // Sync queue helper methods needed by syncQueue.ts
  markItemCompleted(id: string) {
    return this.updateSyncItem(id, { status: 'SYNCED', processed_at: new Date().toISOString() });
  },

  markItemFailed(id: string, message: string) {
    return this.updateSyncItem(id, { status: 'FAILED', error_message: message, processed_at: new Date().toISOString() });
  },
};

export { db };
export default db;
