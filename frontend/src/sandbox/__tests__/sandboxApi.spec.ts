/**
 * SandboxApiServer — auth, tenant isolation, progressive-access gating,
 * payment state machine, idempotency and masked egress.
 */
import { describe, expect, it } from 'vitest';
import {
  seedReadySchool,
  signInAs,
  signOut,
  useSandboxFixture,
} from './helpers/sandboxTestHarness';

interface CallResult {
  status: number;
  body?: Record<string, unknown>;
  error?: unknown;
}

async function call(method: string, url: string, data?: unknown): Promise<CallResult> {
  const { handleSandboxRequest } = await import('../api/sandboxApiServer');
  try {
    const response = await handleSandboxRequest({
      method: method as 'get',
      url,
      baseURL: 'http://sandbox.local/api',
      data: data as never,
    });
    return { status: response.status, body: response.data };
  } catch (error) {
    return { status: (error as { status?: number }).status ?? 0, error };
  }
}

function studentRow(id: string): Record<string, unknown> {
  return {
    id, school_id: 'demo-school', first_name: 'Ada', last_name: 'Nwosu',
    admission_number: `CAP-${id.slice(-5)}`, status: 'ACTIVE',
    guardian_id: null, guardian_phone: '+2348000000000',
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  };
}

describe('sandbox api — authentication & tenant isolation', () => {
  const f = useSandboxFixture();

  it('401s without a session (mirrors requireAuthSupabase)', async () => {
    signOut();
    const result = await call('GET', '/context/school');
    expect(result.status).toBe(401);
  });

  it('rejects cross-school ids from the client with 403', async () => {
    signInAs('demo-user-owner');
    seedReadySchool(f.db);
    // Caller is pinned to demo-school; a foreign school_id must never pass.
    const result = await call('GET', '/payments?school_id=other-school');
    expect(result.status).toBe(403);
  });
});

describe('sandbox api — KYC state machine & readiness gating', () => {
  const f = useSandboxFixture();

  function resetAccess(): void {
    f.db.kyc_records.put({
      id: 'kyc-1', school_id: 'demo-school', status: 'NOT_STARTED',
      bvn_last4: null, nin_last4: null, identity_match_states: {},
      rejection_reason: null, submitted_at: null, reviewed_at: null,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    } as never);
    f.db.schools.put({
      id: 'demo-school', organization_id: 'demo-org', name: 'CAPFLUX Demo Academy',
      status: 'ACTIVE', payment_status: 'NOT_READY',
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    } as never);
    f.db.gateway_assignments.put({
      id: 'gw-1', school_id: 'demo-school', provider: 'sandbox', status: 'ASSIGNED',
      assigned_at: new Date().toISOString(),
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    } as never);
  }

  it('walks NOT_STARTED → UNDER_REVIEW → VERIFIED via the real endpoints', async () => {
    resetAccess();
    signInAs('demo-user-owner');

    expect((await call('GET', '/kyc/status')).body!.data).toMatchObject({ status: 'NOT_STARTED' });

    const submit = await call('POST', '/kyc/submit', {
      principalName: 'Amaka Obi', principalPhone: '+2348012340001',
      bvn: '22212345678', nin: '11112222333',
    });
    expect(submit.status).toBe(200);
    expect((submit.body!.data as Record<string, unknown>).status).toBe('UNDER_REVIEW');

    // Staff review through the platform-staff surface.
    signOut();
    signInAs('demo-user-platform');
    const list = await call('GET', '/admin/kyc');
    const record = (list.body!.data as Array<Record<string, unknown>>)[0]!;
    const verify = await call('POST', `/admin/kyc/${record.id}/verify`, {});
    expect(verify.status).toBe(200);
    expect((verify.body!.data as Record<string, unknown>).status).toBe('VERIFIED');

    signOut();
    signInAs('demo-user-owner');
    const status = await call('GET', '/kyc/status');
    expect((status.body!.data as Record<string, unknown>).status).toBe('VERIFIED');
    // Masked identifiers only.
    expect((status.body!.data as Record<string, unknown>).bvn_last4).toBe('5678');
  });

  it('rejects invalid BVN/NIN at submission (11-digit discipline)', async () => {
    resetAccess();
    signInAs('demo-user-owner');
    const result = await call('POST', '/kyc/submit', {
      principalName: 'X', principalPhone: '+2348000000000',
      bvn: '12345', nin: '11112222333',
    });
    expect(result.status).toBe(400);
  });

  it('money routes refuse unactivated tenants (PAYMENT_ACTIVATION_REQUIRED)', async () => {
    resetAccess();
    signInAs('demo-user-owner');
    f.db.students.put(studentRow('stu-1') as never);

    const result = await call('POST', '/dva/provision', { student_id: 'stu-1' });
    expect(result.status).toBe(403);
    expect(String((result.error as Error)?.message)).toContain('PAYMENT_ACTIVATION_REQUIRED');
  });

  it('readiness reports the unmet conditions', async () => {
    resetAccess();
    signInAs('demo-user-owner');
    const activation = await call('GET', '/kyc/activation');
    const payload = activation.body!.data as Record<string, unknown>;
    expect(payload.ready).toBe(false);
    const conditions = payload.conditions as Record<string, boolean>;
    expect(conditions.kyc_verified).toBe(false);
    expect(conditions.settlement_verified).toBe(false);
    expect(conditions.gateway_assigned).toBe(true);
  });
});

describe('sandbox api — simulated payments, ledger posting & masking', () => {
  const f = useSandboxFixture();

  function readyFixture(): void {
    seedReadySchool(f.db);
    f.db.students.put(studentRow('stu-sim-1') as never);
    // Progressive access fully satisfied: KYC + settlement verified, gateway assigned.
    f.db.kyc_records.put({
      id: 'kyc-main', school_id: 'demo-school', status: 'VERIFIED',
      bvn_last4: '4432', nin_last4: '8890', identity_match_states: {},
      rejection_reason: null,
      submitted_at: new Date().toISOString(), reviewed_at: new Date().toISOString(),
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    } as never);
    f.db.settlement_accounts.put({
      id: 'setacc-1', school_id: 'demo-school', status: 'VERIFIED',
      bank_code: '990', bank_name: 'CAPFLUX Demo Bank MFB',
      account_number_sandbox: '0123456789', account_number_last4: '6789',
      account_name: 'CAPFLUX DEMO ACADEMY', bvn_last4: '4432',
      ownership_match_state: 'MATCH', rejection_reason: null,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    } as never);
    f.db.gateway_assignments.put({
      id: 'gw-1', school_id: 'demo-school', provider: 'sandbox', status: 'ASSIGNED',
      assigned_at: new Date().toISOString(), notes: null,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    } as never);
  }

  it('simulated SUCCESS posts transaction + CREDIT ledger entry + notification', async () => {
    readyFixture();
    signInAs('demo-user-owner');

    const result = await call('POST', '/sandbox/gateway/simulate-payment', {
      studentId: 'stu-sim-1', amountMinor: 15000000, outcome: 'SUCCESS',
    });
    expect(result.status).toBe(200);
    const data = result.body!.data as Record<string, unknown>;
    expect(data.outcome).toBe('SUCCESS');
    expect(String(data.reference)).toMatch(/^DEMO-PAY-\d{6}$/);
    expect(data.ledger_posted).toBe(true);

    // Ledger received exactly one CREDIT PAYMENT entry for the full amount.
    const entries = await f.db.ledger_entries.toArray();
    const credits = entries.filter(
      (e) => e.entry_type === 'PAYMENT' && e.source_document_id === String(data.reference),
    );
    expect(credits.length).toBe(1);
    expect(Number(credits[0]!.amount_minor)).toBe(15000000);
    expect(String(credits[0]!.entry_direction)).toBe('CREDIT');

    // Notification inbox got a delivery record.
    const notifications = await f.db.notifications.toArray();
    expect(notifications.some((n) => String(n.message_body ?? '').includes('received'))).toBe(true);

    // Audit trail captured the financial event.
    const audit = await f.db.audit_trail.toArray();
    expect(audit.some((a) => a.action === 'PAYMENT_RECEIVED')).toBe(true);
  });

  it('duplicate references are rejected (idempotency)', async () => {
    readyFixture();
    signInAs('demo-user-owner');
    await call('POST', '/sandbox/gateway/simulate-payment', {
      studentId: 'stu-sim-1', amountMinor: 100000, outcome: 'SUCCESS', reference: 'DEMO-PAY-000042',
    });
    const replay = await call('POST', '/sandbox/gateway/simulate-payment', {
      studentId: 'stu-sim-1', amountMinor: 100000, outcome: 'SUCCESS', reference: 'DEMO-PAY-000042',
    });
    expect(replay.status).toBe(409);
  });

  it('FAILED payments post NO ledger entry; REVERSED requires an existing SUCCESS', async () => {
    readyFixture();
    signInAs('demo-user-owner');

    await call('POST', '/sandbox/gateway/simulate-payment', {
      studentId: 'stu-sim-1', amountMinor: 500000, outcome: 'FAILED',
    });
    const creditsAfterFailure = (await f.db.ledger_entries.toArray())
      .filter((e) => e.entry_type === 'PAYMENT');
    expect(creditsAfterFailure.length).toBe(0);

    const reverseUnknown = await call('POST', '/sandbox/gateway/simulate-payment', {
      studentId: 'stu-sim-1', amountMinor: 500000, outcome: 'REVERSED', targetReference: 'DEMO-PAY-999999',
    });
    expect(reverseUnknown.status).toBe(404);
  });

  it('full lifecycle: SUCCESS then REVERSED leaves a compensating DEBIT reversal', async () => {
    readyFixture();
    signInAs('demo-user-owner');

    const ok = await call('POST', '/sandbox/gateway/simulate-payment', {
      studentId: 'stu-sim-1', amountMinor: 250000, outcome: 'SUCCESS', reference: 'DEMO-PAY-000077',
    });
    expect(ok.status).toBe(200);

    const reversed = await call('POST', '/sandbox/gateway/simulate-payment', {
      studentId: 'stu-sim-1', amountMinor: 250000, outcome: 'REVERSED',
      targetReference: 'DEMO-PAY-000077', reason: 'Demo reversal',
    });
    expect(reversed.status).toBe(200);

    const ledger = await f.db.ledger_entries.toArray();
    expect(ledger.some((e) => e.entry_type === 'REVERSAL' && Number(e.amount_minor) === 250000)).toBe(true);

    const txn = await f.db.payment_transactions.get('DEMO-PAY-000077').then(
      () => null,
      () => null,
    );
    void txn;
    const transactions = await f.db.payment_transactions.where('reference').equals('DEMO-PAY-000077').toArray();
    expect(transactions[0]!.status).toBe('REVERSED');
  });

  it('DVA egress is masked to ****last4', async () => {
    readyFixture();
    signInAs('demo-user-owner');
    await call('POST', '/dva/provision', { student_id: 'stu-sim-1' });
    const list = await call('GET', '/dva');
    const rows = list.body!.data as Array<Record<string, unknown>>;
    expect(rows.length).toBe(1);
    expect(String(rows[0]!.virtual_account_number)).toMatch(/^\*\*\*\*\*\*\d{4}$/);
    expect(JSON.stringify(rows[0])).not.toMatch(/"virtual_account_number":"100\d{7}"/);
  });

  it('offline toggle fails requests without a response (network-error shape)', async () => {
    readyFixture();
    signInAs('demo-user-owner');
    const runtimeMod = await import('../runtime/sandboxRuntime');
    runtimeMod.sandboxRuntime.setOnline(false);
    try {
      const result = await call('GET', '/payments/summary');
      expect(result.status).toBe(0);
      expect(result.error).toBeDefined();
    } finally {
      runtimeMod.sandboxRuntime.setOnline(true);
    }
  });

  it('non-integer kobo amounts are rejected (financial integrity guard)', async () => {
    readyFixture();
    signInAs('demo-user-owner');
    const bad = await call('POST', '/sandbox/gateway/simulate-payment', {
      studentId: 'stu-sim-1', amountMinor: 1500.55, outcome: 'SUCCESS',
    });
    expect(bad.status).toBe(400);
  });
});
