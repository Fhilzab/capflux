export const PERMISSIONS = {
  STUDENT: {
    VIEW: 'student.view',
    CREATE: 'student.create',
    UPDATE: 'student.update',
    DELETE: 'student.delete',
  },

  BILLING: {
    VIEW: 'billing.view',
    CREATE: 'billing.create',
    EDIT: 'billing.edit',
    LOCK: 'billing.lock',
  },

  PAYMENT: {
    VIEW: 'payment.view',
    RECEIVE: 'payment.receive',
    REFUND: 'payment.refund',
    RECONCILE: 'payment.reconcile',
    RECORD: 'payment.record',
  },

  LEDGER: {
    VIEW: 'ledger.view',
  },

  REPORT: {
    VIEW: 'report.view',
    EXPORT: 'report.export',
  },

  AUDIT: {
    VIEW: 'audit.view',
  },

  NOTIFICATION: {
    SEND: 'notification.send',
    VIEW: 'notification.view',
  },

  USER: {
    MANAGE: 'user.manage',
  },

  ROLE: {
    MANAGE: 'role.manage',
  },

  SCHOOL: {
    MANAGE: 'school.manage',
    SETTINGS: {
      UPDATE: 'school.settings.update',
    },
  },

  ORGANIZATION: {
    MANAGE: 'organization.manage',
  },

  SETTINGS: {
    MANAGE: 'settings.manage',
  },

  PLATFORM: {
    LEVY: {
      VIEW: 'platform.levy.view',
      MANAGE: 'platform.levy.manage',
    },
  },
} as const;

export type PermissionCode =
  | typeof PERMISSIONS[keyof typeof PERMISSIONS][keyof (typeof PERMISSIONS)[keyof typeof PERMISSIONS]]
  | typeof PERMISSIONS['SCHOOL']['SETTINGS']['UPDATE']
  | typeof PERMISSIONS['PLATFORM']['LEVY'][keyof typeof PERMISSIONS['PLATFORM']['LEVY']];
