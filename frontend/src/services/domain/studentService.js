import { v4 as uuidv4 } from 'uuid';
import { LocalRepository } from '../repository/localRepository';

export const StudentService = {
  async saveStudent(student) {
    const timestamp = new Date().toISOString();
    const record = {
      id: student.id ?? uuidv4(),
      school_id: student.school_id,
      first_name: student.first_name,
      last_name: student.last_name,
      class_name: student.class_name,
      guardian_phone: student.guardian_phone,
      dva_account_number: student.dva_account_number ?? null,
      dva_bank_name: student.dva_bank_name ?? null,
      status: student.status ?? 'ACTIVE',
      client_sequence: student.client_sequence ?? 0,
      device_id: student.device_id ?? 'unknown',
      created_at: student.created_at ?? timestamp,
      updated_at: timestamp,
    };

    await LocalRepository.saveStudent(record);

    await LocalRepository.enqueueSyncItem({
      id: uuidv4(),
      school_id: record.school_id,
      entity_type: 'students',
      entity_id: record.id,
      operation: 'UPSERT',
      payload: record,
      status: 'PENDING',
      created_at: timestamp,
    });

    return record;
  },

  async getStudentsBySchool(school_id) {
    return LocalRepository.getStudentsBySchool(school_id);
  },
};
