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

// Extend Dexie to include our tables
class CapstoneDB extends Dexie {
  schools!: Table<School, string>;
  profiles!: Table<Profile, string>;
  students!: Table<Student, string>;
  guardians!: Table<Guardian, string>;
  ledger_entries!: Table<LedgerEntry, string>;
  notifications!: Table<Notification, string>;
  sync_queue!: Table<SyncQueueItem, string>;
  payment_gateway_config!: Table<PaymentGatewayConfig, string>;
  payment_accounts!: Table<PaymentAccount, string>;
  payment_transactions!: Table<PaymentTransaction, string>;
  tuition_configurations!: Table<TuitionConfiguration, string>;
  fee_rules!: Table<FeeRule, string>;

  constructor() {
    super('capstone_local_db');
    this.version(2).stores({
      schools: 'id, school_id, subscription_status, created_at',
      profiles: 'id, school_id, full_name, role, created_at',
      students: 'id, school_id, first_name, last_name, class_name, category, guardian_id, status, client_sequence, device_id, created_at, updated_at',
      guardians: 'id, school_id, full_name, primary_phone, secondary_phone, email, relationship, created_at, updated_at',
      ledger_entries: 'id, school_id, student_id, amount, entry_type, entry_category, reference_id, metadata, client_sequence, device_id, created_at',
      notifications: 'id, school_id, student_id, guardian_id, recipient_phone, message_body, delivery_status, client_sequence, device_id, created_at',
      audit_logs: 'id, school_id, actor_id, entity, entity_id, created_at',
      sync_queue: 'id, school_id, entity_type, entity_id, status, retry_count, created_at, processed_at, error_message, payload',
      app_settings: 'school_id',
      // Payment gateway tables for offline-first sync
      payment_gateway_config: 'id, school_id, provider, api_key, secret_key, submerchant_code, settlement_account_number, settlement_account_bank, is_active, created_at',
      payment_accounts: 'id, school_id, student_id, provider, provider_account_id, provider_reference, virtual_account_number, account_name, bank_name, account_status, is_primary, created_at',
      payment_transactions: 'id, school_id, student_id, gateway_txn_ref, reference, amount, settlement_status, verified_at',
      settlement_records: 'id, payment_transaction_id, destination, account_number, bank_name, amount, settled_at',
      // Tuition and fee configuration tables
      tuition_configurations: 'id, school_id, academic_session, academic_term, category, tuition_amount, created_at',
      fee_rules: 'id, school_id, is_active, effective_date, created_at',
    });
  }
}

const db = new CapstoneDB();

export const LocalRepository = {
  // Guardian methods
  async saveGuardian(guardian: Guardian) {
    await db.guardians.put(guardian);
    return guardian;
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

  // Student methods
  async saveStudent(student: Student) {
    await db.students.put(student);
    return student;
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

  // Ledger methods
  saveLedgerEntry(entry: LedgerEntry) {
    return db.ledger_entries.put(entry);
  },

  getLedgerEntriesByStudent(student_id: string) {
    return db.ledger_entries.where('student_id').equals(student_id).toArray();
  },

  getLedgerEntriesBySchool(school_id: string) {
    return db.ledger_entries.where('school_id').equals(school_id).toArray();
  },

  // Notification methods
  async saveNotification(notification: Notification) {
    await db.notifications.put(notification);
    return notification;
  },

  getNotificationsByStudent(student_id: string) {
    return db.notifications.where('student_id').equals(student_id).toArray();
  },

  getNotificationsByGuardian(guardian_id: string) {
    return db.notifications.where('guardian_id').equals(guardian_id).toArray();
  },

  // Profile methods
  saveProfile(profile: Profile) {
    return db.profiles.put(profile);
  },

  // Payment account (DVA) methods
  async savePaymentAccount(account: PaymentAccount) {
    await db.payment_accounts.put(account);
    return account;
  },

  getPaymentAccountByStudent(student_id: string) {
    return db.payment_accounts.where('student_id').equals(student_id).first();
  },

  getPaymentAccountsBySchool(school_id: string) {
    return db.payment_accounts.where('school_id').equals(school_id).toArray();
  },

  // Tuition configuration methods
  async saveTuitionConfiguration(config: TuitionConfiguration) {
    await db.tuition_configurations.put(config);
    return config;
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

  // Fee rules methods
  async saveFeeRule(rule: FeeRule) {
    await db.fee_rules.put(rule);
    return rule;
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
};

export default db;