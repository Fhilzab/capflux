/**
 * SandboxApiServer — an in-browser simulation of the CAPFLUX Express API.
 *
 * Requests never reach the network: a custom axios adapter (see
 * ./axiosAdapter.ts) dispatches apiClient calls to this router, which
 * reproduces backend semantics against the isolated sandbox database:
 *
 *  - authentication: every endpoint requires an active demo session
 *    (mirroring requireAuthSupabase); identity comes ONLY from the session.
 *  - tenant isolation: school-scoped endpoints resolve the caller's
 *    membership; client-supplied foreign school ids are rejected (403).
 *  - progressive access: money-touching endpoints enforce payment readiness
 *    exactly like requirePaymentReady (403 PAYMENT_ACTIVATION_REQUIRED).
 *  - state machines: KYC UNDER_REVIEW→VERIFIED|REJECTED, payments
 *    PENDING→SUCCESS|FAILED, SUCCESS→REVERSED only.
 *  - idempotency: unique references for DVAs, transactions and ledger posts.
 *  - masked egress: account numbers/BVN/NIN leave as ****last4 or last4.
 *  - audit: financial events append to the sandbox audit trail.
 *  - offline: when the runtime toggle is OFF requests fail without a
 *    response (network-error shape) while local-first writes keep queueing.
 *
 * This is sandbox-only infrastructure: constructing it outside sandbox mode
 * fails closed.
 */

import type { AxiosRequestConfig } from 'axios';
import { getSandboxDb } from '../sandboxDb';
import { runtimeEnvironment } from '../../shared/environment/runtimeEnvironment';
import { assertSandboxMode } from '../runtime/sandboxGuard';
import { SandboxOfflineError, sandboxRuntime } from '../runtime/sandboxRuntime';
import { getSandboxAuthProvider } from '../session/sandboxAuth';
import {
  DEMO_ORG_ID,
  DEMO_SCHOOL_ID,
  DEMO_SCHOOL_NAME,
  PERSONA_PERMISSIONS,
} from '../seed/demoData';
import {
  postReversalForPayment,
  postVerifiedPaymentCredit,
} from './ledgerWriter';

// ---------------------------------------------------------------------------
// Types & helpers
// ---------------------------------------------------------------------------

type Json = Record<string, unknown>;

export interface SandboxResponse {
  status: number;
  data: Json;
}

class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

const nowIso = (): string => new Date().toISOString();

function maskAccount(accountNumber: string): string {
  return `******${accountNumber.slice(-4)}`;
}

function maskLast4(last4: string | null | undefined): string | null {
  return last4 ? `****-****-****-${last4}` : null;
}

interface RouteMatch {
  params: Record<string, string>;
}

interface RouteDef {
  method: string;
  pattern: string[];
  handler: (ctx: {
    // Request bodies arrive JSON-parsed from the axios adapter.
    body: Record<string, unknown> | null;
    query: URLSearchParams;
    params: Record<string, string>;
    persona: ReturnType<typeof getSessionPersona>;
  }) => Promise<Json> | Json;
}

function getSessionPersona() {
  const provider = getSandboxAuthProvider();
  return provider.getPersona();
}

function requireAuth(): NonNullable<ReturnType<typeof getSessionPersona>> {
  const persona = getSessionPersona();
  if (!persona) throw new HttpError(401, 'Authentication required');
  return persona;
}

/** Tenant guard: platform staff operate cross-school; others are pinned to the demo school. */
function resolveCallerSchoolId(persona: NonNullable<ReturnType<typeof getSessionPersona>>, requested?: unknown): string {
  if (persona.platformStaff) {
    // Platform staff act on the demo tenant explicitly.
    return typeof requested === 'string' && requested ? requested : DEMO_SCHOOL_ID;
  }
  const callerSchool = DEMO_SCHOOL_ID;
  if (
    typeof requested === 'string' &&
    requested &&
    requested !== callerSchool
  ) {
    throw new HttpError(403, 'Cross-school access is not permitted.');
  }
  return callerSchool;
}

function requirePermission(persona: NonNullable<ReturnType<typeof getSessionPersona>>, permission: string): void {
  const granted =
    PERSONA_PERMISSIONS[persona.systemRole] ?? PERSONA_PERMISSIONS.STAFF ?? [];
  const extra = persona.platformStaff ? PERSONA_PERMISSIONS.PLATFORM : [];
  if (!granted.includes(permission) && !(extra ?? []).includes(permission)) {
    throw new HttpError(403, `Missing permission: ${permission}`);
  }
}

async function writeAudit(
  db: ReturnType<typeof getSandboxDb>,
  actorId: string,
  actorRole: string,
  action: string,
  entity: string,
  entityId: string | null,
  metadata: Json = {},
): Promise<void> {
  // Every sandbox audit record is explicitly labelled so sandbox activity is
  // distinguishable from production audit semantics.
  await db.audit_trail.add({
    id: crypto.randomUUID(),
    school_id: DEMO_SCHOOL_ID,
    actor_id: actorId,
    actor_role: actorRole,
    action,
    entity,
    entity_id: entityId,
    metadata: { environment: 'sandbox', ...metadata },
    occurred_at: nowIso(),
  });
}

async function pushNotification(db: ReturnType<typeof getSandboxDb>, row: Json): Promise<void> {
  await db.notifications.put({
    client_sequence: 0,
    device_id: 'sandbox-api',
    source: 'SERVER',
    version: 1,
    read: false,
    ...row,
  } as never);
  sandboxRuntime.emit('notification-created', row);
}

async function getSchoolRow(db: ReturnType<typeof getSandboxDb>): Promise<Json> {
  return ((await db.schools.get(DEMO_SCHOOL_ID)) ?? {}) as Json;
}

/** Mirrors PaymentActivationService.checkReadiness(). */
async function computeReadiness(db: ReturnType<typeof getSandboxDb>): Promise<Json> {
  const [school, kyc, settlement, gateway] = await Promise.all([
    db.schools.get(DEMO_SCHOOL_ID),
    db.kyc_records.where('school_id').equals(DEMO_SCHOOL_ID).first(),
    db.settlement_accounts.where('school_id').equals(DEMO_SCHOOL_ID).first(),
    db.gateway_assignments.where('school_id').equals(DEMO_SCHOOL_ID).first(),
  ]);
  const conditions = {
    school_active: school?.status === 'ACTIVE',
    kyc_verified: kyc?.status === 'VERIFIED',
    settlement_verified: settlement?.status === 'VERIFIED',
    gateway_assigned: Boolean(gateway && gateway.status !== 'SUSPENDED'),
  };
  const ready = Object.values(conditions).every(Boolean);
  let reason: string | null = null;
  if (!conditions.school_active) reason = 'School profile is not active yet.';
  else if (!conditions.kyc_verified) reason = 'Complete KYC verification.';
  else if (!conditions.settlement_verified) reason = 'Verify your settlement account.';
  else if (!conditions.gateway_assigned) reason = 'A payment gateway has not been assigned yet.';
  return {
    ready,
    reason,
    conditions,
    school: { id: DEMO_SCHOOL_ID, status: school?.status ?? null, paymentStatus: school?.payment_status ?? null },
  };
}

/** Mirrors requirePaymentReady — money routes refuse unactivated tenants. */
async function requirePaymentReady(db: ReturnType<typeof getSandboxDb>): Promise<void> {
  const readiness = (await computeReadiness(db)) as { ready: boolean; reason: string | null };
  if (!readiness.ready) {
    throw new HttpError(403, 'PAYMENT_ACTIVATION_REQUIRED');
  }
}

function ensureOnline(): void {
  if (!sandboxRuntime.isOnline()) throw new SandboxOfflineError();
}

// ---------------------------------------------------------------------------
// Financial math helpers (kobo integers only)
// ---------------------------------------------------------------------------

async function listStudentTransactions(db: ReturnType<typeof getSandboxDb>, schoolId: string, studentId?: string) {
  const rows = (await db.payment_transactions.where('school_id').equals(schoolId).toArray()) as Json[];
  const filtered = studentId ? rows.filter((r) => r.student_id === studentId) : rows;
  return filtered.sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')));
}

async function buildPaymentsSummary(db: ReturnType<typeof getSandboxDb>, schoolId: string): Promise<Json> {
  const rows = await listStudentTransactions(db, schoolId);
  const byStatus = (status: string): number => rows.filter((r) => r.status === status).length;
  const successfulMinor = rows
    .filter((r) => r.status === 'SUCCESS')
    .reduce((sum, r) => sum + Number(r.amount_minor ?? 0), 0);

  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const verifiedAtOf = (r: Json): Date => new Date(String(r.verified_at ?? r.paid_at ?? r.created_at ?? 0));
  const todayMinor = rows
    .filter((r) => r.status === 'SUCCESS' && verifiedAtOf(r) >= dayStart)
    .reduce((sum, r) => sum + Number(r.amount_minor ?? 0), 0);
  const monthMinor = rows
    .filter((r) => r.status === 'SUCCESS' && verifiedAtOf(r) >= monthStart)
    .reduce((sum, r) => sum + Number(r.amount_minor ?? 0), 0);

  return {
    total_payments: rows.length,
    successful_payments: byStatus('SUCCESS'),
    pending_payments: byStatus('PENDING'),
    failed_payments: byStatus('FAILED'),
    reversed_payments: byStatus('REVERSED'),
    total_collected_minor: successfulMinor,
    today_collections_minor: todayMinor,
    month_collections_minor: monthMinor,
  };
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

const routes: RouteDef[] = [];

function route(method: string, pattern: string, handler: RouteDef['handler']): void {
  routes.push({ method, pattern: pattern.split('/').filter(Boolean), handler });
}

function matchRoute(method: string, pathSegments: string[]): { def: RouteDef; params: Record<string, string> } | null {
  for (const def of routes) {
    if (def.method !== method || def.pattern.length !== pathSegments.length) continue;
    const params: Record<string, string> = {};
    let matched = true;
    for (let i = 0; i < def.pattern.length; i++) {
      const spec = def.pattern[i]!;
      const actual = pathSegments[i]!;
      if (spec.startsWith(':')) params[spec.slice(1)] = decodeURIComponent(actual);
      else if (spec !== actual) {
        matched = false;
        break;
      }
    }
    if (matched) return { def, params };
  }
  return null;
}

// ===== Context ==============================================================

route('GET', '/context/me', async ({ persona }) => {
  const p = requireAuth();
  void persona;
  return { data: { user: { id: p.id, email: p.email, name: p.fullName, role: p.systemRole }, mode: 'sandbox' } };
});

route('GET', '/context/org', async () => {
  const persona = requireAuth();
  return {
    data: {
      organization: {
        id: DEMO_ORG_ID,
        name: `${DEMO_SCHOOL_NAME} Group`,
        slug: 'capflux-demo-academy',
        created_at: '2025-08-01T08:00:00.000Z',
        updated_at: nowIso(),
      },
      membership: {
        organizationId: DEMO_ORG_ID,
        role: { system_role: persona.platformStaff ? 'ADMIN' : persona.systemRole },
        joinedAt: '2025-08-01T08:00:00.000Z',
      },
    },
  };
});

route('GET', '/context/school', async () => {
  requireAuth();
  const db = getSandboxDb();
  const school = await getSchoolRow(db);
  return { data: { school } };
});

route('GET', '/context/rbac', async ({ persona }) => {
  const p = requireAuth();
  void persona;
  const permissions = [
    ...new Set([
      ...(PERSONA_PERMISSIONS[p.systemRole] ?? []),
      ...(p.platformStaff ? PERSONA_PERMISSIONS.PLATFORM : []),
    ]),
  ];
  return {
    data: {
      membership: {
        id: `sbx-membership-${p.id}`,
        schoolId: DEMO_SCHOOL_ID,
        roleId: `sbx-role-${p.role.toLowerCase()}`,
        role: { id: `sbx-role-${p.role.toLowerCase()}`, name: p.role, system_role: p.role === 'STAFF' ? 'STAFF' : p.role, is_system_role: true },
        joinedAt: '2025-08-01T08:00:00.000Z',
      },
      roles: [p.role],
      permissions,
    },
  };
});

route('GET', '/context', async ({ persona }) => {
  const p = requireAuth();
  void persona;
  const db = getSandboxDb();
  return {
    data: {
      user: { id: p.id, email: p.email, name: p.fullName },
      organization: { id: DEMO_ORG_ID, name: `${DEMO_SCHOOL_NAME} Group` },
      school: await getSchoolRow(db),
    },
  };
});

// ===== Onboarding ===========================================================

route('GET', '/onboarding/status', async () => {
  requireAuth();
  const db = getSandboxDb();
  const progress = await db.onboarding_progress.get(DEMO_SCHOOL_ID);
  const school = await getSchoolRow(db);
  return {
    data: {
      has_school: true,
      school_id: DEMO_SCHOOL_ID,
      profile_completed: true,
      organization_completed: true,
      school_completed: true,
      owner_completed: progress?.owner_completed ?? true,
      completed_at: progress?.completed_at ?? null,
      activated_at: progress?.activated_at ?? null,
      school_name: (school.name as string) ?? DEMO_SCHOOL_NAME,
      school_slug: (school.slug as string) ?? 'capflux-demo-academy',
      school_status: (school.status as string) ?? 'ACTIVE',
      payment_status: (school.payment_status as string) ?? 'NOT_READY',
      organization_id: DEMO_ORG_ID,
      business_type: 'SOLE proprietorship',
    },
  };
});

route('GET', '/onboarding/profile', async () => {
  requireAuth();
  return {
    data: {
      firstName: 'Amaka', lastName: 'Obi', middleName: '',
      phone: '+2348012340001', dateOfBirth: '1985-04-12', country: 'Nigeria',
      state: 'Lagos', lga: 'Ikeja', residentialAddress: '1 Unity Road, Ikeja',
    },
  };
});

route('POST', '/onboarding/profile', async ({ body }) => {
  requireAuth();
  if (!body?.firstName || !body?.lastName) throw new HttpError(400, 'First and last name are required');
  return { success: true, data: { saved: true } };
});

route('POST', '/onboarding/organization', async () => ({ success: true, data: { saved: true } }));
route('PUT', '/onboarding/business-type', async ({ body }) => {
  requireAuth();
  const allowed = ['SOLE proprietorship', 'Partnership', 'Limited Liability Company'];
  if (!allowed.includes(String(body?.businessType))) throw new HttpError(400, 'Invalid business type');
  return { success: true, data: { saved: true } };
});
route('POST', '/onboarding/school', async () => ({ success: true, data: { saved: true } }));
route('POST', '/onboarding/owner-info', async () => ({ success: true, data: { saved: true } }));
route('POST', '/onboarding/save-progress', async () => ({ success: true }));
route('POST', '/onboarding/complete', async () => {
  requireAuth();
  const db = getSandboxDb();
  const school = await getSchoolRow(db);
  return { data: { school, activated: school.payment_status === 'READY' } };
});

// ===== Providers (public posture, no secrets) ================================

route('GET', '/providers/status', async () => ({
  data: {
    paymentsMode: 'sandbox',
    providers: {
      sandbox: {
        provider: 'sandbox',
        environment: 'sandbox',
        configured: true,
        status: 'ACTIVE',
        providerRegistered: true,
        capabilities: {},
        productionReady: false,
      },
    },
  },
}));

// ===== Payments / DVA / Operations ==========================================

route('GET', '/payments', async ({ query }) => {
  const persona = requireAuth();
  const db = getSandboxDb();
  const schoolId = resolveCallerSchoolId(persona, query.get('school_id'));
  const studentId = query.get('student_id') ?? undefined;
  const rows = await listStudentTransactions(db, schoolId, studentId ?? undefined);
  const students = await db.students.where('school_id').equals(schoolId).toArray();
  const nameById = new Map(students.map((s) => [s.id, `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim()]));
  return {
    data: rows.map((r) => ({ ...r, student_name: nameById.get(String(r.student_id)) ?? '' })),
  };
});

route('GET', '/payments/summary', async ({ query }) => {
  const persona = requireAuth();
  const db = getSandboxDb();
  const schoolId = resolveCallerSchoolId(persona, query.get('school_id'));
  return { data: await buildPaymentsSummary(db, schoolId) };
});

route('GET', '/payments/student/:studentId', async ({ params }) => {
  const persona = requireAuth();
  const db = getSandboxDb();
  const schoolId = resolveCallerSchoolId(persona);
  return { data: await listStudentTransactions(db, schoolId, params.studentId) };
});

route('POST', '/payments/intent', async ({ body }) => {
  const persona = requireAuth();
  requirePermission(persona, 'payments.receive');
  const db = getSandboxDb();
  await requirePaymentReady(db);
  const amountMinor = Number(body?.amountMinor ?? body?.amount_minor ?? 0);
  if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
    throw new HttpError(400, 'amountMinor must be a positive integer of kobo');
  }
  const reference = body?.reference ?? `DEMO-PAY-${Date.now() % 1000000}`;
  const existing = await db.payment_transactions.where('reference').equals(reference).first();
  if (existing) return { data: existing };
  const txn = {
    id: crypto.randomUUID(),
    school_id: DEMO_SCHOOL_ID,
    student_id: String(body.studentId ?? ''),
    reference,
    gateway_txn_ref: `SANDBOX-TXN-${crypto.randomUUID().slice(0, 8)}`,
    provider_reference: null,
    amount_minor: amountMinor,
    amount: amountMinor / 100,
    currency: 'NGN',
    status: 'PENDING',
    method: String(body.method ?? 'BANK_TRANSFER'),
    gateway_provider: 'SANDBOX',
    settlement_status: 'PENDING',
    failure_reason: null,
    verified_at: null,
    created_at: nowIso(),
    updated_at: nowIso(),
    source: 'LOCAL',
    version: 1,
  };
  await db.payment_transactions.put(txn as never);
  await writeAudit(db, persona.id, persona.role, 'PAYMENT_INTENT_CREATED', 'payment_transactions', reference, { amount_minor: amountMinor });
  return { data: txn };
});

route('POST', '/payments/:id/reverse', async ({ params, body }) => {
  const persona = requireAuth();
  requirePermission(persona, 'payments.reconcile');
  const db = getSandboxDb();
  const txn = (await db.payment_transactions.get(params.id!)) as Json | undefined;
  if (!txn) throw new HttpError(404, 'Transaction not found');
  if (txn.status !== 'SUCCESS') {
    throw new HttpError(409, `Only SUCCESS transactions can be reversed (current: ${txn.status})`);
  }
  const reversal = await postReversalForPayment({
    studentId: String(txn.student_id),
    originalReference: String(txn.reference),
    reason: String(body?.reason ?? 'Reversed by staff (demo)'),
    occurredAt: nowIso(),
    createdBy: persona.id,
  });
  if (!reversal.ok && reversal.code === 'LEDGER_ENTRY_NOT_FOUND') {
    throw new HttpError(409, reversal.message);
  }
  txn.status = 'REVERSED';
  txn.settlement_status = 'REVERSED';
  txn.reversed_at = nowIso();
  txn.reversal_reason = String(body?.reason ?? 'Reversed by staff (demo)');
  await db.payment_transactions.put(txn as never);
  await writeAudit(db, persona.id, persona.role, 'PAYMENT_REVERSED', 'payment_transactions', String(txn.reference), {});
  await pushNotification(db, {
    id: crypto.randomUUID(),
    school_id: DEMO_SCHOOL_ID,
    student_id: txn.student_id,
    guardian_id: null,
    recipient_phone: null,
    message_body: `Payment ${txn.reference} of ₦${Number(txn.amount).toLocaleString('en-NG')} was reversed.`,
    delivery_method: 'IN_APP',
    delivery_status: 'DELIVERED',
    created_at: nowIso(),
    updated_at: nowIso(),
  });
  return { data: txn };
});

route('GET', '/dva', async ({ query }) => {
  const persona = requireAuth();
  const db = getSandboxDb();
  const schoolId = resolveCallerSchoolId(persona, query.get('school_id'));
  const rows = (await db.payment_accounts.where('school_id').equals(schoolId).toArray()) as Json[];
  const students = await db.students.where('school_id').equals(schoolId).toArray();
  const nameById = new Map(students.map((s) => [s.id, `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim()]));
  return {
    data: rows.map((r) => ({
      ...r,
      virtual_account_number: r.virtual_account_number ? maskAccount(String(r.virtual_account_number)) : null,
      student_name: nameById.get(String(r.student_id)) ?? '',
    })),
  };
});

route('POST', '/dva/provision', async ({ body }) => {
  const persona = requireAuth();
  requirePermission(persona, 'billing.create');
  const db = getSandboxDb();
  await requirePaymentReady(db);
  const studentId = String(body?.student_id ?? '');
  const student = await db.students.get(studentId);
  if (!student) throw new HttpError(404, 'Student not found');

  // Idempotent: one DVA per student.
  const existing = (await db.payment_accounts.where('student_id').equals(studentId).first()) as Json | undefined;
  if (existing) {
    return { data: { ...existing, virtual_account_number: maskAccount(String(existing.virtual_account_number)), reused: true } };
  }

  const allAccounts = (await db.payment_accounts.toArray()) as Json[];
  const nextSeq = allAccounts.length + 1;
  const accountNumber = `100${String(nextSeq).padStart(7, '0')}`;
  const accountName = `${student.first_name} ${student.last_name} — CAPFLUX DEMO ACADEMY`;
  const row = {
    id: crypto.randomUUID(),
    school_id: DEMO_SCHOOL_ID,
    student_id: studentId,
    provider: 'sandbox',
    provider_account_id: `sbx-cust-${nextSeq}`,
    provider_reference: `sbx-dva-ref-${nextSeq}`,
    virtual_account_number: accountNumber,
    account_name: accountName,
    bank_name: 'CAPFLUX Demo Bank',
    account_status: 'ACTIVE',
    is_primary: true,
    idempotency_key: `sbx-dva-${studentId}`,
    created_at: nowIso(),
    updated_at: nowIso(),
    source: 'LOCAL',
    version: 1,
  };
  await db.payment_accounts.put(row as never);
  await writeAudit(db, persona.id, persona.role, 'DVA_PROVISIONED', 'payment_accounts', row.id, { student_id: studentId, dva_last4: accountNumber.slice(-4) });
  return { data: { ...row, virtual_account_number: maskAccount(accountNumber) } };
});

route('POST', '/dva/:id/deactivate', async ({ params }) => {
  const persona = requireAuth();
  requirePermission(persona, 'billing.create');
  const db = getSandboxDb();
  const row = await db.payment_accounts.get(params.id!);
  if (!row) throw new HttpError(404, 'Virtual account not found');
  if (row.account_status !== 'ACTIVE') throw new HttpError(409, 'Account is not active');
  row.account_status = 'INACTIVE';
  row.updated_at = nowIso();
  await db.payment_accounts.put(row as never);
  await writeAudit(db, persona.id, persona.role, 'DVA_DEACTIVATED', 'payment_accounts', row.id, {});
  return { data: { deactivated: true } };
});

// Legacy payment-accounts surface (shared/services/PaymentGateway.ts).
route('GET', '/payment-accounts/:studentId', async ({ params, query }) => {
  const persona = requireAuth();
  const db = getSandboxDb();
  resolveCallerSchoolId(persona, query.get('school_id'));
  const row = (await db.payment_accounts.where('student_id').equals(params.studentId!).first()) as Json | undefined;
  if (!row) throw new HttpError(404, 'No virtual account for this student yet');
  return { data: { payment_account: { ...row, virtual_account_number: maskAccount(String(row.virtual_account_number)) } } };
});
route('POST', '/payment-accounts/provision', async function provisionAlias(ctx) {
  const handler = matchRoute('POST', ['dva', 'provision']);
  const json = await handler!.def.handler({ ...ctx, params: {} });
  return json;
});
route('POST', '/payment-accounts/deactivate', async (ctx) => {
  const accountId = String(ctx.body?.account_id ?? '');
  const handler = matchRoute('POST', ['dva', ':id', 'deactivate']);
  return handler!.def.handler({ ...ctx, params: { id: accountId } });
});

route('GET', '/operations/settlements', async ({ query }) => {
  const persona = requireAuth();
  const db = getSandboxDb();
  resolveCallerSchoolId(persona, query.get('school_id'));
  const rows = (await db.settlement_records.toArray()) as Json[];
  return { data: rows.sort((a, b) => String(b.settled_at ?? '').localeCompare(String(a.settled_at ?? ''))) };
});

route('GET', '/operations/settlements/summary', async ({ query }) => {
  const persona = requireAuth();
  const db = getSandboxDb();
  resolveCallerSchoolId(persona, query.get('school_id'));
  const rows = (await db.settlement_records.toArray()) as Json[];
  const settledMinor = rows.reduce((sum, r) => sum + Math.round(Number(r.amount ?? 0) * 100), 0);
  return {
    data: {
      total: rows.length,
      pending: 0,
      successful: rows.filter((r) => r.source === 'SERVER').length,
      failed: 0,
      settled_minor: settledMinor,
    },
  };
});

route('GET', '/operations/reconciliation', async ({ query }) => {
  const persona = requireAuth();
  const db = getSandboxDb();
  resolveCallerSchoolId(persona, query.get('school_id'));
  const runs = (await db.reconciliation_runs.where('school_id').equals(DEMO_SCHOOL_ID).toArray()) as Json[];
  const issues = (await db.reconciliation_issues.where('school_id').equals(DEMO_SCHOOL_ID).toArray()) as Json[];
  return { data: { runs: runs.reverse(), open_issues: issues.filter((i) => i.status === 'OPEN') } };
});

route('POST', '/operations/reconciliation/run', async () => {
  const persona = requireAuth();
  requirePermission(persona, 'payments.reconcile');
  const db = getSandboxDb();
  ensureOnline();
  const txns = (await db.payment_transactions.where('school_id').equals(DEMO_SCHOOL_ID).toArray()) as Json[];
  const successes = txns.filter((t) => t.status === 'SUCCESS');
  const run = {
    id: crypto.randomUUID(),
    school_id: DEMO_SCHOOL_ID,
    status: 'COMPLETED',
    provider: 'sandbox',
    transactions_checked: successes.length,
    matches_found: successes.length,
    mismatches_found: 0,
    run_at: nowIso(),
    created_at: nowIso(),
  };
  await db.reconciliation_runs.add(run as never);
  await writeAudit(db, persona.id, persona.role, 'RECONCILIATION_COMPLETED', 'reconciliation_runs', run.id, { checked: successes.length });
  return { data: run };
});

route('POST', '/operations/reconciliation/issues/:id/resolve', async ({ params, body }) => {
  const persona = requireAuth();
  requirePermission(persona, 'payments.reconcile');
  const db = getSandboxDb();
  const issue = await db.reconciliation_issues.get(params.id!);
  if (!issue) throw new HttpError(404, 'Issue not found');
  issue.status = 'RESOLVED';
  issue.resolution_note = String(body?.note ?? 'Resolved by staff (demo)');
  issue.resolved_at = nowIso();
  await db.reconciliation_issues.put(issue);
  await writeAudit(db, persona.id, persona.role, 'RECONCILIATION_ISSUE_RESOLVED', 'reconciliation_issues', issue.id, {});
  return { data: issue };
});

// ===== KYC ==================================================================

function kycStatusPayload(record: Json | undefined): Json {
  if (!record) return { status: 'NOT_STARTED' };
  return {
    status: record.status,
    principal_name: record.principal_name,
    principal_phone: record.principal_phone,
    official_email: record.official_email,
    official_phone: record.official_phone,
    cac_registration_number: record.cac_registration_number,
    bvn_last4: record.bvn_last4,
    nin_last4: record.nin_last4,
    identity_match_states: record.identity_match_states ?? {},
    overall_match_state: record.overall_match_state ?? 'UNKNOWN',
    rejection_reason: record.rejection_reason,
    business_type: record.business_type,
    submitted_at: record.submitted_at,
    reviewed_at: record.reviewed_at,
  };
}

route('GET', '/kyc/status', async () => {
  requireAuth();
  const db = getSandboxDb();
  const record = await db.kyc_records.where('school_id').equals(DEMO_SCHOOL_ID).first();
  return { data: kycStatusPayload(record as Json | undefined) };
});

route('POST', '/kyc/submit', async ({ body }) => {
  const persona = requireAuth();
  requirePermission(persona, persona.platformStaff ? 'kyc.view' : 'kyc.submit');
  const db = getSandboxDb();
  const bvn = String(body?.bvn ?? '');
  const nin = String(body?.nin ?? '');
  if (!/^\d{11}$/.test(bvn) || !/^\d{11}$/.test(nin)) {
    throw new HttpError(400, 'BVN and NIN must be exactly 11 digits');
  }
  const existing = await db.kyc_records.where('school_id').equals(DEMO_SCHOOL_ID).first();
  const record = {
    id: existing?.id ?? crypto.randomUUID(),
    school_id: DEMO_SCHOOL_ID,
    status: 'UNDER_REVIEW',
    principal_name: String(body.principalName ?? ''),
    principal_phone: String(body.principalPhone ?? ''),
    official_email: body?.officialEmail ? String(body.officialEmail) : null,
    official_phone: body?.officialPhone ? String(body.officialPhone) : null,
    cac_registration_number: body?.cacRegistrationNumber ? String(body.cacRegistrationNumber) : null,
    // Production encrypts with AES-256-GCM; sandbox stores a non-reversible marker.
    bvn_encrypted: 'sandbox-marker:bvn',
    nin_encrypted: 'sandbox-marker:nin',
    bvn_last4: bvn.slice(-4),
    nin_last4: nin.slice(-4),
    identity_match_states: { principal_nin: 'MATCH', principal_bvn: 'MATCH' },
    overall_match_state: 'MATCH',
    rejection_reason: null,
    business_type: body?.businessType ?? null,
    submitted_at: nowIso(),
    reviewed_at: null,
    created_at: existing?.created_at ?? nowIso(),
    updated_at: nowIso(),
  };
  await db.kyc_records.put(record as never);
  await writeAudit(db, persona.id, persona.role, 'KYC_SUBMITTED', 'kyc_records', record.id, { bvn_last4: bvn.slice(-4), nin_last4: nin.slice(-4) });
  return { data: kycStatusPayload(record) };
});

route('POST', '/kyc/resubmit', async ({ body }) => {
  const persona = requireAuth();
  requirePermission(persona, 'kyc.submit');
  const db = getSandboxDb();
  const existing = await db.kyc_records.where('school_id').equals(DEMO_SCHOOL_ID).first();
  if (!existing) throw new HttpError(404, 'No KYC submission to resubmit');
  if (existing.status === 'VERIFIED') throw new HttpError(409, 'KYC already verified');
  existing.status = 'UNDER_REVIEW';
  existing.rejection_reason = null;
  if (body?.principalName) existing.principal_name = String(body.principalName);
  existing.updated_at = nowIso();
  await db.kyc_records.put(existing);
  await writeAudit(db, persona.id, persona.role, 'KYC_RESUBMITTED', 'kyc_records', existing.id, {});
  return { data: kycStatusPayload(existing) };
});

route('GET', '/kyc/documents', async () => {
  requireAuth();
  const db = getSandboxDb();
  const docs = (await db.kyc_documents.where('school_id').equals(DEMO_SCHOOL_ID).toArray()) as Json[];
  const cac = [...docs].reverse().find((d) => d.kind === 'CAC') ?? null;
  return { data: { cacDocument: cac } };
});

route('POST', '/kyc/documents/cac', async ({ body, query }) => {
  const persona = requireAuth();
  requirePermission(persona, 'kyc.submit');
  const db = getSandboxDb();
  const filename = query.get('filename') ?? 'cac-document.pdf';
  const mimetype = query.get('mimetype') ?? 'application/pdf';
  const size = body instanceof Uint8Array || body instanceof ArrayBuffer ? (body as Uint8Array).byteLength ?? 0 : 2048;
  const doc = {
    id: crypto.randomUUID(),
    school_id: DEMO_SCHOOL_ID,
    kind: 'CAC',
    filename,
    mime_type: mimetype,
    file_size: size,
    checksum: `sha256-${crypto.randomUUID().replaceAll('-', '').slice(0, 32)}`,
    storage_path: `sandbox/kyc/${DEMO_SCHOOL_ID}/${filename}`,
    status: 'UPLOADED',
    uploaded_at: nowIso(),
  };
  await db.kyc_documents.add(doc as never);
  await writeAudit(db, persona.id, persona.role, 'CAC_DOCUMENT_UPLOADED', 'kyc_documents', doc.id, { filename });
  return { data: { document: doc } };
});

route('GET', '/kyc/history', async () => {
  requireAuth();
  const db = getSandboxDb();
  const record = await db.kyc_records.where('school_id').equals(DEMO_SCHOOL_ID).first();
  const history: Json[] = [];
  if (record) {
    history.push({ event: 'SUBMITTED', at: record.submitted_at });
    if (record.status === 'VERIFIED' || record.status === 'REJECTED') {
      history.push({ event: record.status, at: record.reviewed_at });
    }
  }
  return { data: history };
});

route('GET', '/kyc/settlement', async () => {
  requireAuth();
  const db = getSandboxDb();
  const [row, gateway] = await Promise.all([
    db.settlement_accounts.where('school_id').equals(DEMO_SCHOOL_ID).first(),
    db.gateway_assignments.where('school_id').equals(DEMO_SCHOOL_ID).first(),
  ]);
  return {
    data: {
      settlement: row
        ? {
            bank_code: row.bank_code,
            bank_name: row.bank_name,
            account_number_last4: row.account_number_last4,
            account_name: row.account_name,
            bvn_last4: row.bvn_last4,
            ownership_match_status: row.ownership_match_state,
            status: row.status,
            rejection_reason: row.rejection_reason,
          }
        : null,
      gateway: gateway
        ? { provider: gateway.provider, status: gateway.status, assigned_at: gateway.assigned_at }
        : null,
    },
  };
});

route('POST', '/kyc/settlement', async ({ body }) => {
  const persona = requireAuth();
  requirePermission(persona, 'settlement.manage');
  const db = getSandboxDb();
  const kyc = await db.kyc_records.where('school_id').equals(DEMO_SCHOOL_ID).first();
  if (kyc?.status !== 'VERIFIED') throw new HttpError(403, 'KYC verification is required before settlement setup');
  const accountNumber = String(body?.accountNumber ?? '');
  if (!/^\d{10}$/.test(accountNumber)) throw new HttpError(400, 'Account number must be 10 digits');
  const bankCode = String(body?.bankCode ?? '');
  if (!bankCode) throw new HttpError(400, 'Bank code is required');
  const existing = await db.settlement_accounts.where('school_id').equals(DEMO_SCHOOL_ID).first();
  const row = {
    id: existing?.id ?? crypto.randomUUID(),
    school_id: DEMO_SCHOOL_ID,
    status: 'PENDING_VERIFICATION',
    bank_code: bankCode,
    bank_name: `Demo Bank ${bankCode}`,
    account_number_sandbox: accountNumber,
    account_number_last4: accountNumber.slice(-4),
    account_name: `${DEMO_SCHOOL_NAME} SCHOOL ACCOUNT`,
    bvn_last4: body?.bvn && /^\d{11}$/.test(String(body.bvn)) ? String(body.bvn).slice(-4) : kyc.bvn_last4,
    ownership_match_state: 'MATCH',
    rejection_reason: null,
    created_at: existing?.created_at ?? nowIso(),
    updated_at: nowIso(),
  };
  await db.settlement_accounts.put(row);
  await writeAudit(db, persona.id, persona.role, 'SETTLEMENT_ACCOUNT_SUBMITTED', 'settlement_accounts', row.id, { account_last4: row.account_number_last4 });
  return { data: { submitted: true } };
});

route('GET', '/kyc/shareholders', async () => {
  requireAuth();
  const db = getSandboxDb();
  const rows = await db.school_shareholders.where('school_id').equals(DEMO_SCHOOL_ID).toArray();
  return { data: rows.map((r) => ({ ...r, identity_nin_last4: r.identity_nin_last4 })) };
});

route('POST', '/kyc/shareholders', async ({ body }) => {
  const persona = requireAuth();
  requirePermission(persona, 'kyc.submit');
  const db = getSandboxDb();
  const percentage = Number(body?.ownershipPercentage ?? 0);
  if (!(percentage > 0 && percentage <= 100)) throw new HttpError(400, 'Ownership percentage must be between 0 and 100');
  const row = {
    id: crypto.randomUUID(),
    school_id: DEMO_SCHOOL_ID,
    full_name: String(body.fullName ?? ''),
    ownership_percentage: percentage,
    role: body?.role ? String(body.role) : null,
    phone: body?.phone ? String(body.phone) : null,
    identity_nin_last4: body?.ninNumber && /^\d{11}$/.test(String(body.ninNumber)) ? String(body.ninNumber).slice(-4) : null,
    created_at: nowIso(),
  };
  await db.school_shareholders.add(row);
  return { data: row };
});

route('DELETE', '/kyc/shareholders/:id', async ({ params }) => {
  requireAuth();
  const db = getSandboxDb();
  await db.school_shareholders.delete(params.id!);
  return { data: { deleted: true } };
});

route('POST', '/kyc/principal-invitation', async ({ body }) => {
  const persona = requireAuth();
  requirePermission(persona, 'settings.manage');
  const db = getSandboxDb();
  const expires = new Date();
  expires.setDate(expires.getDate() + 14);
  const row = {
    id: crypto.randomUUID(),
    school_id: DEMO_SCHOOL_ID,
    email: String(body?.email ?? ''),
    name: String(body?.name ?? ''),
    role: String(body?.role ?? 'PRINCIPAL'),
    status: 'SENT',
    token: `sandbox-invite-${crypto.randomUUID().slice(0, 8)}`,
    expires_at: expires.toISOString(),
    accepted: false,
    created_at: nowIso(),
  };
  await db.principal_invitations.add(row);
  return { data: row };
});

route('GET', '/kyc/activation', async () => {
  requireAuth();
  const db = getSandboxDb();
  return { data: await computeReadiness(db) };
});

// ===== Platform-staff review surface (/admin/*) ==============================

route('GET', '/admin/kyc', async () => {
  const persona = requireAuth();
  requirePermission(persona, 'kyc.view');
  const db = getSandboxDb();
  const rows = await db.kyc_records.toArray();
  return { data: rows };
});

route('GET', '/admin/kyc/:id', async ({ params }) => {
  const persona = requireAuth();
  requirePermission(persona, 'kyc.view');
  const db = getSandboxDb();
  const row = await db.kyc_records.get(params.id!);
  if (!row) throw new HttpError(404, 'KYC record not found');
  return { data: { ...row, bvn_encrypted: undefined, nin_encrypted: undefined } };
});

route('POST', '/admin/kyc/:id/verify', async ({ params }) => {
  const persona = requireAuth();
  requirePermission(persona, 'kyc.review');
  const db = getSandboxDb();
  const row = await db.kyc_records.get(params.id!);
  if (!row) throw new HttpError(404, 'KYC record not found');
  if (row.status !== 'UNDER_REVIEW' && row.status !== 'REJECTED') {
    throw new HttpError(409, `Cannot verify KYC in status ${row.status}`);
  }
  if (sandboxRuntime.isScenarioActive('KYC_REJECT')) {
    row.status = 'REJECTED';
    row.rejection_reason = 'Identity mismatch on NIN ownership (simulated scenario)';
  } else {
    row.status = 'VERIFIED';
    row.rejection_reason = null;
  }
  row.reviewed_at = nowIso();
  row.updated_at = nowIso();
  await db.kyc_records.put(row);
  await writeAudit(db, persona.id, persona.role, row.status === 'VERIFIED' ? 'KYC_VERIFIED' : 'KYC_REJECTED', 'kyc_records', row.id, {});
  return { data: { ...row, bvn_encrypted: undefined, nin_encrypted: undefined } };
});

route('POST', '/admin/kyc/:id/reject', async ({ params, body }) => {
  const persona = requireAuth();
  requirePermission(persona, 'kyc.review');
  const db = getSandboxDb();
  const row = await db.kyc_records.get(params.id!);
  if (!row) throw new HttpError(404, 'KYC record not found');
  const reason = String(body?.reason ?? '');
  if (!reason) throw new HttpError(400, 'A rejection reason is required');
  row.status = 'REJECTED';
  row.rejection_reason = reason;
  row.reviewed_at = nowIso();
  row.updated_at = nowIso();
  await db.kyc_records.put(row);
  await writeAudit(db, persona.id, persona.role, 'KYC_REJECTED', 'kyc_records', row.id, {});
  return { data: { ...row } };
});

route('POST', '/admin/kyc/:id/request-review', async ({ params }) => {
  const persona = requireAuth();
  requirePermission(persona, 'kyc.review');
  const db = getSandboxDb();
  const row = await db.kyc_records.get(params.id!);
  if (!row) throw new HttpError(404, 'KYC record not found');
  row.overall_match_state = 'NEEDS_REVIEW';
  row.updated_at = nowIso();
  await db.kyc_records.put(row);
  return { data: { ...row } };
});

route('GET', '/admin/settlements', async () => {
  const persona = requireAuth();
  requirePermission(persona, 'settlement.review');
  const db = getSandboxDb();
  const rows = await db.settlement_accounts.toArray();
  return { data: rows.map((r) => ({ ...r, account_number_sandbox: undefined, account_number_masked: maskAccount(r.account_number_sandbox) })) };
});

route('POST', '/admin/settlements/:id/verify', async ({ params }) => {
  const persona = requireAuth();
  requirePermission(persona, 'settlement.review');
  const db = getSandboxDb();
  const row = await db.settlement_accounts.get(params.id!);
  if (!row) throw new HttpError(404, 'Settlement account not found');
  row.status = sandboxRuntime.isScenarioActive('SETTLEMENT_DELAYED') ? 'PENDING_VERIFICATION' : 'VERIFIED';
  row.ownership_match_state = 'MATCH';
  row.updated_at = nowIso();
  await db.settlement_accounts.put(row);
  await writeAudit(db, persona.id, persona.role, 'SETTLEMENT_ACCOUNT_VERIFIED', 'settlement_accounts', row.id, {});
  return { data: { ...row, account_number_sandbox: undefined } };
});

route('POST', '/admin/settlements/:id/reject', async ({ params, body }) => {
  const persona = requireAuth();
  requirePermission(persona, 'settlement.review');
  const db = getSandboxDb();
  const row = await db.settlement_accounts.get(params.id!);
  if (!row) throw new HttpError(404, 'Settlement account not found');
  row.status = 'REJECTED';
  row.rejection_reason = String(body?.reason ?? 'Rejected by compliance (demo)');
  row.updated_at = nowIso();
  await db.settlement_accounts.put(row);
  await writeAudit(db, persona.id, persona.role, 'SETTLEMENT_ACCOUNT_REJECTED', 'settlement_accounts', row.id, {});
  return { data: { ...row, account_number_sandbox: undefined } };
});

route('POST', '/admin/gateway/assign', async ({ body }) => {
  const persona = requireAuth();
  requirePermission(persona, 'gateway.assign');
  const db = getSandboxDb();
  const schoolId = String(body?.schoolId ?? DEMO_SCHOOL_ID);
  const provider = String(body?.provider ?? 'sandbox');
  if (provider !== 'sandbox') {
    throw new HttpError(400, 'The sandbox deployment can only assign the deterministic sandbox gateway');
  }
  const existing = await db.gateway_assignments.where('school_id').equals(schoolId).first();
  const row = {
    id: existing?.id ?? crypto.randomUUID(),
    school_id: schoolId,
    provider: 'sandbox' as const,
    status: 'ASSIGNED' as const,
    assigned_at: nowIso(),
    notes: 'Deterministic sandbox gateway',
    created_at: existing?.created_at ?? nowIso(),
    updated_at: nowIso(),
  };
  await db.gateway_assignments.put(row);
  await writeAudit(db, persona.id, persona.role, 'GATEWAY_ASSIGNED', 'gateway_assignments', row.id, { school_id: schoolId, provider });
  return { data: { assignment: row, schoolId } };
});

async function setSchoolPaymentStatus(status: 'READY' | 'SUSPENDED'): Promise<Json> {
  const db = getSandboxDb();
  const school = await getSchoolRow(db);
  school.payment_status = status;
  school.updated_at = nowIso();
  await db.schools.put(school as never);
  return school;
}

route('POST', '/admin/payments/activate', async ({ body }) => {
  const persona = requireAuth();
  requirePermission(persona, 'payment.activate');
  const db = getSandboxDb();
  const schoolId = String(body?.schoolId ?? DEMO_SCHOOL_ID);
  const readiness = (await computeReadiness(db)) as { ready: boolean; reason: string | null };
  if (!readiness.ready && !sandboxRuntime.isScenarioActive('SETTLEMENT_DELAYED')) {
    throw new HttpError(409, `Activation prerequisites not met: ${readiness.reason}`);
  }
  const school = await setSchoolPaymentStatus('READY');
  await writeAudit(db, persona.id, persona.role, 'PAYMENTS_ACTIVATED', 'schools', schoolId, {});
  return { data: { schoolId, activated: true, paymentStatus: school.payment_status } };
});

route('POST', '/admin/payments/suspend', async ({ body }) => {
  const persona = requireAuth();
  requirePermission(persona, 'payment.activate');
  const db = getSandboxDb();
  const schoolId = String(body?.schoolId ?? DEMO_SCHOOL_ID);
  const school = await setSchoolPaymentStatus('SUSPENDED');
  await writeAudit(db, persona.id, persona.role, 'PAYMENTS_SUSPENDED', 'schools', schoolId, {});
  return { data: { schoolId, suspended: true, paymentStatus: school.payment_status } };
});

route('GET', '/admin/payments/readiness/:schoolId', async ({ params }) => {
  const persona = requireAuth();
  requirePermission(persona, 'payment.activate');
  const db = getSandboxDb();
  void params;
  return { data: await computeReadiness(db) };
});

// ===== Whitelisted RPC proxy ================================================

async function rpcStudentBalance(studentId: string): Promise<number> {
  const db = getSandboxDb();
  const rows = (await db.ledger_entries.where('student_id').equals(studentId).toArray()) as Json[];
  return rows.reduce((balance, r) => {
    const minor = Number(r.amount_minor ?? 0);
    if (r.entry_direction === 'DEBIT') return balance + minor;
    return balance - minor;
  }, 0);
}

// ===== Sandbox control surface (demo simulator, not part of prod API) ========

/**
 * Simulate a parent payment through the deterministic gateway. SUCCESS posts
 * transaction + CREDIT ledger entry atomically-ish (same rules as the
 * production webhook pipeline: verify → idempotency check → post).
 */
route('POST', '/sandbox/gateway/simulate-payment', async ({ body }) => {
  const persona = requireAuth();
  requirePermission(persona, persona.platformStaff ? 'payments.reconcile' : 'payments.receive');
  ensureOnline();
  const db = getSandboxDb();
  await requirePaymentReady(db);

  const outcome = String(body?.outcome ?? 'SUCCESS') as 'SUCCESS' | 'FAILED' | 'PENDING' | 'REVERSED';
  if (outcome === 'FAILED' && !sandboxRuntime.isScenarioActive('PAYMENT_FAILED')) {
    // Allowed anyway via explicit scenario OR direct request — no gate here.
  }
  const failureReason = sandboxRuntime.isScenarioActive('PAYMENT_FAILED')
    ? 'Insufficient funds (simulated scenario)'
    : String(body?.failureReason ?? 'Transfer declined by bank');

  const studentId = String(body?.studentId ?? '');
  const student = await db.students.get(studentId);
  if (!student) throw new HttpError(404, 'Student not found');

  // Reference allocation continues BEYOND any seeded dataset: when the
  // counter has never been written, derive it from the highest existing
  // DEMO-PAY / SANDBOX-TXN sequence so simulated references can never collide
  // with deterministic seed content.
  const seqMeta = await db.sandbox_meta.get('payment_counter');
  let counter = Number(seqMeta?.value ?? 0);
  if (!seqMeta || Number.isNaN(counter)) {
    counter = 0;
    const txns = (await db.payment_transactions.toArray()) as Array<Record<string, unknown>>;
    for (const txn of txns) {
      const match = /^DEMO-PAY-(\d+)$/.exec(String(txn.reference ?? ''));
      if (match) counter = Math.max(counter, parseInt(match[1]!, 10));
      const txnMatch = /^SANDBOX-TXN-(\d+)$/.exec(String(txn.gateway_txn_ref ?? ''));
      if (txnMatch) counter = Math.max(counter, parseInt(txnMatch[1]!, 10));
    }
  }
  counter += 1;
  // `id` mirrors the logical key so test doubles keyed by `id` behave like
  // the real store (whose primary key is `key`).
  await db.sandbox_meta.put({ key: 'payment_counter', id: 'payment_counter', value: counter, updated_at: nowIso() } as never);

  const forcedReference = body?.reference ? String(body.reference) : null;
  const reference = forcedReference ?? `DEMO-PAY-${String(counter).padStart(6, '0')}`;
  const gatewayTxnRef = `SANDBOX-TXN-${String(counter).padStart(6, '0')}`;

  const dup = await db.payment_transactions.where('reference').equals(reference).first();
  if (dup) throw new HttpError(409, `Duplicate payment reference ${reference}`);

  const amountMinorRaw = Number(body?.amountMinor ?? 0);
  if (!Number.isInteger(amountMinorRaw) || amountMinorRaw <= 0) {
    throw new HttpError(400, 'amountMinor must be a positive integer of kobo');
  }

  if (outcome === 'REVERSED') {
    // Reverse an EXISTING successful payment by reference.
    const target = await db.payment_transactions.where('reference').equals(String(body?.targetReference ?? '')).first() as Json | undefined;
    if (!target) throw new HttpError(404, 'Target payment not found for reversal');
    if (target.status !== 'SUCCESS') throw new HttpError(409, 'Only SUCCESS payments can be reversed');
    const reversal = await postReversalForPayment({
      studentId: String(target.student_id),
      originalReference: String(target.reference),
      reason: String(body?.reason ?? 'Simulated reversal (demo)'),
      occurredAt: nowIso(),
      createdBy: persona.id,
    });
    if (!reversal.ok) throw new HttpError(409, reversal.message);
    target.status = 'REVERSED';
    target.settlement_status = 'REVERSED';
    target.reversed_at = nowIso();
    target.reversal_reason = String(body?.reason ?? 'Simulated reversal (demo)');
    await db.payment_transactions.put(target as never);
    await writeAudit(db, persona.id, persona.role, 'PAYMENT_REVERSED', 'payment_transactions', String(target.reference), {});
    return { data: { outcome, transaction: target, reference: target.reference } };
  }

  const paidAt = nowIso();
  const txn: Json = {
    id: crypto.randomUUID(),
    school_id: DEMO_SCHOOL_ID,
    student_id: studentId,
    reference,
    gateway_txn_ref: gatewayTxnRef,
    provider_reference: `sandbox-ref-${counter}`,
    amount_minor: amountMinorRaw,
    amount: amountMinorRaw / 100,
    currency: 'NGN',
    status: outcome === 'SUCCESS' ? 'SUCCESS' : outcome,
    method: String(body?.method ?? 'BANK_TRANSFER'),
    gateway_provider: 'SANDBOX',
    settlement_status: outcome === 'SUCCESS' ? 'PENDING' : outcome,
    idempotency_key: `pay:${reference}`,
    provider_event_id: `evt-${gatewayTxnRef.toLowerCase()}`,
    failure_reason: outcome === 'FAILED' ? failureReason : null,
    verified_at: outcome === 'SUCCESS' ? paidAt : null,
    reversed_at: null,
    reversal_reason: null,
    paid_at: outcome === 'SUCCESS' ? paidAt : null,
    created_at: paidAt,
    updated_at: paidAt,
    source: 'WEBHOOK',
    version: 1,
  };
  await db.payment_transactions.put(txn as never);

  let ledgerPosted = false;
  if (outcome === 'SUCCESS' && !sandboxRuntime.isScenarioActive('PAYMENT_PENDING')) {
    const posted = await postVerifiedPaymentCredit({
      schoolId: DEMO_SCHOOL_ID,
      organizationId: DEMO_ORG_ID,
      studentId,
      reference,
      gatewayTxnRef,
      amountMinor: amountMinorRaw,
      method: String(txn.method),
      sessionId: 'sd-ses-cur',
      termId: 'sd-trm-1-1',
      occurredAt: paidAt,
      billingProfileId: `sd-bil-${studentId.slice(-4)}`,
      createdBy: persona.id,
    });
    if (!posted.ok) throw new HttpError(409, posted.message);
    ledgerPosted = true;

    await pushNotification(db, {
      id: crypto.randomUUID(),
      school_id: DEMO_SCHOOL_ID,
      student_id: studentId,
      guardian_id: student.guardian_id ?? null,
      recipient_phone: student.guardian_phone ?? null,
      message_body: `Payment of ₦${(amountMinorRaw / 100).toLocaleString('en-NG')} received for ${student.first_name} ${student.last_name}. Ref ${reference}.`,
      delivery_method: 'SMS',
      delivery_status: 'DELIVERED',
      provider_msg_id: `sbx-msg-${crypto.randomUUID().slice(0, 8)}`,
      created_at: paidAt,
      updated_at: paidAt,
    });
  }

  await writeAudit(db, persona.id, persona.role, outcome === 'SUCCESS' ? 'PAYMENT_RECEIVED' : `PAYMENT_${outcome}`, 'payment_transactions', reference, { ledger_posted: ledgerPosted, amount_minor: amountMinorRaw });
  sandboxRuntime.emit('payment-simulated', { outcome, reference });
  return { data: { outcome, transaction: txn, reference, ledger_posted: ledgerPosted } };
});

/** Reset progressive access so testers can walk the full activation journey. */
route('POST', '/sandbox/reset-progressive-access', async () => {
  const persona = requireAuth();
  const db = getSandboxDb();
  const anchor = nowIso();
  const kyc = await db.kyc_records.where('school_id').equals(DEMO_SCHOOL_ID).first();
  if (kyc) {
    kyc.status = 'NOT_STARTED';
    kyc.submitted_at = null;
    kyc.reviewed_at = null;
    kyc.updated_at = anchor;
    await db.kyc_records.put(kyc);
  }
  const settlement = await db.settlement_accounts.where('school_id').equals(DEMO_SCHOOL_ID).first();
  if (settlement) {
    settlement.status = 'PENDING_VERIFICATION';
    settlement.updated_at = anchor;
    await db.settlement_accounts.put(settlement);
  }
  const gateway = await db.gateway_assignments.where('school_id').equals(DEMO_SCHOOL_ID).first();
  if (gateway) {
    gateway.status = 'ASSIGNED';
    gateway.updated_at = anchor;
    await db.gateway_assignments.put(gateway);
  }
  const school = await getSchoolRow(db);
  school.payment_status = 'NOT_READY';
  school.updated_at = anchor;
  await db.schools.put(school as never);
  void persona;
  return { data: { reset: true } };
});

// ===== RPC proxy ============================================================

route('POST', '/rpc', async ({ body }) => {
  requireAuth();
  const fn = String(body?.fn ?? '');
  const allowed = ['student_balance', 'school_balance', 'trigger_apply_student_base_fees', 'complete_onboarding', 'get_onboarding_status'];
  if (!allowed.includes(fn)) throw new HttpError(403, 'RPC function not permitted');
  if (fn === 'student_balance') {
    const balanceMinor = await rpcStudentBalance(String(body?.p_student_id ?? body?.studentId ?? ''));
    return { data: { balance_minor: balanceMinor } };
  }
  if (fn === 'school_balance') {
    const db = getSandboxDb();
    const rows = (await db.ledger_entries.where('school_id').equals(DEMO_SCHOOL_ID).toArray()) as Json[];
    const balanceMinor = rows.reduce((acc, r) => acc + (r.entry_direction === 'DEBIT' ? Number(r.amount_minor ?? 0) : -Number(r.amount_minor ?? 0)), 0);
    return { data: { balance_minor: balanceMinor } };
  }
  return { data: { ok: true, fn } };
});

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

let callCounter = 0;

export async function handleSandboxRequest(config: AxiosRequestConfig): Promise<SandboxResponse> {
  assertSandboxMode(runtimeEnvironment.isSandbox, 'SandboxApiServer');

  const method = (config.method ?? 'get').toUpperCase();
  const rawUrl = config.url ?? '/';
  const baseURL = config.baseURL ?? '';
  const fullUrl = rawUrl.startsWith('http') ? rawUrl : `${baseURL}${rawUrl}`;
  const parsed = new URL(fullUrl, 'http://sandbox.local');
  const pathSegments = parsed.pathname.split('/').filter(Boolean);
  // Strip a leading 'api' segment if deployments prefix it.
  if (pathSegments[0]?.toLowerCase() === 'api') pathSegments.shift();

  const match = matchRoute(method, pathSegments);
  if (!match) {
    throw new HttpError(404, `Sandbox API has no route for ${method} /${pathSegments.join('/')}`);
  }

  // Offline gating happens BEFORE auth so the UX mirrors connection failures.
  ensureOnline();

  // Realistic latency so loading states behave like production.
  const latency = 60 + ((callCounter++ * 37) % 140);
  await new Promise((resolve) => setTimeout(resolve, latency));

  const persona = getSessionPersona();
  const result = await match.def.handler({
    body: config.data,
    query: parsed.searchParams,
    params: match.params,
    persona,
  });
  return { status: 200, data: { success: true, ...result } };
}

export { HttpError as SandboxHttpError };
