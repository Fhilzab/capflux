/**
 * Phase 1 regression tests — webhook Step 7 notification error handling.
 *
 * Regression context: Supabase PostgrestBuilder is a thenable that exposes
 * `.then()` but NOT Promise `.catch()`. The legacy webhook route chained
 * `.catch(() => {})` directly onto `insert(...)` in Step 7, so every webhook
 * that reached the notification step threw "…catch is not a function" AFTER
 * payment + ledger were committed, producing a spurious HTTP 500 and
 * triggering provider retries.
 *
 * These tests drive the REAL webhook router over HTTP with a
 * Postgrest-faithful fake query builder:
 *   - supports `.then()` (awaitable)
 *   - has NO `.catch` method on the builder itself
 *   - can be made to reject (simulating a DB failure at exactly Step 7)
 *
 * Expected behavior after the fix: the webhook responds 200 with
 * `{ received: true, processed: true }` whether or not the non-authoritative
 * notification insert succeeds. Payment processing, ledger writes, and
 * idempotency are exercised through their real code paths (with the Supabase
 * client monkey-patched) but their behavior is NOT modified.
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import express from 'express';

import 'dotenv/config';
import { supabase } from '../supabaseClient.js';
import { webhookVerifier } from '../services/WebhookVerifier.js';
import webhookRouter from '../routes/webhook.js';

// ── Postgrest-faithful fake builder ──────────────────────────────────────

class FakePostgrestError extends Error {
  constructor(code, message, details = null) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

/**
 * Mimics PostgrestFilterBuilder: chainable filters, awaitable via `.then`,
 * deliberately WITHOUT `.catch`/`.finally` (matches the real builder).
 */
function makeBuilder(result) {
  const state = { result };
  const builder = {};
  const chainable = ['select', 'eq', 'in', 'gte', 'lte', 'order', 'limit', 'update', 'single', 'maybeSingle', 'upsert'];
  for (const m of chainable) {
    builder[m] = () => builder;
  }
  builder.insert = () => builder;
  builder.then = (onFulfilled, onRejected) =>
    Promise.resolve(state.result).then(onFulfilled, onRejected);
  return builder;
}

function okSingle(row) {
  return { data: row, error: null, count: null, status: 200 };
}

function notFoundSingle() {
  return { data: null, error: new FakePostgrestError('PGRST116', 'Row not found'), count: 0, status: 406 };
}

// ── Fixture gateway (provider-agnostic stub) ─────────────────────────────

const REFERENCE = 'CAPFIXTURE-0001';

function makeStubGateway() {
  return {
    providerName: 'monnify',
    getProviderName() { return 'monnify'; },
    async getTransaction(reference) {
      assert.equal(reference, REFERENCE);
      // Monnify-shaped transaction: SUCCESS + SETTLED so verification passes.
      return {
        transactionReference: reference,
        status: 'SUCCESS',
        settlementStatus: 'SETTLED',
        amount: 5000,
        destinationAccountDetails: { accountNumber: '2000001' },
      };
    },
    parseWebhookReference(payload) {
      return payload?.transactionReference || payload?.reference || null;
    },
    parseWebhookEventId(payload) {
      return payload?.eventId || payload?.transactionReference || null;
    },
    parseWebhookAmount(payload) {
      return payload?.amountPaid || payload?.amount || null;
    },
    parseWebhookDVA(payload) {
      return payload?.destinationAccountDetails?.accountNumber || payload?.accountNumber || null;
    },
  };
}

// ── Supabase scenario wiring ─────────────────────────────────────────────

const originalFrom = supabase.from;
const originalRpc = supabase.rpc;

let notificationsResult; // what Step 7's insert resolves/rejects with
let notificationInserts = [];
let ledgerRpcCalls = [];

function installScenario({ paymentAccountResult } = {}) {
  notificationInserts = [];
  ledgerRpcCalls = [];

  supabase.rpc = (fn, params) => {
    if (fn === 'record_verified_payment') {
      ledgerRpcCalls.push(params);
      return makeBuilder(okSingle({
        already_processed: false,
        payment_transaction_id: 'pt-1',
        ledger_entry_id: 'le-1',
      }));
    }
    return makeBuilder({ data: null, error: null });
  };

  supabase.from = (table) => {
    switch (table) {
      case 'payment_accounts': {
        // Used for DVA resolution AND student-ownership verification.
        if (paymentAccountResult) return makeBuilder(paymentAccountResult);
        return makeBuilder(okSingle({
          id: 'pa-1',
          school_id: 'sch-1',
          student_id: 'stu-1',
          account_status: 'ACTIVE',
          students: { id: 'stu-1', school_id: 'sch-1', first_name: 'Ada', last_name: 'Obi' },
        }));
      }
      case 'payment_transactions':
        // Idempotency pre-check: reference NOT yet processed.
        return makeBuilder(notFoundSingle());
      case 'gateway_assignments':
        return makeBuilder(okSingle({
          id: 'ga-1',
          school_id: 'sch-1',
          provider: 'monnify',
          status: 'ACTIVE',
        }));
      case 'students':
        return makeBuilder(okSingle({
          id: 'stu-1',
          guardian_id: 'gua-1',
          first_name: 'Ada',
          last_name: 'Obi',
          guardians: { primary_phone: '08030000000' },
        }));
      case 'reconciliation_runs':
        return makeBuilder(okSingle({ id: 'rr-1' }));
      case 'audit_logs':
        return makeBuilder(okSingle({ id: 'al-1' }));
      case 'notifications': {
        const b = makeBuilder(notificationsResult);
        const originalInsert = b.insert.bind(b);
        b.insert = (row) => {
          notificationInserts.push(row);
          return originalInsert();
        };
        return b;
      }
      default:
        throw new Error(`Unexpected table in webhook test scenario: ${table}`);
    }
  };
}

// ── HTTP harness around the real router ──────────────────────────────────

let server;
let baseUrl;

// Mirror production wiring (index.ts): JSON body parsing happens before the
// router is mounted.
const app = express();
app.use(express.json());
app.use(webhookRouter);

function postWebhook(body) {
  return fetch(`${baseUrl}/monnify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('webhook Step 7 notification failure handling', () => {
  before(async () => {
    server = createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const addr = server.address();
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  after(async () => {
    supabase.from = originalFrom;
    supabase.rpc = originalRpc;
    server.closeAllConnections?.();
    await new Promise((resolve) => server.close(resolve));
  });

  test('successful webhook still returns 200 processed when notification insert succeeds', async () => {
    notificationsResult = okSingle({ id: 'not-1' });
    installScenario();
    webhookVerifier.getGateway = () => makeStubGateway();

    const res = await postWebhook({
      eventId: 'evt-success-1',
      transactionReference: REFERENCE,
      amountPaid: 50, // ₦50 → 5000 kobo after route conversion
      destinationAccountDetails: { accountNumber: '2000001' },
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.deepEqual(body, { received: true, processed: true });
    // Payment+ledger RPC ran exactly once with integer kobo amount.
    assert.equal(ledgerRpcCalls.length, 1);
    assert.equal(ledgerRpcCalls[0].p_amount_minor, 5000);
    assert.equal(ledgerRpcCalls[0].p_reference, REFERENCE);
    assert.equal(notificationInserts.length, 1);
  });

  test('notification DB failure no longer crashes the webhook (was TypeError → 500)', async () => {
    // Simulate a hard DB failure inside Step 7's insert.
    notificationsResult = { data: null, error: new FakePostgrestError('23505', 'duplicate key') };
    installScenario();
    webhookVerifier.getGateway = () => makeStubGateway();

    const res = await postWebhook({
      eventId: 'evt-fail-1',
      transactionReference: REFERENCE,
      amountPaid: 50, // ₦50 → 5000 kobo after route conversion
      destinationAccountDetails: { accountNumber: '2000001' },
    });
    const body = await res.json();

    // Pre-fix behavior: TypeError("…catch is not a function") → outer catch →
    // 500 {"error":"Webhook processing failed"} despite successful payment.
    assert.equal(res.status, 200);
    assert.deepEqual(body, { received: true, processed: true });
    // Financial path completed exactly once BEFORE the notification step.
    assert.equal(ledgerRpcCalls.length, 1);
    assert.equal(ledgerRpcCalls[0].p_amount_minor, 5000);
    assert.equal(notificationInserts.length, 1);
  });

  test('notification builder without .catch cannot crash the handler (regression guard)', async () => {
    notificationsResult = okSingle({ id: 'not-2' });
    installScenario();
    webhookVerifier.getGateway = () => makeStubGateway();

    // Guard the fixture itself: our fake must mirror the real builder by
    // having NO .catch method, otherwise these tests prove nothing.
    const raw = supabase.from('notifications');
    assert.equal(typeof raw.then, 'function');
    assert.equal(raw.catch, undefined);

    const res = await postWebhook({
      eventId: 'evt-guard-1',
      transactionReference: REFERENCE,
      amountPaid: 50, // ₦50 → 5000 kobo after route conversion
      destinationAccountDetails: { accountNumber: '2000001' },
    });
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { received: true, processed: true });
  });

  test('unknown DVA still returns the documented soft-200 response', async () => {
    notificationsResult = okSingle({ id: 'not-3' });
    // DVA lookup fails → the route must soft-acknowledge WITHOUT recording money.
    installScenario({ paymentAccountResult: notFoundSingle() });
    webhookVerifier.getGateway = () => makeStubGateway();

    const res = await postWebhook({
      eventId: 'evt-nodva-1',
      transactionReference: REFERENCE,
      amountPaid: 50,
      destinationAccountDetails: { accountNumber: '9999999' },
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.deepEqual(body, { received: true, warning: 'DVA not found' });
    assert.equal(ledgerRpcCalls.length, 0); // nothing financially recorded
    assert.equal(notificationInserts.length, 0);
  });
});
