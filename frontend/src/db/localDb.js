import Dexie from 'dexie';

const db = new Dexie('capstone_local_db');

db.version(1).stores({
  schools: 'id, school_id, subscription_status, created_at',
  profiles: 'id, school_id, full_name, role, created_at',
  students: 'id, school_id, first_name, last_name, class_name, guardian_phone, status, client_sequence, device_id, created_at, updated_at',
  ledger_entries: 'id, school_id, student_id, entry_type, entry_category, client_sequence, device_id, created_at',
  notifications: 'id, school_id, student_id, recipient_phone, delivery_status, client_sequence, device_id, created_at',
  audit_logs: 'id, school_id, actor_id, entity, entity_id, created_at',
  sync_queue: 'id, school_id, entity_type, entity_id, status, created_at',
  app_settings: 'school_id',
});

export default db;
