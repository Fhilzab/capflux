import Dexie from 'dexie';

const db = new Dexie('capstone_local_db');

db.version(1).stores({
  schools: 'id, school_id, subscription_status, created_at',
  profiles: 'id, school_id, full_name, role, created_at',
  students: 'id, school_id, first_name, last_name, class_name, guardian_phone, status, client_sequence, device_id, created_at, updated_at',
  ledger_entries: 'id, school_id, student_id, amount, entry_type, entry_category, reference_id, metadata, client_sequence, device_id, created_at',
  notifications: 'id, school_id, student_id, recipient_phone, message_body, delivery_status, client_sequence, device_id, created_at',
  audit_logs: 'id, school_id, actor_id, entity, entity_id, created_at',
  sync_queue: 'id, school_id, entity_type, entity_id, status, retry_count, created_at, processed_at, error_message, payload',
  app_settings: 'school_id',
});

export const LocalRepository = {
  saveStudent(student: Record<string, any>) {
    return db.students.put(student);
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

  saveLedgerEntry(entry: Record<string, any>) {
    return db.ledger_entries.put(entry);
  },

  getLedgerEntriesByStudent(student_id: string) {
    return db.ledger_entries.where('student_id').equals(student_id).toArray();
  },

  getLedgerEntriesBySchool(school_id: string) {
    return db.ledger_entries.where('school_id').equals(school_id).toArray();
  },

  saveNotification(notification: Record<string, any>) {
    return db.notifications.put(notification);
  },

  getNotificationsByStudent(student_id: string) {
    return db.notifications.where('student_id').equals(student_id).toArray();
  },

  saveProfile(profile: Record<string, any>) {
    return db.profiles.put(profile);
  },

  enqueueSyncItem(item: Record<string, any>) {
    return db.sync_queue.add({
      ...item,
      status: item.status ?? 'PENDING',
      retry_count: item.retry_count ?? 0,
      processed_at: item.processed_at ?? null,
      error_message: item.error_message ?? null,
      created_at: item.created_at ?? new Date().toISOString(),
      payload: item.payload ?? {},
    });
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

  updateSyncItem(id: string, updates: Record<string, any>) {
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
