/**
 * Static demo content for the CAPFLUX sandbox dataset.
 *
 * All names, phone numbers, banks and identifiers are FICTIONAL. No row in
 * this file represents a real person, school or financial institution.
 */

export const DEMO_ORG_ID = 'demo-org';
export const DEMO_SCHOOL_ID = 'demo-school';
export const DEMO_SCHOOL_NAME = 'CAPFLUX Demo Academy';
export const SANDBOX_BANK_NAME = 'CAPFLUX Demo Bank';
export const SANDBOX_GATEWAY_PROVIDER = 'sandbox' as const;

/** Fictional MFB code — deliberately not an active Nigerian bank code. */
export const SANDBOX_BANK_CODE = '990';

export const CURRENT_SESSION = '2025/2026';
export const PREVIOUS_SESSION = '2024/2025';

export const NIGERIAN_FIRST_NAMES_M = [
  'Chinedu', 'Emeka', 'Tunde', 'Adebayo', 'Ibrahim', 'Musa', 'Kelechi', 'Obinna',
  'Segun', 'Yusuf', 'Nnamdi', 'Femi', 'Damola', 'Ifeanyi', 'Uche', 'Bashir',
  'Ekene', 'Oluwaseun', 'Abubakar', 'Tochukwu', 'Kunle', 'Sadiq', 'Jide', 'Ejike',
];

export const NIGERIAN_FIRST_NAMES_F = [
  'Amaka', 'Ngozi', 'Adaeze', 'Funmilayo', 'Aisha', 'Chioma', 'Yemisi', 'Halima',
  'Ifeoma', 'Blessing', 'Zainab', 'Oluchi', 'Folake', 'Rukayat', 'Nneka', 'Aminat',
  'Chiamaka', 'Titilayo', 'Hadiza', 'Onyinye', 'Simisola', 'Fatima', 'Ebere', 'Damilola',
];

export const NIGERIAN_LAST_NAMES = [
  'Okafor', 'Adebayo', 'Balogun', 'Okonkwo', 'Adeyemi', 'Bello', 'Eze', 'Ogunleye',
  'Abubakar', 'Chukwu', 'Olawale', 'Ibrahim', 'Nwosu', 'Adeniyi', 'Lawal', 'Obi',
  'Afolabi', 'Sanni', 'Igwe', 'Oyelaran', 'Mohammed', 'Umeh', 'Ashiru', 'Nwachukwu',
  'Salami', 'Onyeka', 'Alabi', 'Danjuma', 'Iwu', 'Fadeyi', 'Osuji', 'Kolawole',
];

export const STREETS = [
  'Ahmadu Bello Way', 'Nnamdi Azikiwe Close', 'Obafemi Awolowo Crescent',
  'Freedom Walk', 'Unity Road', 'Palm Grove Avenue', 'Baale Street',
  'Market Loop', 'Zoo Estate Drive', 'Ring Road Extension',
];

export const TOWNS = ['Ikeja', 'Yaba', 'Garki', 'Wuse', 'Bodija', 'Sabo', 'GRA'];

export interface DemoLevelSpec {
  section: string;
  sectionCode: string;
  name: string;
  order: number;
}

/** Full Nigerian private-school structure required by the sandbox spec. */
export const DEMO_LEVELS: readonly DemoLevelSpec[] = [
  { section: 'Nursery', sectionCode: 'NUR', name: 'Nursery 1', order: 1 },
  { section: 'Nursery', sectionCode: 'NUR', name: 'Nursery 2', order: 2 },
  { section: 'Primary', sectionCode: 'PRI', name: 'Primary 1', order: 3 },
  { section: 'Primary', sectionCode: 'PRI', name: 'Primary 2', order: 4 },
  { section: 'Primary', sectionCode: 'PRI', name: 'Primary 3', order: 5 },
  { section: 'Primary', sectionCode: 'PRI', name: 'Primary 4', order: 6 },
  { section: 'Primary', sectionCode: 'PRI', name: 'Primary 5', order: 7 },
  { section: 'Primary', sectionCode: 'PRI', name: 'Primary 6', order: 8 },
  { section: 'Junior Secondary', sectionCode: 'JSS', name: 'JSS 1', order: 9 },
  { section: 'Junior Secondary', sectionCode: 'JSS', name: 'JSS 2', order: 10 },
  { section: 'Junior Secondary', sectionCode: 'JSS', name: 'JSS 3', order: 11 },
  { section: 'Senior Secondary', sectionCode: 'SS', name: 'SS 1', order: 12 },
  { section: 'Senior Secondary', sectionCode: 'SS', name: 'SS 2', order: 13 },
  { section: 'Senior Secondary', sectionCode: 'SS', name: 'SS 3', order: 14 },
] as const;

export interface DemoFeeSpec {
  name: string;
  code: string;
  /** Amount in kobo (integer minor units). */
  amountMinor: number;
  mandatory: boolean;
}

/**
 * Realistic fee catalogue (kobo). Tuition varies by section; levies are flat.
 */
export function buildDemoFeeCatalogue(): Record<string, DemoFeeSpec[]> {
  return {
    NUR: [
      { name: 'Tuition', code: 'TUITION', amountMinor: 8500000, mandatory: true },
      { name: 'Development Levy', code: 'DEVLEVY', amountMinor: 500000, mandatory: true },
      { name: 'Examination Fee', code: 'EXAM', amountMinor: 250000, mandatory: true },
      { name: 'ICT Fee', code: 'ICT', amountMinor: 150000, mandatory: false },
      { name: 'Uniform & Materials', code: 'UNIFORM', amountMinor: 1200000, mandatory: false },
      { name: 'Transport', code: 'TRANSPORT', amountMinor: 1800000, mandatory: false },
    ],
    PRI: [
      { name: 'Tuition', code: 'TUITION', amountMinor: 9500000, mandatory: true },
      { name: 'Development Levy', code: 'DEVLEVY', amountMinor: 500000, mandatory: true },
      { name: 'Examination Fee', code: 'EXAM', amountMinor: 300000, mandatory: true },
      { name: 'ICT Fee', code: 'ICT', amountMinor: 200000, mandatory: false },
      { name: 'Uniform & Materials', code: 'UNIFORM', amountMinor: 1500000, mandatory: false },
      { name: 'Transport', code: 'TRANSPORT', amountMinor: 2000000, mandatory: false },
      { name: 'Excursion', code: 'EXCURSION', amountMinor: 450000, mandatory: false },
    ],
    JSS: [
      { name: 'Tuition', code: 'TUITION', amountMinor: 12500000, mandatory: true },
      { name: 'Development Levy', code: 'DEVLEVY', amountMinor: 750000, mandatory: true },
      { name: 'Examination Fee', code: 'EXAM', amountMinor: 400000, mandatory: true },
      { name: 'ICT Fee', code: 'ICT', amountMinor: 300000, mandatory: false },
      { name: 'Laboratory Fee', code: 'LAB', amountMinor: 350000, mandatory: false },
      { name: 'Transport', code: 'TRANSPORT', amountMinor: 2200000, mandatory: false },
    ],
    SS: [
      { name: 'Tuition', code: 'TUITION', amountMinor: 15000000, mandatory: true },
      { name: 'Development Levy', code: 'DEVLEVY', amountMinor: 750000, mandatory: true },
      { name: 'Examination Fee', code: 'EXAM', amountMinor: 500000, mandatory: true },
      { name: 'Laboratory Fee', code: 'LAB', amountMinor: 600000, mandatory: false },
      { name: 'WAEC/NECO Registration', code: 'WASCEXAM', amountMinor: 3200000, mandatory: false },
      { name: 'Transport', code: 'TRANSPORT', amountMinor: 2200000, mandatory: false },
    ],
  };
}

/** Platform fee (levy) charged per collection — mirrors PLATFORM fee codes. */
export const PLATFORM_LEVY_PERCENT = 1.5;

export const PAYMENT_FAILURE_REASONS = [
  'Insufficient funds',
  'Transfer declined by bank',
  'Account does not exist',
] as const;

export const GUARDIAN_RELATIONSHIPS = [
  'FATHER', 'MOTHER', 'GUARDIAN', 'UNCLE', 'AUNT', 'GRANDPARENT', 'SIBLING',
] as const;

/** Demo personas — fictional users exercising the real authorization model. */
export interface DemoPersonaSpec {
  id: string;
  email: string;
  password: string;
  fullName: string;
  role: 'OWNER' | 'ADMIN' | 'BURSAR' | 'STAFF';
  systemRole: 'OWNER' | 'ADMIN' | 'STAFF';
  title: string;
  platformStaff?: boolean;
}

export const DEMO_PERSONAS: readonly DemoPersonaSpec[] = [
  {
    id: 'demo-user-owner',
    email: 'owner@demo.capflux',
    password: 'demo1234',
    fullName: 'Amaka Obi',
    role: 'OWNER',
    systemRole: 'OWNER',
    title: 'Proprietress / School Owner',
  },
  {
    id: 'demo-user-admin',
    email: 'admin@demo.capflux',
    password: 'demo1234',
    fullName: 'Chinedu Bello',
    role: 'ADMIN',
    systemRole: 'ADMIN',
    title: 'School Administrator',
  },
  {
    id: 'demo-user-bursar',
    email: 'bursar@demo.capflux',
    password: 'demo1234',
    fullName: 'Ngozi Eze',
    role: 'BURSAR',
    systemRole: 'ADMIN',
    title: 'Bursar',
  },
  {
    id: 'demo-user-staff',
    email: 'staff@demo.capflux',
    password: 'demo1234',
    fullName: 'Tunde Adebayo',
    role: 'STAFF',
    systemRole: 'STAFF',
    title: 'Class Teacher',
  },
  {
    id: 'demo-user-platform',
    email: 'ops@capflux.demo',
    password: 'demo1234',
    fullName: 'CAPFLUX Platform Ops',
    role: 'STAFF',
    systemRole: 'STAFF',
    title: 'Platform Compliance Staff',
    platformStaff: true,
  },
] as const;

export const DEMO_PASSWORD_HINT = 'demo1234';

/**
 * Permission codes granted per persona (canonical `<resource>.<action>` set
 * seeded by backend migration 020). The sandbox API simulator enforces these
 * through the SAME rbacStore/RouteGuard machinery as production.
 */
export const PERSONA_PERMISSIONS: Record<string, readonly string[]> = {
  OWNER: [
    'students.view', 'students.create', 'students.update', 'students.delete',
    'billing.view', 'billing.create', 'billing.edit', 'billing.lock',
    'payments.view', 'payments.receive', 'payments.refund', 'payments.reconcile',
    'ledger.view', 'reports.view', 'reports.export', 'audit.view',
    'notifications.send', 'notifications.view', 'users.manage', 'roles.manage',
    'settings.manage', 'schools.manage', 'organizations.manage',
    'platformlevy.view', 'kyc.view', 'kyc.submit', 'settlement.manage',
    'payment.activate',
  ],
  ADMIN: [
    'students.view', 'students.create', 'students.update',
    'billing.view', 'billing.create', 'billing.edit',
    'payments.view', 'payments.receive',
    'ledger.view', 'reports.view', 'reports.export',
    'notifications.send', 'notifications.view', 'settings.manage',
    'audit.view', 'kyc.view', 'settlement.manage',
  ],
  BURSAR: [
    'students.view',
    'billing.view', 'billing.create', 'billing.edit', 'billing.lock',
    'payments.view', 'payments.receive', 'payments.reconcile',
    'ledger.view', 'reports.view', 'reports.export', 'notifications.view',
  ],
  STAFF: [
    'students.view', 'notifications.view',
  ],
  PLATFORM: [
    'kyc.view', 'kyc.review', 'settlement.review', 'payment.activate',
    'gateway.assign', 'payments.reconcile', 'audit.view', 'platformlevy.manage',
  ],
};
