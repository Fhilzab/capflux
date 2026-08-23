/**
 * Phase 5 — webhook hardening suite.
 *
 * Drives the REAL webhook router over HTTP (production wiring: express.json
 * then the router) against a Postgrest-faithful fake Supabase client.
 * Covers the approved hardening matrix: valid payment, invalid signature,
 * duplicate delivery / provider retry, unknown transaction, failed payment,
 * DB failure after processing, and malformed payloads. Reversals are NOT part
 * of the webhook pipeline (staff-initiated via POST /api/payments/:id/reverse;
 * state machine covered by tests/payment-lifecycle.test.js).
 *
 * Financial behavior asserted, never modified:
 *   - record_verified_payment RPC receives integer kobo amounts exactly once
 *   - no financial write happens on signature/DVA/idempotency short-circuits
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import crypto from 'node:crypto';
import express from 'express';

import 'dotenv/config';
import { supabase } from '../supabaseClient.js';
import { webhookVerifier } from '../services/WebhookVerifier.js';
import PaymentService from '../services/PaymentService.js';
import webhookRouter from '../routes/webhook.js';

// ── Fake builder ─────────────────────────────────────────────────────────

function okSingle(row) {
  return { data: row, error: null, count: null, status: 200 };
}
function errSingle(code, message) {
  return { data: null, error: Object.assign(new Error(message), { code }), count: null, status: 406 };
}

class Builder {
  constructor(result) {
    this._result = result;
    for (const m of ['select', 'eq', 'in', 'gte', 'lte', 'order', 'limit', 'single', 'maybeSingle', 'update']) {
      this[m] = () => this;
    }
    this.then = (res, rej) => Promise.resolve(this._result).then(res, rej);
  }
  insert() { return this; }
}

// ── Fixture gateway (Monnify-shaped) ─────────────────────────────────────

const REF = 'HARDEN-0001';

function stubGateway(overrides = {}) {
  const txn = {
    transactionReference: REF,
    status: 'SUCCESS',
    settlementStatus: 'SETTLED',
    amount: 50,
    destinationAccountDetails: { accountNumber: '2000001' },
    ...(overrides.transaction ?? {}),
  };
  return {
    providerName: 'monnify',
    getProviderName() { return 'monnify'; },
    getTransaction: overrides.getTransaction ?? (async () => txn),
    parseWebhookReference: (p) => p?.transactionReference || p?.reference || null,
    parseWebhookEventId: (p) => p?.eventId || p?.transactionReference || null,
    parseWebhookAmount: (p) => p?.amountPaid || p?.amount || null,
    parseWebhookDVA: (p) => p?.destinationAccountDetails?.accountNumber || p?.accountNumber || null,
  };
}

const PAYLOAD = () => ({
  eventId: 'evt-' + Math.random().toString(36).slice(2),
  transactionReference: REF,
  amountPaid: 50, // ₦50 → 5000 kobo
  destinationAccountDetails: { accountNumber: '2000001' },
});

// ── Scenario state ───────────────────────────────────────────────────────

let scenario = {};
let rpcCalls;

const originalFrom = supabase.from;
const originalRpc = supabase.rpc;
const originalGetGateway = webhookVerifier.getGateway;

function install() {
  rpcCalls = [];
  supabase.rpc = (fn, params) => {
    if (fn === 'record_verified_payment') {
      rpcCalls.push(params);
      if (scenario.rpcError) {
        return new Builder({ data: null, error: scenario.rpcError });
      }
      return new Builder(okSingle({ already_processed: false, payment_transaction_id: 'pt-1', ledger_entry_id: 'le-1' }));
    }
    return new Builder({ data: null, error: null });
  };

  supabase.from = (table) => {
    switch (table) {
      case 'payment_accounts':
        return new Builder(scenario.noAccount ? errSingle('PGRST116', 'not found') : okSingle({
          id: 'pa-1', school_id: 'sch-1', student_id: 'stu-1', account_status: 'ACTIVE',
          students: { id: 'stu-1', school_id: 'sch-1', first_name: 'Ada', last_name: 'Obi' },
        }));
      case 'payment_transactions':
        // Idempotency pre-check inside WebhookVerifier.verifyWebhook.
        return new Builder(scenario.alreadyProcessed ? okSingle({ id: 'pt-exists' }) : errSingle('PGRST116', 'not found'));
      case 'gateway_assignments':
        return new Builder(okSingle({ id: 'ga-1', school_id: 'sch-1', provider: 'monnify', status: 'ACTIVE' }));
      case 'students':
        return new Builder(okSingle({ id: 'stu-1', guardian_id: null, first_name: 'Ada', last_name: 'Obi', guardians: null }));
      case 'reconciliation_runs': {
        const b = new Builder(okSingle({ id: 'rr-1' }));
        if (scenario.reconInsertRejects) {
          b.then = (_res, rej) => Promise.reject(new Error('recon down')).then(_res, rej);
        }
        return b;
      }
      case 'audit_logs':
      case 'notifications':
        return new Builder(scenario.notifyRejects ? errSingle('23505', 'duplicate') : okSingle({ id: 'x-1' }));
      default:
        throw new Error(`Unexpected table: ${table}`);
    }
  };
}

// ── Harness ──────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());
app.use(webhookRouter);

let server;
let baseUrl;

describe('webhook hardening matrix', () => {
  before(async () => {
    server = createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });
  after(async () => {
    supabase.from = originalFrom;
    supabase.rpc = originalRpc;
    webhookVerifier.getGateway = originalGetGateway;
    server.closeAllConnections?.();
    await new Promise((resolve) => server.close(resolve));
  });

  function post(body, headers = {}) {
    return fetch(`${baseUrl}/monnify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });
  }

  test('1+6. valid webhook → successful payment recorded once in kobo, 200 processed', async () => {
    scenario = {}; install();
    webhookVerifier.getGateway = () => stubGateway();

    const res = await post(PAYLOAD());
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.deepEqual(body, { received: true, processed: true });
    assert.equal(rpcCalls.length, 1);
    assert.equal(rpcCalls[0].p_amount_minor, 5000); // integer kobo
    assert.equal(rpcCalls[0].p_reference, REF);
  });

  test('2. invalid signature rejected before any processing', async () => {
    scenario = {}; install();
    webhookVerifier.getGateway = () => stubGateway();
    const secret = process.env.MONNIFY_WEBHOOK_SECRET;
    const badSig = crypto.createHmac('sha512', secret).update('tampered-body').digest('hex');

    const res = await post(PAYLOAD(), { 'x-monnify-signature': badSig });
    const body = await res.json();

    assert.equal(res.status, 401);
    assert.deepEqual(body, { error: 'Invalid webhook signature' });
    assert.equal(rpcCalls.length, 0, 'no financial write on bad signature');
  });

  test('3+5. duplicate delivery / provider retry is idempotent soft-200', async () => {
    scenario = { alreadyProcessed: true }; install();
    webhookVerifier.getGateway = () => stubGateway();

    const res = await post(PAYLOAD());
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.deepEqual(body, { received: true, alreadyProcessed: true });
    assert.equal(rpcCalls.length, 0, 'no duplicate ledger/payment write');
  });

  test('4. unknown transaction surfaces a 500 with provider detail (retry semantics preserved)', async () => {
    scenario = {}; install();
    webhookVerifier.getGateway = () => stubGateway({
      getTransaction: async () => { throw new Error(`Transaction ${REF} not found`); },
    });

    const res = await post(PAYLOAD());
    const body = await res.json();

    assert.equal(res.status, 500);
    assert.equal(body.error, 'Webhook processing failed');
    assert.match(String(body.details), /not found/);
    assert.equal(rpcCalls.length, 0);
  });

  test('7. failed payment (settlement not completed) does not record money', async () => {
    scenario = {}; install();
    webhookVerifier.getGateway = () => stubGateway({
      transaction: { status: 'PENDING', settlementStatus: 'PENDING' },
    });

    const res = await post(PAYLOAD());
    const body = await res.json();

    assert.equal(res.status, 500);
    assert.match(String(body.details), /settlement not completed|not successful/);
    assert.equal(rpcCalls.length, 0);
  });

  test('9. DB failure after payment processing still returns success (Step 6 + Step 7 isolation)', async () => {
    scenario = { notifyRejects: true, reconInsertRejects: true }; install();
    webhookVerifier.getGateway = () => stubGateway();

    const res = await post(PAYLOAD());
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.deepEqual(body, { received: true, processed: true });
    // The financial commit happened exactly once BEFORE the failing steps.
    assert.equal(rpcCalls.length, 1);
    assert.equal(rpcCalls[0].p_amount_minor, 5000);
  });

  test('10a. malformed JSON body rejected by parser without touching finances', async () => {
    scenario = {}; install();
    webhookVerifier.getGateway = () => stubGateway();

    const res = await post('{ not-json');
    assert.equal(res.status, 400);
    assert.equal(rpcCalls.length, 0);
  });

  test('10b. payload without amount fails verification, nothing recorded', async () => {
    scenario = {}; install();
    webhookVerifier.getGateway = () => stubGateway({
      transaction: { status: 'SUCCESS', settlementStatus: 'SETTLED' },
    });

    const res = await post({ eventId: 'evt-x', transactionReference: REF, destinationAccountDetails: { accountNumber: '2000001' } });
    const body = await res.json();

    assert.equal(res.status, 500);
    assert.match(String(body.details), /Invalid amount/);
    assert.equal(rpcCalls.length, 0);
  });

  test('8. reversal path is outside the webhook pipeline (state-machine guard intact)', async () => {
    // SUCCESS -> REVERSED allowed; FAILED -> REVERSED forbidden. Direct guard
    // check against the canonical state machine used by the reverse route.
    const { VALID_TRANSITIONS } = await import('../services/PaymentService.js');
    assert.deepEqual(VALID_TRANSITIONS.SUCCESS, ['REVERSED']);
    assert.deepEqual(VALID_TRANSITIONS.FAILED, []);
    assert.deepEqual(VALID_TRANSITIONS.PENDING.sort(), ['FAILED', 'PROCESSING']);
    assert.deepEqual(VALID_TRANSITIONS.PROCESSING, ['SUCCESS', 'FAILED']);
  });
});
