import db from '../../db/localDb';

export const LocalRepository = {
  async saveStudent(student) {
    return db.students.put(student);
  },

  async getStudentsBySchool(school_id) {
    return db.students.where('school_id').equals(school_id).toArray();
  },

  async saveLedgerEntry(entry) {
    return db.ledger_entries.put(entry);
  },

  async enqueueSyncItem(item) {
    return db.sync_queue.add(item);
  },
};
