/**
 * RBAC Permission Constants — canonical naming.
 *
 * Canonical convention: <plural_resource>.<action> (matches the database
 * permission seeds in migration 020):
 *   students.view, billing.view, payments.view, reports.view,
 *   users.manage, roles.manage, schools.manage, organizations.manage,
 *   platformlevy.view, platformlevy.manage, settings.manage, audit.view,
 *   notifications.send, notifications.view, ledger.view.
 */
export const PERMISSIONS = {
  STUDENT: {
    VIEW: 'students.view',
    CREATE: 'students.create',
    UPDATE: 'students.update',
    DELETE: 'students.delete',
  },

  BILLING: {
    VIEW: 'billing.view',
    CREATE: 'billing.create',
    EDIT: 'billing.edit',
    LOCK: 'billing.lock',
  },

  PAYMENT: {
    VIEW: 'payments.view',
    RECEIVE: 'payments.receive',
    REFUND: 'payments.refund',
    RECONCILE: 'payments.reconcile',
    RECORD: 'payments.receive', // Canonical: receive records a payment
  },

  LEDGER: {
    VIEW: 'ledger.view',
  },

  REPORT: {
    VIEW: 'reports.view',
    EXPORT: 'reports.export',
  },

  AUDIT: {
    VIEW: 'audit.view',
  },

  NOTIFICATION: {
    SEND: 'notifications.send',
    VIEW: 'notifications.view',
  },

  USER: {
    MANAGE: 'users.manage',
  },

  ROLE: {
    MANAGE: 'roles.manage',
  },

  SCHOOL: {
    MANAGE: 'schools.manage',
    SETTINGS: {
      UPDATE: 'schools.settings.update',
    },
  },

  ORGANIZATION: {
    MANAGE: 'organizations.manage',
  },

  SETTINGS: {
    MANAGE: 'settings.manage',
  },

  PLATFORM: {
    LEVY: {
      VIEW: 'platformlevy.view',
      MANAGE: 'platformlevy.manage',
    },
  },

  KYC: {
    VIEW: 'kyc.view',
    REVIEW: 'kyc.review',
    VERIFY: 'kyc.verify',
    REJECT: 'kyc.reject',
  },

  IDENTITY: {
    VERIFY: 'identity.verify',
  },

  SETTLEMENT: {
    VIEW: 'settlement.view',
    VERIFY: 'settlement.verify',
  },

  GATEWAY: {
    ASSIGN: 'gateway.assign',
  },

  PAYMENT_ACTIVATION: {
    ACTIVATE: 'payment.activate',
  },
} as const;

export type PermissionCode =
  | typeof PERMISSIONS[keyof typeof PERMISSIONS][keyof (typeof PERMISSIONS)[keyof typeof PERMISSIONS]]
  | typeof PERMISSIONS['SCHOOL']['SETTINGS']['UPDATE']
  | typeof PERMISSIONS['PLATFORM']['LEVY'][keyof typeof PERMISSIONS['PLATFORM']['LEVY']]
  | typeof PERMISSIONS['KYC'][keyof typeof PERMISSIONS['KYC']]
  | typeof PERMISSIONS['SETTLEMENT'][keyof typeof PERMISSIONS['SETTLEMENT']]
  | typeof PERMISSIONS['PAYMENT_ACTIVATION'][keyof typeof PERMISSIONS['PAYMENT_ACTIVATION']];
