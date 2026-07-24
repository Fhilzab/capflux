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

  constructor() {
    super('capflux_local_db');
    this.version(3).stores({
      schools: 'id, school_id, subscription_status, created_at, source, version, updated_at',
      profiles: 'id, school_id, full_name, role, created_at, source, version, updated_at',
      students: 'id, school_id, first_name, last_name, class_name, category, guardian_id, status, client_sequence, device_id, created_at, updated_at, source, version',
      guardians: 'id, school_id, full_name, primary_phone, secondary_phone, email, relationship, created_at, updated_at, source, version',
      ledger_entries: 'id, school_id, student_id, amount, entry_type, entry_category, reference_id, metadata, client_sequence, device_id, created_at, source, version',
      notifications: 'id, school_id, student_id, guardian_id, recipient_phone, message_body, delivery_status, client_sequence, device_id, created_at, source, version',
      audit_logs: 'id, school_id, actor_id, entity, entity_id, created_at',
      sync_queue: 'id, school_id, entity_type, entity_id, status, retry_count, created_at, processed_at, error_message, payload',
      app_settings: 'school_id, source, version, updated_at',
      // Payment gateway tables for offline-first sync
      payment_gateway_config: 'id, school_id, provider, api_key, secret_key, submerchant_code, settlement_account_number, settlement_account_bank, is_active, created_at, source, version, updated_at',
      payment_accounts: 'id, school_id, student_id, provider, provider_account_id, provider_reference, virtual_account_number, account_name, bank_name, account_status, is_primary, created_at, source, version, updated_at',
      payment_transactions: 'id, school_id, student_id, gateway_txn_ref, reference, amount, settlement_status, verified_at, source, version, updated_at',
      settlement_records: 'id, payment_transaction_id, destination, account_number, bank_name, amount, settled_at, source, version, updated_at',
      // Tuition and fee configuration tables
      tuition_configurations: 'id, school_id, academic_session, academic_term, category, tuition_amount, created_at, source, version, updated_at',
      fee_rules: 'id, school_id, is_active, effective_date, created_at, source, version, updated_at',
    });
  }
}

const db = new CapfluxDB();

// ============================================================================
// ENTITY OWNERSHIP CLASSIFICATION
// ============================================================================

// LOCAL OWNED entities - created locally, synced upward
const LOCAL_OWNED_ENTITIES = ['students', 'guardians', 'tuition_configurations', 'fee_rules', 'notifications'] as const;

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

export default db;
