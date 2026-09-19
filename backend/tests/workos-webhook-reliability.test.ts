/**
 * WorkOS webhook reliability regression suite.
 *
 * Behavioral tests for session.revoked error propagation and
 * dispatchEvent completion semantics. Mocks Supabase RPC calls
 * to verify call order, arguments, and return values.
 *
 * Covers:
 *   1. Successful revocation → event completed → 200
 *   2. Revocation RPC error → handler fails → event NOT completed → 500
 *   3. Revocation RPC throws → failure propagated
 *   4. Revocation succeeds but completion RPC fails → marked FAILED → 500
 *   5. Both completion and fail RPCs fail → original error observable
 *   6. Duplicate delivery after success remains idempotent
 *   7. Retry after failure can succeed
 *   8. Already-completed events handled idempotently
 *   9. Missing sessionId → fail closed
 */
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

// ── Supabase mock ────────────────────────────────────────────────────────

interface RpcCall {
  fn: string;
  params: Record<string, unknown>;
}

let rpcCalls: RpcCall[];
let rpcHandlers: Record<string, (params: Record<string, unknown>) => { data: unknown; error: unknown }>;

function mockRpc(fn: string, params: Record<string, unknown>) {
  rpcCalls.push({ fn, params });
  const handler = rpcHandlers[fn];
  if (handler) return handler(params);
  return { data: null, error: null };
}

// Replace the supabase client before importing the service
import { supabase } from '../supabaseClient.js';
const originalRpc = supabase.rpc;

function installMock() {
  rpcCalls = [];
  rpcHandlers = {};
  supabase.rpc = mockRpc as typeof supabase.rpc;
}

function uninstallMock() {
  supabase.rpc = originalRpc;
}

// ── Import service AFTER mock setup (singleton already created, but
//    the service calls supabase.rpc at call time, not import time) ──

import { WorkOSWebhookService } from '../services/WorkOSWebhookService.js';

const service = new WorkOSWebhookService();

// ── Fixtures ─────────────────────────────────────────────────────────────

function makeSessionRevokedEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'evt_test_session_revoked_001',
    event: 'session.revoked' as const,
    data: {
      userId: 'user_01ABCDEF1234567890',
      id: 'ses_01ABCDEF1234567890',
      object: 'session',
      status: 'revoked',
      ...overrides,
    },
    timestamp: '2026-09-19T00:00:00.000Z',
  };
}

function makeClaimResult(overrides: Record<string, unknown> = {}) {
  return {
    data: [{
      id: '00000000-0000-0000-0000-000000000001',
      workos_event_id: 'evt_test_session_revoked_001',
      event_type: 'session.revoked',
      status: 'PROCESSING',
      attempts: 1,
      claimed: true,
      ...overrides,
    }],
    error: null,
  };
}

function okResult() {
  return { data: null, error: null };
}

function rpcError(code: string, message: string) {
  return { data: null, error: { code, message, details: '', hint: '' } };
}

// ── Tests ────────────────────────────────────────────────────────────────

describe('session.revoked error propagation', () => {
  beforeEach(installMock);
  afterEach(uninstallMock);

  it('successful revocation → handler returns success, RPC called correctly', async () => {
    rpcHandlers = {
      revoke_workos_session: () => okResult(),
    };

    const event = makeSessionRevokedEvent();
    const result = await service.handleSessionRevoked(event);

    assert.equal(result.success, true);
    assert.equal(result.eventType, 'session.revoked');
    assert.equal(rpcCalls.length, 1);
    assert.equal(rpcCalls[0].fn, 'revoke_workos_session');
    assert.equal(rpcCalls[0].params.p_session_id, 'ses_01ABCDEF1234567890');
    assert.equal(rpcCalls[0].params.p_source, 'webhook');
  });

  it('revocation RPC error → handler returns failure, event NOT completed', async () => {
    rpcHandlers = {
      revoke_workos_session: () => rpcError('42P01', 'relation does not exist'),
    };

    const event = makeSessionRevokedEvent();
    const result = await service.handleSessionRevoked(event);

    assert.equal(result.success, false);
    assert.match(result.error!, /Failed to revoke session/);
    assert.match(result.error!, /relation does not exist/);
  });

  it('revocation RPC throws → failure propagated via catch', async () => {
    rpcHandlers = {
      revoke_workos_session: () => { throw new Error('network timeout'); },
    };

    const event = makeSessionRevokedEvent();
    const result = await service.handleSessionRevoked(event);

    assert.equal(result.success, false);
    assert.match(result.error!, /network timeout/);
  });

  it('missing sessionId → fail closed, no RPC call', async () => {
    rpcHandlers = {};

    const event = makeSessionRevokedEvent({ id: undefined });
    const result = await service.handleSessionRevoked(event);

    assert.equal(result.success, false);
    assert.match(result.error!, /missing sessionId/i);
    assert.equal(rpcCalls.length, 0, 'no RPC should be called when sessionId is absent');
  });

  it('missing both userId and sessionId → fail closed', async () => {
    rpcHandlers = {};

    const event = makeSessionRevokedEvent({ id: undefined, userId: undefined });
    const result = await service.handleSessionRevoked(event);

    assert.equal(result.success, false);
    assert.match(result.error!, /Missing userId and sessionId/);
    assert.equal(rpcCalls.length, 0);
  });
});

describe('dispatchEvent completion semantics', () => {
  beforeEach(installMock);
  afterEach(uninstallMock);

  it('handler success + completion success → event COMPLETED, returns success', async () => {
    rpcHandlers = {
      workos_webhook_event_claim: () => makeClaimResult(),
      revoke_workos_session: () => okResult(),
      workos_webhook_event_complete: () => okResult(),
    };

    const event = makeSessionRevokedEvent();
    const result = await service.dispatchEvent(event);

    assert.equal(result.success, true);
    assert.equal(result.alreadyProcessed, undefined);

    // Verify call order: claim → revoke → complete
    assert.equal(rpcCalls.length, 3);
    assert.equal(rpcCalls[0].fn, 'workos_webhook_event_claim');
    assert.equal(rpcCalls[1].fn, 'revoke_workos_session');
    assert.equal(rpcCalls[2].fn, 'workos_webhook_event_complete');
  });

  it('handler failure → event FAILED, returns failure', async () => {
    rpcHandlers = {
      workos_webhook_event_claim: () => makeClaimResult(),
      revoke_workos_session: () => rpcError('42P01', 'relation does not exist'),
      workos_webhook_event_fail: () => okResult(),
    };

    const event = makeSessionRevokedEvent();
    const result = await service.dispatchEvent(event);

    assert.equal(result.success, false);
    assert.match(result.error!, /Failed to revoke session/);

    // Verify call order: claim → revoke(fail) → fail
    assert.equal(rpcCalls.length, 3);
    assert.equal(rpcCalls[0].fn, 'workos_webhook_event_claim');
    assert.equal(rpcCalls[1].fn, 'revoke_workos_session');
    assert.equal(rpcCalls[2].fn, 'workos_webhook_event_fail');
    assert.equal(rpcCalls[2].params.p_workos_event_id, 'evt_test_session_revoked_001');
    assert.match(rpcCalls[2].params.p_error as string, /Failed to revoke session/);
  });

  it('handler success + completion RPC fails → marked FAILED, returns failure', async () => {
    rpcHandlers = {
      workos_webhook_event_claim: () => makeClaimResult(),
      revoke_workos_session: () => okResult(),
      workos_webhook_event_complete: () => rpcError('42P01', 'relation does not exist'),
      workos_webhook_event_fail: () => okResult(),
    };

    const event = makeSessionRevokedEvent();
    const result = await service.dispatchEvent(event);

    assert.equal(result.success, false);
    assert.match(result.error!, /Handler succeeded but completion write failed/);

    // Verify call order: claim → revoke → complete(fail) → fail
    assert.equal(rpcCalls.length, 4);
    assert.equal(rpcCalls[0].fn, 'workos_webhook_event_claim');
    assert.equal(rpcCalls[1].fn, 'revoke_workos_session');
    assert.equal(rpcCalls[2].fn, 'workos_webhook_event_complete');
    assert.equal(rpcCalls[3].fn, 'workos_webhook_event_fail');
    assert.match(rpcCalls[3].params.p_error as string, /completion write failed/);
  });

  it('handler success + completion fails + fail RPC also fails → original error observable', async () => {
    rpcHandlers = {
      workos_webhook_event_claim: () => makeClaimResult(),
      revoke_workos_session: () => okResult(),
      workos_webhook_event_complete: () => rpcError('42P01', 'pg down'),
      workos_webhook_event_fail: () => rpcError('42P01', 'pg down'),
    };

    const event = makeSessionRevokedEvent();
    const result = await service.dispatchEvent(event);

    // Must still return failure — never success
    assert.equal(result.success, false);
    assert.match(result.error!, /completion write failed/);

    // Both complete and fail RPCs were attempted
    assert.equal(rpcCalls.length, 4);
    assert.equal(rpcCalls[2].fn, 'workos_webhook_event_complete');
    assert.equal(rpcCalls[3].fn, 'workos_webhook_event_fail');
  });

  it('already-completed event → idempotent success, no handler invoked', async () => {
    rpcHandlers = {
      workos_webhook_event_claim: () => makeClaimResult({ status: 'COMPLETED', claimed: false }),
    };

    const event = makeSessionRevokedEvent();
    const result = await service.dispatchEvent(event);

    assert.equal(result.success, true);
    assert.equal(result.alreadyProcessed, true);
    // Only claim RPC called — no handler, no revoke, no complete
    assert.equal(rpcCalls.length, 1);
    assert.equal(rpcCalls[0].fn, 'workos_webhook_event_claim');
  });

  it('event claimed by another request → returns alreadyProcessed', async () => {
    rpcHandlers = {
      workos_webhook_event_claim: () => makeClaimResult({ status: 'PROCESSING', claimed: false }),
    };

    const event = makeSessionRevokedEvent();
    const result = await service.dispatchEvent(event);

    assert.equal(result.success, true);
    assert.equal(result.alreadyProcessed, true);
    assert.equal(rpcCalls.length, 1);
  });

  it('retry after failure → re-claimed, handler re-run, can succeed', async () => {
    let claimCount = 0;
    rpcHandlers = {
      workos_webhook_event_claim: () => {
        claimCount++;
        if (claimCount === 1) {
          // First claim: FAILED state, will be retried
          return makeClaimResult({ status: 'FAILED', claimed: true, attempts: 1 });
        }
        // Should not be called twice in this test
        return makeClaimResult();
      },
      revoke_workos_session: () => okResult(),
      workos_webhook_event_complete: () => okResult(),
    };

    const event = makeSessionRevokedEvent();
    const result = await service.dispatchEvent(event);

    assert.equal(result.success, true);
    // claim → revoke → complete
    assert.equal(rpcCalls.length, 3);
    assert.equal(rpcCalls[0].fn, 'workos_webhook_event_claim');
    assert.equal(rpcCalls[1].fn, 'revoke_workos_session');
    assert.equal(rpcCalls[2].fn, 'workos_webhook_event_complete');
  });

  it('claim RPC failure → returns failure without processing', async () => {
    rpcHandlers = {
      workos_webhook_event_claim: () => rpcError('42P01', 'table missing'),
    };

    const event = makeSessionRevokedEvent();
    const result = await service.dispatchEvent(event);

    assert.equal(result.success, false);
    assert.match(result.error!, /Failed to claim event/);
    // Only claim attempted — no handler, no revoke
    assert.equal(rpcCalls.length, 1);
    assert.equal(rpcCalls[0].fn, 'workos_webhook_event_claim');
  });
});
