/**
 * CAPFLUX sandbox seeder.
 *
 * Builds the complete demo dataset ("CAPFLUX Demo Academy") deterministically:
 * identical seeds produce identical content (modulo the day-level time anchor,
 * which exists so "Today's Collections" is always meaningful).
 *
 * Financial integrity rules are preserved end-to-end:
 *  - every charge/payment/reversal is a real append-only ledger entry;
 *  - running balances and the SHA256_V1 hash chain are computed exactly the
 *    way LedgerEngine.computeEntryHash does at runtime;
 *  - balances are never stored — they are derived from entries everywhere.
 *
 * All persons/institutions are fictional.
 */

import type { SandboxCapfluxDB } from '../sandboxDb';
import { getSandboxDb } from '../sandboxDb';
import { assertSandboxMode } from '../runtime/sandboxGuard';
import { runtimeEnvironment } from '../../shared/environment/runtimeEnvironment';
import { computeEntryHash } from '../../shared/core/IdGenerator';
import { createDeterministicRandom, stableHash } from './random';
import {
  CURRENT_SESSION,
  DEMO_ORG_ID,
  DEMO_SCHOOL_ID,
  DEMO_SCHOOL_NAME,
  DEMO_LEVELS,
  DEMO_PERSONAS,
  GUARDIAN_RELATIONSHIPS,
  NIGERIAN_FIRST_NAMES_F,
  NIGERIAN_FIRST_NAMES_M,
  NIGERIAN_LAST_NAMES,
  PAYMENT_FAILURE_REASONS,
  PREVIOUS_SESSION,
  SANDBOX_BANK_CODE,
  SANDBOX_BANK_NAME,
  SANDBOX_GATEWAY_PROVIDER,
  STREETS,
  TOWNS,
  buildDemoFeeCatalogue,
} from './demoData';

const SEED_VERSION = 3;
const SEED_RANDOM_SEED = 0xcafe + 424242;

export const SEED_COUNTS = Object.freeze({
  guardians: 64,
  students: 120,
});

type AnyRow = Record<string, unknown>;

function pad(n: number, width: number): string {
  return String(n).padStart(width, '0');
}

function iso(date: Date): string {
  return date.toISOString();
}

function daysBefore(anchor: Date, days: number, hour = 10, minute = 30): Date {
  const d = new Date(anchor);
  d.setDate(d.getDate() - days);
  d.setHours(hour, minute, 0, 0);
  return d;
}

/** Deterministic SHA-256_V1 hash identical to the runtime ledger chain. */
async function seedEntryHash(params: {
  previousHash?: string | null;
  entryNumber: string;
  transactionGroupId: string;
  entryDirection: string;
  amountMinor: number;
  occurredAt: string;
}): Promise<string> {
  return computeEntryHash({
    schemaVersion: 1,
    previousHash: params.previousHash ?? undefined,
    entryNumber: params.entryNumber,
    transactionGroupId: params.transactionGroupId,
    entryDirection: params.entryDirection,
    amountMinor: params.amountMinor,
    occurredAt: params.occurredAt,
    algorithm: 'SHA256_V1',
  });
}

interface PlannedStudent {
  id: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  gender: 'Male' | 'Female';
  dob: string;
  admissionNumber: string;
  levelIndex: number;
  guardianId: string;
  secondGuardianId: string | null;
  relationship: string;
  archived: boolean;
  street: string;
  town: string;
}

interface PlannedFeeLine {
  code: string;
  name: string;
  amountMinor: number;
  mandatory: boolean;
}

interface PlannedCharge {
  studentId: string;
  fee: PlannedFeeLine;
  chargeId: string;
  occurredAt: string;
}

export type PaymentOutcomeKind =
  | 'FULL'
  | 'PARTIAL'
  | 'MULTI'
  | 'NONE'
  | 'PENDING'
  | 'FAILED'
  | 'REVERSED';

interface PlannedSuccessPayment {
  reference: string;
  txnRef: string;
  studentId: string;
  amountMinor: number;
  daysAgo: number;
  settled: boolean;
  kind: PaymentOutcomeKind;
}

interface SeedPlan {
  sessions: AnyRow[];
  terms: AnyRow[];
  divisions: AnyRow[];
  levels: AnyRow[];
  guardians: AnyRow[];
  students: PlannedStudent[];
  enrollments: AnyRow[];
  fees: AnyRow[];
  charges: PlannedCharge[];
  dvAs: AnyRow[];
  successPayments: PlannedSuccessPayment[];
  pendingPayments: AnyRow[];
  failedPayments: AnyRow[];
  reversedPayments: PlannedSuccessPayment[];
  notifications: AnyRow[];
  auditActions: { action: string; entity: string; entityId: string; daysAgo: number }[];
}

/** Pure planner — same inputs always produce the same plan. */
function buildPlan(anchor: Date): SeedPlan {
  const rand = createDeterministicRandom(SEED_RANDOM_SEED);
  const catalogue = buildDemoFeeCatalogue();

  // ---- Academic structure -------------------------------------------------
  const sessionRows: AnyRow[] = [
    {
      id: 'sd-ses-prev',
      school_id: DEMO_SCHOOL_ID,
      name: PREVIOUS_SESSION,
      start_date: '2024-09-16',
      end_date: '2025-07-25',
      is_current: false,
      status: 'COMPLETED',
      created_at: iso(daysBefore(anchor, 400)),
      updated_at: iso(daysBefore(anchor, 45)),
    },
    {
      id: 'sd-ses-cur',
      school_id: DEMO_SCHOOL_ID,
      name: CURRENT_SESSION,
      start_date: '2025-09-15',
      end_date: '2026-07-24',
      is_current: true,
      status: 'ACTIVE',
      created_at: iso(daysBefore(anchor, 120)),
      updated_at: iso(daysBefore(anchor, 120)),
    },
  ];

  const termNames = ['First Term', 'Second Term', 'Third Term'];
  const terms: AnyRow[] = [];
  for (const [sessionIdx, sessionId] of ['sd-ses-prev', 'sd-ses-cur'].entries()) {
    for (let t = 0; t < 3; t++) {
      const isCurrent = sessionId === 'sd-ses-cur' && t === 0;
      terms.push({
        id: `sd-trm-${sessionIdx}-${t + 1}`,
        session_id: sessionId,
        school_id: DEMO_SCHOOL_ID,
        name: termNames[t],
        term_number: t + 1,
        display_order: t + 1,
        start_date: null,
        end_date: null,
        is_current: isCurrent,
        status: sessionId === 'sd-ses-prev' ? 'COMPLETED' : isCurrent ? 'ACTIVE' : 'UPCOMING',
        created_at: iso(daysBefore(anchor, 120)),
        updated_at: iso(daysBefore(anchor, 40)),
      });
    }
  }

  const sectionIds = new Map<string, string>();
  const divisions: AnyRow[] = [];
  const seenSections = new Set<string>();
  let divOrder = 1;
  for (const level of DEMO_LEVELS) {
    if (!seenSections.has(level.sectionCode)) {
      seenSections.add(level.sectionCode);
      const id = `sd-div-${level.sectionCode.toLowerCase()}`;
      sectionIds.set(level.sectionCode, id);
      divisions.push({
        id,
        school_id: DEMO_SCHOOL_ID,
        name: level.section,
        code: level.sectionCode,
        display_order: divOrder++,
        description: `${level.section} section`,
        status: 'ACTIVE',
        created_at: iso(daysBefore(anchor, 130)),
        updated_at: iso(daysBefore(anchor, 130)),
      });
    }
  }

  const levels: AnyRow[] = DEMO_LEVELS.map((level, idx) => ({
    id: `sd-lvl-${pad(idx + 1, 2)}`,
    school_id: DEMO_SCHOOL_ID,
    section_id: sectionIds.get(level.sectionCode),
    name: level.name,
    code: level.sectionCode + pad(idx + 1, 2),
    display_order: level.order,
    status: 'ACTIVE',
    created_at: iso(daysBefore(anchor, 130)),
    updated_at: iso(daysBefore(anchor, 130)),
  }));

  // ---- Guardians -----------------------------------------------------------
  const guardians: AnyRow[] = [];
  for (let i = 0; i < SEED_COUNTS.guardians; i++) {
    const first = rand.pick(i % 2 === 0 ? NIGERIAN_FIRST_NAMES_M : NIGERIAN_FIRST_NAMES_F);
    const last = rand.pick(NIGERIAN_LAST_NAMES);
    const phoneSuffix = pad(10000000 + i * 137, 8);
    guardians.push({
      id: `sd-grd-${pad(i + 1, 3)}`,
      school_id: DEMO_SCHOOL_ID,
      full_name: `${first} ${last}`,
      primary_phone: `+23480${phoneSuffix}`,
      secondary_phone: i % 3 === 0 ? `+23470${phoneSuffix}` : null,
      email: `${first.toLowerCase()}.${last.toLowerCase()}@demo-parent.ng`,
      relationship: rand.pick(GUARDIAN_RELATIONSHIPS),
      occupation: rand.pick(['Trader', 'Civil Servant', 'Engineer', 'Nurse', 'Teacher', 'Banker', 'Artisan']),
      address: `${rand.int(1, 99)} ${rand.pick(STREETS)}, ${rand.pick(TOWNS)}`,
      created_at: iso(daysBefore(anchor, 110 - (i % 30))),
      updated_at: iso(daysBefore(anchor, 110 - (i % 30))),
    });
  }

  // ---- Students --------------------------------------------------------------
  const students: PlannedStudent[] = [];
  for (let i = 0; i < SEED_COUNTS.students; i++) {
    const gender = i % 2 === 0 ? 'Male' : 'Female';
    const firstName = gender === 'Male'
      ? NIGERIAN_FIRST_NAMES_M[(i * 7) % NIGERIAN_FIRST_NAMES_M.length]!
      : NIGERIAN_FIRST_NAMES_F[(i * 11) % NIGERIAN_FIRST_NAMES_F.length]!;
    const lastName = NIGERIAN_LAST_NAMES[(i * 13) % NIGERIAN_LAST_NAMES.length]!;
    const middleName = i % 4 === 0
      ? NIGERIAN_LAST_NAMES[(i * 17 + 3) % NIGERIAN_LAST_NAMES.length]!
      : null;
    // Spread students over all 14 levels with realistic pyramid weights.
    const levelIndex = pickLevelIndex(i);
    const guardianId = guardians[i % guardians.length]!.id as string;
    const secondGuardianId = rand.chance(0.25)
      ? guardians[(i + 17) % guardians.length]!.id !== guardianId
        ? guardians[(i + 17) % guardians.length]!.id
        : null
      : null;
    const birthYear = 2012 + Math.floor(levelIndex / 2) + rand.int(0, 1);
    students.push({
      id: `sd-stu-${pad(i + 1, 4)}`,
      firstName,
      lastName,
      middleName,
      gender,
      dob: `${birthYear}-${pad(rand.int(1, 12), 2)}-${pad(rand.int(1, 28), 2)}`,
      admissionNumber: `CAP-${pad(i + 1, 5)}`,
      levelIndex,
      guardianId,
      secondGuardianId,
      relationship: rand.pick(GUARDIAN_RELATIONSHIPS),
      archived: i >= SEED_COUNTS.students - 6,
      street: rand.pick(STREETS),
      town: rand.pick(TOWNS),
    });
  }

  // ---- Enrollments ------------------------------------------------------------
  const enrollments: AnyRow[] = [];
  for (const s of students) {
    const levelId = `sd-lvl-${pad(s.levelIndex + 1, 2)}`;
    const prevLevelOrder = s.levelIndex; // same level last session for most
    enrollments.push({
      id: `sd-enr-prev-${s.id.slice(-4)}`,
      school_id: DEMO_SCHOOL_ID,
      student_id: s.id,
      academic_session_id: 'sd-ses-prev',
      section_id: levels[s.levelIndex]!.section_id,
      level_id: `sd-lvl-${pad(Math.max(prevLevelOrder, 1), 2)}`,
      status: 'COMPLETED',
      effective_date: iso(daysBefore(anchor, 380)),
      ended_at: iso(daysBefore(anchor, 48)),
      reason: 'INITIAL',
      source: 'SEED',
      created_by: null,
      created_at: iso(daysBefore(anchor, 380)),
      updated_at: iso(daysBefore(anchor, 48)),
    });
    enrollments.push({
      id: `sd-enr-cur-${s.id.slice(-4)}`,
      school_id: DEMO_SCHOOL_ID,
      student_id: s.id,
      academic_session_id: 'sd-ses-cur',
      section_id: levels[s.levelIndex]!.section_id,
      level_id: levelId,
      status: 'ACTIVE',
      effective_date: iso(daysBefore(anchor, 47)),
      ended_at: null,
      reason: 'PROMOTION',
      source: 'SEED',
      created_by: null,
      created_at: iso(daysBefore(anchor, 47)),
      updated_at: iso(daysBefore(anchor, 47)),
    });
  }

  // ---- Fees --------------------------------------------------------------------
  const fees: AnyRow[] = [];
  const feesBySection = new Map<string, PlannedFeeLine[]>();
  for (const [code, specs] of Object.entries(catalogue)) {
    feesBySection.set(code, specs);
    for (const spec of specs) {
      fees.push({
        id: `sd-fee-${code.toLowerCase()}-${spec.code.toLowerCase()}`,
        school_id: DEMO_SCHOOL_ID,
        division_id: sectionIds.get(code),
        academic_level_id: null,
        name: spec.name,
        code: spec.code,
        amount_minor: spec.amountMinor,
        currency: 'NGN',
        is_mandatory: spec.mandatory,
        owner: 'SCHOOL',
        description: `${spec.name} (${code})`,
        status: 'ACTIVE',
        created_at: iso(daysBefore(anchor, 125)),
        updated_at: iso(daysBefore(anchor, 125)),
      });
    }
  }

  // ---- Charges (mandatory + a slice of optional) ----------------------------------
  const charges: PlannedCharge[] = [];
  for (const s of students) {
    const sectionCode = DEMO_LEVELS[s.levelIndex]!.sectionCode;
    const specs = feesBySection.get(sectionCode)!;
    for (const fee of specs) {
      if (!fee.mandatory && !rand.chance(0.35)) continue;
      charges.push({
        studentId: s.id,
        fee,
        chargeId: `sd-chg-${s.id.slice(-4)}-${fee.code.toLowerCase()}`,
        occurredAt: iso(daysBefore(anchor, 46, 9, 0)),
      });
    }
  }

  // ---- Payment outcomes ---------------------------------------------------------
  const successPayments: PlannedSuccessPayment[] = [];
  const pendingPayments: AnyRow[] = [];
  const failedPayments: AnyRow[] = [];
  const reversedPayments: PlannedSuccessPayment[] = [];

  const totalDueByStudent = new Map<string, number>();
  for (const c of charges) {
    totalDueByStudent.set(c.studentId, (totalDueByStudent.get(c.studentId) ?? 0) + c.fee.amountMinor);
  }

  let paySeq = 0;
  const nextRef = () => `DEMO-PAY-${pad(++paySeq, 6)}`;

  // Deterministically distribute outcomes over active students.
  const activeStudents = students.filter((s) => !s.archived);
  let dayCursor = 0;
  for (const [idx, s] of activeStudents.entries()) {
    const due = totalDueByStudent.get(s.id) ?? 0;
    if (due === 0) continue;
    const roll = idx % 20;

    const pushSuccess = (amountMinor: number, kind: PaymentOutcomeKind, settled: boolean) => {
      successPayments.push({
        reference: nextRef(),
        txnRef: `SANDBOX-TXN-${pad(paySeq, 6)}`,
        studentId: s.id,
        amountMinor,
        daysAgo: dayCursor,
        settled,
        kind,
      });
      // Spread over the last 35 days, several payments land today.
      dayCursor = (dayCursor + 1) % 35;
    };

    if (roll <= 11) {
      pushSuccess(due, 'FULL', dayCursor > 3);
    } else if (roll <= 15) {
      // Partial — roughly half the bill.
      const half = Math.max(5000000, Math.round((due * (rand.int(35, 65))) / 100));
      pushSuccess(half, 'PARTIAL', dayCursor > 3);
    } else if (roll <= 17) {
      // Multiple part-payments totalling the bill.
      const firstShare = rand.int(30, 55);
      const first = Math.max(3000000, Math.round((due * firstShare) / 100));
      pushSuccess(first, 'MULTI', true);
      pushSuccess(due - first, 'MULTI', false);
    } else if (roll === 18) {
      pendingPayments.push({
        id: `sd-txn-pend-${s.id.slice(-4)}`,
        school_id: DEMO_SCHOOL_ID,
        student_id: s.id,
        reference: nextRef(),
        gateway_txn_ref: `SANDBOX-TXN-${pad(paySeq, 6)}`,
        provider_reference: `sandbox-ref-${s.id.slice(-4)}`,
        amount_minor: due,
        amount: due / 100,
        currency: 'NGN',
        status: 'PENDING',
        method: 'BANK_TRANSFER',
        gateway_provider: 'SANDBOX',
        settlement_status: 'PENDING',
        failure_reason: null,
        verified_at: null,
        created_at: iso(daysBefore(anchor, rand.int(0, 4))),
        updated_at: iso(daysBefore(anchor, 0)),
      });
    } else {
      failedPayments.push({
        id: `sd-txn-fail-${s.id.slice(-4)}`,
        school_id: DEMO_SCHOOL_ID,
        student_id: s.id,
        reference: nextRef(),
        gateway_txn_ref: `SANDBOX-TXN-${pad(paySeq, 6)}`,
        provider_reference: `sandbox-ref-${s.id.slice(-4)}`,
        amount_minor: due,
        amount: due / 100,
        currency: 'NGN',
        status: 'FAILED',
        method: 'BANK_TRANSFER',
        gateway_provider: 'SANDBOX',
        settlement_status: 'FAILED',
        failure_reason: rand.pick(PAYMENT_FAILURE_REASONS),
        verified_at: null,
        created_at: iso(daysBefore(anchor, rand.int(1, 10))),
        updated_at: iso(daysBefore(anchor, rand.int(1, 10))),
      });
    }
  }

  // A handful of reversals among older successful payments.
  const reversalCandidates = successPayments.filter((p) => p.daysAgo > 20).slice(0, 5);
  for (const candidate of reversalCandidates) {
    reversedPayments.push(candidate);
  }

  // ---- Virtual accounts -------------------------------------------------------------
  const dvAs: AnyRow[] = [];
  let dvaCounter = 0;
  for (const s of students) {
    dvaCounter += 1;
    const accountNumber = `1000${pad(dvaCounter, 6)}`;
    dvAs.push({
      id: `sd-dva-${pad(dvaCounter, 4)}`,
      school_id: DEMO_SCHOOL_ID,
      student_id: s.id,
      provider: SANDBOX_GATEWAY_PROVIDER,
      provider_account_id: `sbx-cust-${pad(dvaCounter, 5)}`,
      provider_reference: `sbx-dva-ref-${pad(dvaCounter, 5)}`,
      virtual_account_number: accountNumber,
      account_name: `${s.firstName} ${s.lastName} — CAPFLUX DEMO ACADEMY`,
      bank_name: SANDBOX_BANK_NAME,
      account_status: s.archived && dvaCounter % 3 === 0 ? 'INACTIVE' : 'ACTIVE',
      is_primary: true,
      // Derived convenience field for legacy readers (naira).
      account_number_masked: `******${accountNumber.slice(-4)}`,
      idempotency_key: `sbx-dva-${s.id}`,
      created_at: iso(daysBefore(anchor, 44)),
      updated_at: iso(daysBefore(anchor, 44)),
    });
  }

  // ---- Notifications -----------------------------------------------------------------
  const notifications: AnyRow[] = [];
  const notifyStudents = activeStudents.filter((_, i) => i % 9 === 0).slice(0, 10);
  for (const [i, s] of notifyStudents.entries()) {
    const payment = successPayments.find((p) => p.studentId === s.id);
    notifications.push({
      id: `sd-not-${pad(i + 1, 3)}`,
      school_id: DEMO_SCHOOL_ID,
      student_id: s.id,
      guardian_id: s.guardianId,
      recipient_phone: guardians.find((g) => g.id === s.guardianId)?.primary_phone ?? null,
      message_body: payment
        ? `Payment of ₦${(payment.amountMinor / 100).toLocaleString('en-NG')} received for ${s.firstName} ${s.lastName}. Ref ${payment.reference}. Thank you.`
        : `Friendly reminder: outstanding fees for ${s.firstName} ${s.lastName}. Kindly pay via the dedicated account.`,
      delivery_method: 'SMS',
      delivery_status: 'DELIVERED',
      provider_msg_id: `sbx-msg-${pad(i + 1, 5)}`,
      client_sequence: 0,
      device_id: 'sandbox-seed',
      read: i > 3,
      created_at: iso(daysBefore(anchor, i + 1)),
      updated_at: iso(daysBefore(anchor, i + 1)),
      source: 'SERVER',
      version: 1,
    });
  }

  // ---- Audit actions (recent financial events) ----------------------------------------
  const auditActions: SeedPlan['auditActions'] = [
    { action: 'KYC_VERIFIED', entity: 'kyc_records', entityId: 'sd-kyc-main', daysAgo: 42 },
    { action: 'SETTLEMENT_ACCOUNT_VERIFIED', entity: 'settlement_accounts', entityId: 'sd-setacc-main', daysAgo: 41 },
    { action: 'GATEWAY_ASSIGNED', entity: 'gateway_assignments', entityId: 'sd-gw-main', daysAgo: 40 },
    { action: 'PAYMENTS_ACTIVATED', entity: 'schools', entityId: DEMO_SCHOOL_ID, daysAgo: 40 },
  ];
  for (const p of successPayments.filter((x) => x.daysAgo <= 6)) {
    auditActions.push({ action: 'PAYMENT_RECEIVED', entity: 'payment_transactions', entityId: p.reference, daysAgo: p.daysAgo });
  }

  return {
    sessions: sessionRows,
    terms,
    divisions,
    levels,
    guardians,
    students,
    enrollments,
    fees,
    charges,
    dvAs,
    successPayments,
    pendingPayments,
    failedPayments,
    reversedPayments,
    notifications,
    auditActions,
  };
}

/** Realistic age pyramid: more pupils in lower sections. */
function pickLevelIndex(i: number): number {
  const weights = [2, 2, 3, 3, 3, 3, 3, 3, 2, 2, 2, 1, 1, 1]; // sums to 33
  const total = weights.reduce((a, b) => a + b, 0);
  const slot = (i * 7 + 3) % total;
  let acc = 0;
  for (let idx = 0; idx < weights.length; idx++) {
    acc += weights[idx]!;
    if (slot < acc) return idx;
  }
  return 0;
}

export interface SeedResult {
  students: number;
  guardians: number;
  payments: number;
  ledgerEntries: number;
  datasetHash: string;
  seededAt: string;
}

/**
 * Seed (or re-seed) THE sandbox database. Clears every sandbox table first so
 * resets are complete and deterministic. Never touches other databases.
 */
export async function seedSandboxDatabase(db?: SandboxCapfluxDB): Promise<SeedResult> {
  assertSandboxMode(runtimeEnvironment.isSandbox, 'seedSandboxDatabase');
  const target = db ?? getSandboxDb();
  const anchor = new Date();
  anchor.setHours(0, 0, 0, 0);

  const plan = buildPlan(anchor);

  await clearAllTables(target);

  // ---- Reference rows -----------------------------------------------------
  await target.schools.bulkPut([
    {
      id: DEMO_SCHOOL_ID,
      organization_id: DEMO_ORG_ID,
      name: DEMO_SCHOOL_NAME,
      slug: 'capflux-demo-academy',
      status: 'ACTIVE',
      payment_status: 'READY',
      kyc_status: 'VERIFIED',
      address: '1 Unity Road, Ikeja',
      state: 'Lagos',
      lga: 'Ikeja',
      country: 'Nigeria',
      school_type: 'PRIVATE',
      academic_calendar: 'THREE_TERM',
      created_at: iso(daysBefore(anchor, 130)),
      updated_at: iso(daysBefore(anchor, 40)),
      source: 'LOCAL',
      version: 1,
    },
  ]);

  await target.profiles.bulkPut(
    DEMO_PERSONAS.map((persona) => ({
      id: persona.id,
      school_id: persona.platformStaff ? null : DEMO_SCHOOL_ID,
      full_name: persona.fullName,
      role: persona.systemRole,
      email: persona.email,
      title: persona.title,
      platform_staff: Boolean(persona.platformStaff),
      created_at: iso(daysBefore(anchor, 130)),
      updated_at: iso(daysBefore(anchor, 130)),
    })),
  );

  await target.academic_sessions.bulkPut(plan.sessions as never[]);
  await target.academic_terms.bulkPut(plan.terms as never[]);
  await target.school_divisions.bulkPut(plan.divisions as never[]);
  await target.academic_levels.bulkPut(plan.levels as never[]);
  await target.guardians.bulkPut(plan.guardians as never[]);

  const studentRows: AnyRow[] = plan.students.map((s) => ({
    id: s.id,
    school_id: DEMO_SCHOOL_ID,
    first_name: s.firstName,
    middle_name: s.middleName,
    last_name: s.lastName,
    gender: s.gender,
    date_of_birth: s.dob,
    admission_number: s.admissionNumber,
    admission_date: iso(daysBefore(anchor, 90 - (s.levelIndex * 2))),
    class_name: DEMO_LEVELS[s.levelIndex]!.name,
    category: DEMO_LEVELS[s.levelIndex]!.sectionCode,
    guardian_id: s.guardianId,
    division_id: plan.levels[s.levelIndex]!.section_id,
    guardian_phone: plan.guardians.find((g) => g.id === s.guardianId)?.primary_phone ?? null,
    status: s.archived ? 'ARCHIVED' : 'ACTIVE',
    client_sequence: 0,
    device_id: 'sandbox-seed',
    created_at: iso(daysBefore(anchor, 90)),
    updated_at: iso(daysBefore(anchor, 10)),
    source: 'LOCAL',
    version: 1,
  }));
  await target.students.bulkPut(studentRows as never[]);

  await target.student_enrollments.bulkPut(plan.enrollments as never[]);

  const links: AnyRow[] = [];
  for (const s of plan.students) {
    links.push({
      id: `sd-lnk-${s.id.slice(-4)}-p`,
      school_id: DEMO_SCHOOL_ID,
      student_id: s.id,
      guardian_id: s.guardianId,
      relationship: s.relationship,
      is_primary: true,
      created_at: iso(daysBefore(anchor, 90)),
      updated_at: iso(daysBefore(anchor, 90)),
      source: 'LOCAL',
      version: 1,
    });
    if (s.secondGuardianId) {
      links.push({
        id: `sd-lnk-${s.id.slice(-4)}-s`,
        school_id: DEMO_SCHOOL_ID,
        student_id: s.id,
        guardian_id: s.secondGuardianId,
        relationship: 'GUARDIAN',
        is_primary: false,
        created_at: iso(daysBefore(anchor, 80)),
        updated_at: iso(daysBefore(anchor, 80)),
        source: 'LOCAL',
        version: 1,
      });
    }
  }
  await target.student_guardians.bulkPut(links as never[]);

  await target.fees.bulkPut(plan.fees as never[]);

  await target.payment_accounts.bulkPut(plan.dvAs as never[]);

  // ---- Financial core: charges + payments + append-only ledger ---------------
  const ledgerEntries: AnyRow[] = [];
  let ledgerIdCounter = 0;
  let schoolSequence = 0;

  const nextEntryNumber = () => `LED-SEED-${pad(++schoolSequence, 6)}`;

  interface ChainState {
    /** Hash of the most recent entry for this student (null for first). */
    lastHash: string | null;
    balanceAfterMinor: number;
    seq: number;
  }
  const chains = new Map<string, ChainState>();

  const buildEntry = async (
    studentId: string,
    input: {
      entryType: 'CHARGE' | 'PAYMENT' | 'REVERSAL';
      direction: 'DEBIT' | 'CREDIT';
      amountMinor: number;
      sourceDocumentType: 'CHARGE' | 'PAYMENT' | 'ADJUSTMENT';
      sourceDocumentId: string;
      transactionGroupId: string;
      occurredAt: string;
      metadata: Record<string, unknown>;
    },
  ): Promise<AnyRow> => {
    const chain: ChainState = chains.get(studentId) ?? { lastHash: null, balanceAfterMinor: 0, seq: 0 };
    const entryNumber = nextEntryNumber();
    const entryHash = await seedEntryHash({
      previousHash: chain.lastHash,
      entryNumber,
      transactionGroupId: input.transactionGroupId,
      entryDirection: input.direction,
      amountMinor: input.amountMinor,
      occurredAt: input.occurredAt,
    });
    const balanceBeforeMinor = chain.balanceAfterMinor;
    const balanceAfterMinor = input.direction === 'DEBIT'
      ? balanceBeforeMinor + input.amountMinor
      : balanceBeforeMinor - input.amountMinor;

    // Capture the PREVIOUS hash before mutating state (append-only chain).
    const previousHash = chain.lastHash;
    chain.lastHash = entryHash;
    chain.balanceAfterMinor = balanceAfterMinor;
    chain.seq += 1;
    chains.set(studentId, chain);

    return {
      id: `sd-led-${pad(++ledgerIdCounter, 6)}`,
      entry_number: entryNumber,
      sequence_number: schoolSequence,
      schema_version: 1,
      organization_id: DEMO_ORG_ID,
      school_id: DEMO_SCHOOL_ID,
      student_id: studentId,
      billing_profile_id: `sd-bil-${studentId.slice(-4)}`,
      transaction_group_id: input.transactionGroupId,
      source_document_type: input.sourceDocumentType,
      source_document_id: input.sourceDocumentId,
      academic_session_id: 'sd-ses-cur',
      academic_term_id: 'sd-trm-1-1',
      entry_type: input.entryType,
      entry_direction: input.direction,
      // Derived legacy-view fields (naira + DEBIT/CREDIT) so legacy readers
      // (dashboard/billing summaries) stay consistent with the canonical row.
      amount: input.amountMinor / 100,
      amount_minor: input.amountMinor,
      entry_category: input.entryType,
      reference_id: input.sourceDocumentId,
      balance_before_minor: balanceBeforeMinor,
      balance_after_minor: balanceAfterMinor,
      currency: 'NGN',
      source_entity: input.entryType === 'REVERSAL' ? 'REVERSAL' : input.sourceDocumentType === 'CHARGE' ? 'BILLING' : 'PAYMENT',
      previous_hash: previousHash,
      entry_hash: entryHash,
      hash_algorithm: 'SHA256_V1',
      reconciliation_status: input.entryType === 'PAYMENT' ? 'RECONCILED' : 'UNRECONCILED',
      metadata: input.metadata,
      occurred_at: input.occurredAt,
      posting_date: input.occurredAt,
      created_by: 'demo-user-bursar',
      created_at: input.occurredAt,
      device_id: 'sandbox-seed',
      client_sequence: 0,
      source: 'LOCAL',
      version: 1,
    };
  };

  // Charges first (chronological, oldest → newest).
  for (const charge of plan.charges) {
    ledgerEntries.push(await buildEntry(charge.studentId, {
      entryType: 'CHARGE',
      direction: 'DEBIT',
      amountMinor: charge.fee.amountMinor,
      sourceDocumentType: 'CHARGE',
      sourceDocumentId: charge.chargeId,
      transactionGroupId: `sd-txg-${charge.studentId.slice(-4)}`,
      occurredAt: charge.occurredAt,
      metadata: { feeCode: charge.fee.code, feeName: charge.fee.name, seeded: true },
    }));
  }

  const reversedRefs = new Set(plan.reversedPayments.map((p) => p.reference));

  // Successful payments (credits), oldest first for coherent chains.
  const orderedSuccess = [...plan.successPayments].sort((a, b) => b.daysAgo - a.daysAgo || a.reference.localeCompare(b.reference));
  const paymentTransactions: AnyRow[] = [];
  for (const p of orderedSuccess) {
    const paidAt = iso(daysBefore(anchor, p.daysAgo, 12, 15));
    paymentTransactions.push({
      id: `sd-txn-ok-${p.reference.slice(-6).toLowerCase()}`,
      school_id: DEMO_SCHOOL_ID,
      student_id: p.studentId,
      reference: p.reference,
      gateway_txn_ref: p.txnRef,
      provider_reference: `sandbox-ref-${p.txnRef.slice(-6)}`,
      amount_minor: p.amountMinor,
      amount: p.amountMinor / 100,
      currency: 'NGN',
      status: reversedRefs.has(p.reference) ? 'REVERSED' : 'SUCCESS',
      method: 'BANK_TRANSFER',
      gateway_provider: 'SANDBOX',
      settlement_status: reversedRefs.has(p.reference) ? 'REVERSED' : p.settled ? 'SETTLED' : 'PENDING',
      idempotency_key: `pay:${p.reference}`,
      provider_event_id: `evt-${p.txnRef.toLowerCase()}`,
      failure_reason: null,
      verified_at: paidAt,
      reversed_at: reversedRefs.has(p.reference) ? iso(daysBefore(anchor, Math.max(p.daysAgo - 2, 0), 15, 0)) : null,
      reversal_reason: reversedRefs.has(p.reference) ? 'Duplicate transfer — reversed by bursar (demo)' : null,
      paid_at: paidAt,
      created_at: paidAt,
      updated_at: paidAt,
      source: 'WEBHOOK',
      version: 1,
    });

    ledgerEntries.push(await buildEntry(p.studentId, {
      entryType: 'PAYMENT',
      direction: 'CREDIT',
      amountMinor: p.amountMinor,
      sourceDocumentType: 'PAYMENT',
      sourceDocumentId: p.reference,
      transactionGroupId: `sd-txg-${p.studentId.slice(-4)}`,
      occurredAt: paidAt,
      metadata: {
        paymentReference: p.reference,
        paymentMethod: 'BANK_TRANSFER',
        paymentGatewayReference: p.txnRef,
        verified: true,
        seeded: true,
      },
    }));
  }

  // Reversal entries (negating credits) — appended AFTER the original credits.
  for (const r of plan.reversedPayments) {
    const reversedAt = iso(daysBefore(anchor, Math.max(r.daysAgo - 2, 0), 15, 0));
    ledgerEntries.push(await buildEntry(r.studentId, {
      entryType: 'REVERSAL',
      direction: 'DEBIT',
      amountMinor: r.amountMinor,
      sourceDocumentType: 'ADJUSTMENT',
      sourceDocumentId: r.reference,
      transactionGroupId: `sd-txg-${r.studentId.slice(-4)}`,
      occurredAt: reversedAt,
      metadata: { reversesPaymentReference: r.reference, reason: 'Duplicate transfer (demo)' },
    }));
  }

  await target.payment_transactions.bulkPut(paymentTransactions as never[]);
  await target.payment_transactions.bulkPut([...plan.pendingPayments, ...plan.failedPayments] as never[]);
  await target.ledger_entries.bulkPut(ledgerEntries as never[]);

  // Settlement records for the settled subset (read-only cloud-mirror shape).
  const settlements: AnyRow[] = paymentTransactions
    .filter((t) => t.settlement_status === 'SETTLED')
    .slice(0, 40)
    .map((t, i) => ({
      id: `sd-stl-${pad(i + 1, 4)}`,
      payment_transaction_id: t.id,
      destination: `${DEMO_SCHOOL_NAME} Demo Settlement Account`,
      account_number: '******4410',
      bank_name: SANDBOX_BANK_NAME,
      amount: (t.amount_minor as number) / 100,
      settled_at: t.verified_at,
      raw_response: { provider: SANDBOX_GATEWAY_PROVIDER, seeded: true },
      source: 'SERVER',
      version: 1,
      updated_at: t.verified_at as string,
    }));
  await target.settlement_records.bulkPut(settlements as never[]);

  await target.notifications.bulkPut(plan.notifications as never[]);

  // ---- KYC / settlement / gateway / onboarding -------------------------------
  await target.kyc_records.put(({
    id: 'sd-kyc-main',
    school_id: DEMO_SCHOOL_ID,
    status: 'VERIFIED',
    principal_name: 'Amaka Obi',
    principal_phone: '+2348012340001',
    official_email: 'office@capflux-demoacademy.ng',
    official_phone: '+2348012340002',
    cac_registration_number: 'RN-DEMO-202401',
    bvn_encrypted: 'sandbox-marker:bvn',
    nin_encrypted: 'sandbox-marker:nin',
    bvn_last4: '4432',
    nin_last4: '8890',
    identity_match_states: { principal_nin: 'MATCH', principal_bvn: 'MATCH' },
    overall_match_state: 'MATCH',
    rejection_reason: null,
    business_type: 'SOLE proprietorship',
    submitted_at: iso(daysBefore(anchor, 43, 9, 5)),
    reviewed_at: iso(daysBefore(anchor, 42, 11, 20)),
    created_at: iso(daysBefore(anchor, 43, 9, 5)),
    updated_at: iso(daysBefore(anchor, 42, 11, 20)),
  }) as never);

  await target.settlement_accounts.put(({
    id: 'sd-setacc-main',
    school_id: DEMO_SCHOOL_ID,
    status: 'VERIFIED',
    bank_code: SANDBOX_BANK_CODE,
    bank_name: `${SANDBOX_BANK_NAME} MFB`,
    account_number_sandbox: '0123456789',
    account_number_last4: '6789',
    account_name: `${DEMO_SCHOOL_NAME} SCHOOL ACCOUNT`,
    bvn_last4: '4432',
    ownership_match_state: 'MATCH',
    rejection_reason: null,
    created_at: iso(daysBefore(anchor, 41, 10, 0)),
    updated_at: iso(daysBefore(anchor, 41, 14, 30)),
  }) as never);

  await target.gateway_assignments.put(({
    id: 'sd-gw-main',
    school_id: DEMO_SCHOOL_ID,
    provider: SANDBOX_GATEWAY_PROVIDER,
    status: 'ASSIGNED',
    assigned_at: iso(daysBefore(anchor, 40, 9, 0)),
    notes: 'Deterministic sandbox gateway (no live provider)',
    created_at: iso(daysBefore(anchor, 40, 9, 0)),
    updated_at: iso(daysBefore(anchor, 40, 9, 0)),
  }) as never);

  await target.onboarding_progress.put(({
    school_id: DEMO_SCHOOL_ID,
    profile_completed: true,
    organization_completed: true,
    school_completed: true,
    owner_completed: true,
    completed_at: iso(daysBefore(anchor, 43, 8, 45)),
    activated_at: iso(daysBefore(anchor, 40, 9, 5)),
    updated_at: iso(daysBefore(anchor, 40, 9, 5)),
  }) as never);

  await target.school_shareholders.bulkPut([    {
      id: 'sd-sh-1',
      school_id: DEMO_SCHOOL_ID,
      full_name: 'Amaka Obi',
      ownership_percentage: 60,
      role: 'Proprietress',
      phone: '+2348012340001',
      identity_nin_last4: '8890',
      created_at: iso(daysBefore(anchor, 43)),
    },
    {
      id: 'sd-sh-2',
      school_id: DEMO_SCHOOL_ID,
      full_name: 'Emeka Obi',
      ownership_percentage: 40,
      role: 'Director',
      phone: '+2348012340003',
      identity_nin_last4: '2211',
      created_at: iso(daysBefore(anchor, 43)),
    },
  ] as never[]);

  await target.principal_invitations.put(({
    id: 'sd-prin-inv-1',
    school_id: DEMO_SCHOOL_ID,
    email: 'principal@capflux-demoacademy.ng',
    name: 'Grace Adeyinka',
    role: 'PRINCIPAL',
    status: 'ACCEPTED',
    token: 'sandbox-invite-token-1',
    expires_at: iso(daysBefore(anchor, -30)),
    accepted: true,
    created_at: iso(daysBefore(anchor, 44)),
  }) as never);

  // Reconciliation history: two clean runs + one open mismatch issue.
  await target.reconciliation_runs.bulkPut([    {
      id: 'sd-recrun-1',
      school_id: DEMO_SCHOOL_ID,
      status: 'COMPLETED',
      provider: SANDBOX_GATEWAY_PROVIDER,
      transactions_checked: 96,
      matches_found: 96,
      mismatches_found: 0,
      run_at: iso(daysBefore(anchor, 7, 23, 5)),
      created_at: iso(daysBefore(anchor, 7, 23, 5)),
    },
    {
      id: 'sd-recrun-2',
      school_id: DEMO_SCHOOL_ID,
      status: 'COMPLETED',
      provider: SANDBOX_GATEWAY_PROVIDER,
      transactions_checked: 118,
      matches_found: 117,
      mismatches_found: 1,
      run_at: iso(daysBefore(anchor, 2, 23, 5)),
      created_at: iso(daysBefore(anchor, 2, 23, 5)),
    },
  ] as never[]);

  await target.reconciliation_issues.bulkPut([    {
      id: 'sd-reciss-1',
      school_id: DEMO_SCHOOL_ID,
      run_id: 'sd-recrun-2',
      reference: 'DEMO-PAY-000042',
      issue_type: 'AMOUNT_MISMATCH',
      severity: 'MEDIUM',
      detail: 'Gateway reported ₦52,000.00 vs ledger ₦51,850.00 (demo rounding scenario)',
      status: 'OPEN',
      resolution_note: null,
      created_at: iso(daysBefore(anchor, 2, 23, 6)),
      resolved_at: null,
    },
  ] as never[]);

  // Audit trail.
  await target.audit_trail.bulkPut(
    plan.auditActions.map((a, i) => ({
      id: `sd-aud-${pad(i + 1, 4)}`,
      school_id: DEMO_SCHOOL_ID,
      actor_id: a.action.startsWith('GATEWAY') || a.action.startsWith('PAYMENTS_ACTIVATED')
        ? 'demo-user-platform'
        : 'demo-user-owner',
      actor_role: a.action === 'PAYMENT_RECEIVED' ? 'BURSAR' : 'OWNER',
      action: a.action,
      entity: a.entity,
      entity_id: a.entityId,
      metadata: { seeded: true },
      occurred_at: iso(daysBefore(anchor, a.daysAgo, 11, 0)),
    })) as never[]);

  await target.app_settings.put({
    school_id: DEMO_SCHOOL_ID,
    sync_cursors_students_domain: {},
    sandbox_seeded: true,
    source: 'LOCAL',
    version: 1,
    updated_at: iso(anchor),
  } as never);

  // ---- Meta + summary ----------------------------------------------------------
  const ledgerCount = ledgerEntries.length;
  const datasetHash = summarizePlan(plan, ledgerCount);
  await target.sandbox_meta.bulkPut([    
    // `id` mirrors the logical key so test doubles keyed by `id` behave like
    // the real store (whose primary key is `key`).
    { key: 'seed_version', id: 'seed_version', value: SEED_VERSION, updated_at: iso(anchor) },
    { key: 'dataset_hash', id: 'dataset_hash', value: datasetHash, updated_at: iso(anchor) },
    { key: 'seed_anchor', id: 'seed_anchor', value: iso(anchor), updated_at: iso(anchor) },
  ] as never[]);

  return {
    students: plan.students.length,
    guardians: plan.guardians.length,
    payments: plan.successPayments.length + plan.pendingPayments.length + plan.failedPayments.length,
    ledgerEntries: ledgerCount,
    datasetHash,
    seededAt: iso(anchor),
  };
}

/** Stable content digest — equal plans ⇒ equal hashes (determinism contract). */
function summarizePlan(plan: SeedPlan, ledgerCount: number): string {
  const parts = [
    plan.students.map((s) => `${s.id}:${s.firstName}:${s.lastName}:${s.levelIndex}`).join(','),
    plan.guardians.map((g) => String(g.id)).join(','),
    plan.successPayments.map((p) => `${p.reference}:${p.studentId}:${p.amountMinor}:${p.kind}`).join(','),
    plan.charges.map((c) => `${c.chargeId}:${c.fee.amountMinor}`).join(','),
    `ledger=${ledgerCount}`,
  ];
  const payload = parts.join('|');
  return `fnv1a-${stableHash(payload).toString(16)}`;
}

async function clearAllTables(target: SandboxCapfluxDB): Promise<void> {
  const tableNames = target.tables.map((t) => t.name);
  for (const name of tableNames) {
    await target.table(name).clear();
  }
}
