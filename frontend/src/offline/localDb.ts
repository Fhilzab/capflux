import Dexie, { Table } from 'dexie';

// Define interfaces for TypeScript
interface School {
  id: string;
  school_id?: string;
  subscription_status: string;
  created_at: string;
}

interface Profile {
  id: string;
  school_id: string;
  full_name: string;
  role: string;
  created_at: string;
}

interface Student {
  id: string;
  school_id: string;
  first_name: string;
  last_name: string;
  class_name: string;
  guardian_phone: string;
  status: string;
  client_sequence: number;
  device_id: string;
  created_at: string;
  updated_at: string;
  dva_account_number?: string;
  dva_bank_name?: string;
}

interface LedgerEntry {
  id: string;
  school_id: string;
  student_id: string;
  amount: number;
  entry_type: string;
  entry_category: string;
  reference_id?: string;
  metadata: Record<string, any>;
  client_sequence: number;
  device_id: string;
  created_at: string;
}

interface Notification {
  id: string;
  school_id: string;
  student_id: string;
  recipient_phone: string;
  message_body: string;
  delivery_status: string;
  client_sequence: number;
  device_id: string;
  created_at: string;
}

interface SyncQueueItem {
  id: string;
  school_id: string;
  entity_type: string;
  entity_id: string;
  operation: string;
  payload: Record<string, any>;
  status: string;
  retry_count: number;
  created_at: string;
  processed_at?: string;
  error_message?: string;
}

interface PaymentGatewayConfig {
  id: string;
  school_id: string;
  provider: string;
  api_key: string;
  secret_key: string;
  submerchant_code?: string;
  settlement_account_number: string;
  settlement_account_bank: string;
  is_active: boolean;
  created_at: string;
}

interface DVAAssignment {
  id: string;
  school_id: string;
  student_id: string;
  provider: string;
  dva_account_number: string;
  dva_bank_name: string;
  dva_account_name: string;
  is_active: boolean;
  created_at: string;
}

interface PaymentTransaction {
  id: string;
  school_id: string;
  student_id: string;
  gateway_txn_ref: string;
  reference: string;
  amount: number;
  settlement_status: string;
  verified_at: string;
}

// Extend Dexie to include our tables
class CapstoneDB extends Dexie {
  schools!: Table<School, string>;
  profiles!: Table<Profile, string>;
  students!: Table<Student, string>;
  ledger_entries!: Table<LedgerEntry, string>;
  notifications!: Table<Notification, string>;
  sync_queue!: Table<SyncQueueItem, string>;
  payment_gateway_config!: Table<PaymentGatewayConfig, string>;
  dva_assignments!: Table<DVAAssignment, string>;
  payment_transactions!: Table<PaymentTransaction, string>;

  constructor() {
    super('capstone_local_db');
    this.version(1).stores({
      schools: 'id, school_id, subscription_status, created_at',
      profiles: 'id, school_id, full_name, role, created_at',
      students: 'id, school_id, first_name, last_name, class_name, guardian_phone, status, client_sequence, device_id, created_at, updated_at',
      ledger_entries: 'id, school_id, student_id, amount, entry_type, entry_category, reference_id, metadata, client_sequence, device_id, created_at',
      notifications: 'id, school_id, student_id, recipient_phone, message_body, delivery_status, client_sequence, device_id, created_at',
      audit_logs: 'id, school_id, actor_id, entity, entity_id, created_at',
      sync_queue: 'id, school_id, entity_type, entity_id, status, retry_count, created_at, processed_at, error_message, payload',
      app_settings: 'school_id',
      // Payment gateway tables for offline-first sync
      payment_gateway_config: 'id, school_id, provider, api_key, secret_key, submerchant_code, settlement_account_number, settlement_account_bank, is_active, created_at',
      dva_assignments: 'id, school_id, student_id, provider, dva_account_number, dva_bank_name, dva_account_name, is_active, created_at',
      payment_transactions: 'id, school_id, student_id, gateway_txn_ref, reference, amount, settlement_status, verified_at',
      settlement_records: 'id, payment_transaction_id, destination, account_number, bank_name, amount, settled_at',
    });
  }
}

const db = new CapstoneDB();

export const LocalRepository = {
  saveStudent(student: Partial<Student>) {
    return db.students.put(student as Student);
  },

  getStudentsBySchool(school_id: string) {
    return db.students.where('school_id').equals(school_id).toArray();
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

  saveLedgerEntry(entry: Partial<LedgerEntry>) {
    return db.ledger_entries.put(entry as LedgerEntry);
  },

  getLedgerEntriesByStudent(student_id: string) {
    return db.ledger_entries.where('student_id').equals(student_id).toArray();
  },

  getLedgerEntriesBySchool(school_id: string) {
    return db.ledger_entries.where('school_id').equals(school_id).toArray();
  },

  saveNotification(notification: Partial<Notification>) {
    return db.notifications.put(notification as Notification);
  },

  getNotificationsByStudent(student_id: string) {
    return db.notifications.where('student_id').equals(student_id).toArray();
  },

  saveProfile(profile: Partial<Profile>) {
    return db.profiles.put(profile as Profile);
  },

  enqueueSyncItem(item: Partial<SyncQueueItem>) {
    return db.sync_queue.add({
      ...item,
      operation: item.operation ?? 'UPSERT',
      status: item.status ?? 'PENDING',
      retry_count: item.retry_count ?? 0,
      processed_at: item.processed_at ?? null,
      error_message: item.error_message ?? null,
      created_at: item.created_at ?? new Date().toISOString(),
      payload: item.payload ?? {},
    } as SyncQueueItem);
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
