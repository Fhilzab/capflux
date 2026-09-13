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
  { section: 'Nursery', sectionCode: 'NUR', name: 'Nursery 3', order: 3 },
  { section: 'Primary', sectionCode: 'PRI', name: 'Primary 1', order: 4 },
  { section: 'Primary', sectionCode: 'PRI', name: 'Primary 2', order: 5 },
  { section: 'Primary', sectionCode: 'PRI', name: 'Primary 3', order: 6 },
  { section: 'Primary', sectionCode: 'PRI', name: 'Primary 4', order: 7 },
  { section: 'Primary', sectionCode: 'PRI', name: 'Primary 5', order: 8 },
  { section: 'Primary', sectionCode: 'PRI', name: 'Primary 6', order: 9 },
  { section: 'Junior Secondary', sectionCode: 'JSS', name: 'JSS 1', order: 10 },
  { section: 'Junior Secondary', sectionCode: 'JSS', name: 'JSS 2', order: 11 },
  { section: 'Junior Secondary', sectionCode: 'JSS', name: 'JSS 3', order: 12 },
  { section: 'Senior Secondary', sectionCode: 'SS', name: 'SS 1', order: 13 },
  { section: 'Senior Secondary', sectionCode: 'SS', name: 'SS 2', order: 14 },
  { section: 'Senior Secondary', sectionCode: 'SS', name: 'SS 3', order: 15 },
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

/** Class population targets for the sandbox (deterministic). */
export interface ClassPopulationSpec {
  levelIndex: number;        // index into DEMO_LEVELS
  levelName: string;         // e.g., 'Nursery 1'
  sectionCode: string;       // 'NUR', 'PRI', 'JSS', 'SS'
  targetCount: number;       // exact deterministic count
}

/** Exact class populations — deterministic, within required ranges.
 *  Nursery: 15–25, Primary: 25–35, Secondary (JSS/SS): 30–60
 *  Total: 480 students across 15 classes.
 */
export const CLASS_POPULATIONS: readonly ClassPopulationSpec[] = [
  // Nursery (15–25 each) — total 60
  { levelIndex: 0, levelName: 'Nursery 1', sectionCode: 'NUR', targetCount: 19 },
  { levelIndex: 1, levelName: 'Nursery 2', sectionCode: 'NUR', targetCount: 21 },
  { levelIndex: 2, levelName: 'Nursery 3', sectionCode: 'NUR', targetCount: 20 },

  // Primary (25–35 each) — total 180
  { levelIndex: 3, levelName: 'Primary 1', sectionCode: 'PRI', targetCount: 28 },
  { levelIndex: 4, levelName: 'Primary 2', sectionCode: 'PRI', targetCount: 31 },
  { levelIndex: 5, levelName: 'Primary 3', sectionCode: 'PRI', targetCount: 29 },
  { levelIndex: 6, levelName: 'Primary 4', sectionCode: 'PRI', targetCount: 30 },
  { levelIndex: 7, levelName: 'Primary 5', sectionCode: 'PRI', targetCount: 32 },
  { levelIndex: 8, levelName: 'Primary 6', sectionCode: 'PRI', targetCount: 30 },

  // Junior Secondary (30–60 each) — total 119
  { levelIndex: 9, levelName: 'JSS 1', sectionCode: 'JSS', targetCount: 38 },
  { levelIndex: 10, levelName: 'JSS 2', sectionCode: 'JSS', targetCount: 41 },
  { levelIndex: 11, levelName: 'JSS 3', sectionCode: 'JSS', targetCount: 40 },

  // Senior Secondary (30–60 each) — total 121
  { levelIndex: 12, levelName: 'SS 1', sectionCode: 'SS', targetCount: 39 },
  { levelIndex: 13, levelName: 'SS 2', sectionCode: 'SS', targetCount: 42 },
  { levelIndex: 14, levelName: 'SS 3', sectionCode: 'SS', targetCount: 40 },
] as const;

/** Total students derived from class populations. */
export const TOTAL_STUDENTS = CLASS_POPULATIONS.reduce((sum, c) => sum + c.targetCount, 0);

/** Target guardian count — approximately 1 guardian per 1.8 students for family groups. */
export const TARGET_GUARDIANS = 270;

/** Age ranges by level index (approximate years). */
export const AGE_RANGES: readonly { min: number; max: number }[] = [
  { min: 3, max: 4 },   // Nursery 1
  { min: 4, max: 5 },   // Nursery 2
  { min: 5, max: 6 },   // Nursery 3
  { min: 5, max: 7 },   // Primary 1
  { min: 6, max: 8 },   // Primary 2
  { min: 7, max: 9 },   // Primary 3
  { min: 8, max: 10 },  // Primary 4
  { min: 9, max: 11 },  // Primary 5
  { min: 10, max: 12 }, // Primary 6
  { min: 11, max: 14 }, // JSS 1
  { min: 12, max: 15 }, // JSS 2
  { min: 13, max: 16 }, // JSS 3
  { min: 14, max: 17 }, // SS 1
  { min: 15, max: 18 }, // SS 2
  { min: 16, max: 19 }, // SS 3
] as const;

/** Realistic Nigerian occupations for guardians. */
export const GUARDIAN_OCCUPATIONS = [
  'Trader', 'Civil Servant', 'Engineer', 'Nurse', 'Teacher', 'Banker', 'Artisan',
  'Doctor', 'Lawyer', 'Accountant', 'Architect', 'Pharmacist', 'Journalist', 'Driver',
  'Farmer', 'Contractor', 'Mechanic', 'Electrician', 'Plumber', 'Carpenter', 'Tailor',
  'Hairdresser', 'Caterer', 'Event Planner', 'Real Estate Agent', 'Insurance Broker',
  'IT Specialist', 'Software Developer', 'Data Analyst', 'Project Manager', 'HR Officer',
] as const;

/** Additional realistic Nigerian names for broader diversity. */
export const NIGERIAN_FIRST_NAMES_M_EXTENDED = [
  'Chinedu', 'Emeka', 'Tunde', 'Adebayo', 'Ibrahim', 'Musa', 'Kelechi', 'Obinna',
  'Segun', 'Yusuf', 'Nnamdi', 'Femi', 'Damola', 'Ifeanyi', 'Uche', 'Bashir',
  'Ekene', 'Oluwaseun', 'Abubakar', 'Tochukwu', 'Kunle', 'Sadiq', 'Jide', 'Ejike',
  'Chidi', 'Nonso', 'Chuka', 'Obi', 'Chike', 'Echezona', 'Ikenna', 'Obiora',
  'Somto', 'Kosiso', 'Chisom', 'Ogechi', 'Ugo', 'Chukwuma', 'Okechukwu', 'Chukwudi',
] as const;

export const NIGERIAN_FIRST_NAMES_F_EXTENDED = [
  'Amaka', 'Ngozi', 'Adaeze', 'Funmilayo', 'Aisha', 'Chioma', 'Yemisi', 'Halima',
  'Ifeoma', 'Blessing', 'Zainab', 'Oluchi', 'Folake', 'Rukayat', 'Nneka', 'Aminat',
  'Chiamaka', 'Titilayo', 'Hadiza', 'Onyinye', 'Simisola', 'Fatima', 'Ebere', 'Damilola',
  'Chinwe', 'Adaobi', 'Chinyere', 'Ifunanya', 'Amarachi', 'Chidimma', 'Ogechi', 'Nkem',
  'Ada', 'Ngozi', 'Chika', 'Adaeze', 'Kamsi', 'Zikora', 'Munachi', 'Chizaram',
] as const;

export const NIGERIAN_LAST_NAMES_EXTENDED = [
  'Okafor', 'Adebayo', 'Balogun', 'Okonkwo', 'Adeyemi', 'Bello', 'Eze', 'Ogunleye',
  'Abubakar', 'Chukwu', 'Olawale', 'Ibrahim', 'Nwosu', 'Adeniyi', 'Lawal', 'Obi',
  'Afolabi', 'Sanni', 'Igwe', 'Oyelaran', 'Mohammed', 'Umeh', 'Ashiru', 'Nwachukwu',
  'Salami', 'Onyeka', 'Alabi', 'Danjuma', 'Iwu', 'Fadeyi', 'Osuji', 'Kolawole',
  'Okeke', 'Ezeh', 'Nwankwo', 'Uche', 'Chukwuma', 'Nwoke', 'Odogwu', 'Ekwueme',
  'Okoro', 'Nwadike', 'Onyema', 'Azubuike', 'Ibeh', 'Uzochukwu', 'Oguejiofor', 'Anene',
] as const;

/** Family structure templates for realistic guardian-student relationships. */
export interface FamilyTemplate {
  guardianCount: number;
  childrenCount: number;
  /** Probability weight for selection. */
  weight: number;
}

export const FAMILY_TEMPLATES: readonly FamilyTemplate[] = [
  { guardianCount: 1, childrenCount: 1, weight: 30 },  // Single child
  { guardianCount: 2, childrenCount: 1, weight: 20 },  // Two guardians, one child
  { guardianCount: 1, childrenCount: 2, weight: 25 },  // Single parent, two children
  { guardianCount: 2, childrenCount: 2, weight: 15 },  // Two parents, two children
  { guardianCount: 2, childrenCount: 3, weight: 7 },   // Two parents, three children
  { guardianCount: 1, childrenCount: 3, weight: 2 },   // Single parent, three children
  { guardianCount: 2, childrenCount: 4, weight: 1 },   // Two parents, four children
] as const;

/** Section-level fee catalogue. */
export interface FeeCatalogueSpec {
  [sectionCode: string]: DemoFeeSpec[];
}

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
    id: 'proprietor',
    email: 'owner@demo.capflux',
    password: 'demo1234',
    fullName: 'Amaka Obi',
    role: 'OWNER',
    systemRole: 'OWNER',
    title: 'Proprietress / School Owner',
  },
  {
    id: 'administrator',
    email: 'admin@demo.capflux',
    password: 'demo1234',
    fullName: 'Chinedu Bello',
    role: 'ADMIN',
    systemRole: 'ADMIN',
    title: 'School Administrator',
  },
  {
    id: 'bursar',
    email: 'bursar@demo.capflux',
    password: 'demo1234',
    fullName: 'Ngozi Eze',
    role: 'BURSAR',
    systemRole: 'ADMIN',
    title: 'Bursar',
  },
  {
    id: 'teacher',
    email: 'staff@demo.capflux',
    password: 'demo1234',
    fullName: 'Tunde Adebayo',
    role: 'STAFF',
    systemRole: 'STAFF',
    title: 'Class Teacher',
  },
  {
    id: 'platform_ops',
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
