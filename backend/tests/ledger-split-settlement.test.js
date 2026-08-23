/**
 * Phase 2 regression tests — split-settlement ledger writer.
 *
 * Context: ledger_entries requires client_sequence (NOT NULL) and
 * device_id (NOT NULL). The legacy recordSplitSettlement writer omitted both,
 * so any invocation would fail at the database. The platform's canonical
 * ledger writer — the record_verified_payment RPC (migration 0025) — already
 * defines the designated convention for server-originated postings:
 *   client_sequence = 0, device_id = 'payment-webhook'
 *
 * These tests pin that convention and the writer's financial passthrough
 * behavior. NO live database writes are performed; the Supabase client is
 * replaced with a capture-only fake.
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import 'dotenv/config';
import { supabase } from '../supabaseClient.js';
import { LedgerService } from '../services/LedgerService.js';

const originalFrom = supabase.from;

describe('LedgerService.recordSplitSettlement', () => {
  let inserts;

  before(() => {
    inserts = [];
    supabase.from = (table) => {
      assert.equal(table, 'ledger_entries', 'writer must only touch ledger_entries');
      const builder = {
        insert(row) { inserts.push(row); return builder; },
        then(res) { return Promise.resolve({ data: null, error: null }).then(res); },
      };
      return builder;
    };
  });

  after(() => {
    supabase.from = originalFrom;
  });

  test('posts one CREDIT entry per settlement with server-origin identity', async () => {
    inserts.length = 0;
    await LedgerService.recordSplitSettlement(
      'sch-1',
      'stu-1',
      'pt-1',
      [
        { destination: 'school', account_number: '1234567890', amount: 48000, category: 'TUITION' },
        { destination: 'capflux', account_number: '9990001111', amount: 2000, category: 'TECH_LEVY' },
      ]
    );

    assert.equal(inserts.length, 2);
    for (const row of inserts) {
      // The fix under test: required server-origin identity columns present,
      // using the canonical RPC convention (never invented per-call values).
      assert.equal(row.client_sequence, 0);
      assert.equal(row.device_id, 'payment-webhook');
      // Financial passthrough unchanged.
      assert.equal(row.entry_type, 'CREDIT');
      assert.equal(row.school_id, 'sch-1');
      assert.equal(row.student_id, 'stu-1');
      assert.equal(row.reference_id, 'pt-1');
    }
    // Amounts preserved exactly as provided (major units, legacy semantics).
    assert.equal(inserts[0].amount, 48000);
    assert.equal(inserts[1].amount, 2000);
    // Categories pass through when provided.
    assert.equal(inserts[0].entry_category, 'TUITION');
    assert.equal(inserts[1].entry_category, 'TECH_LEVY');
    // Metadata still carries settlement routing details.
    assert.deepEqual(inserts[0].metadata, {
      settlement_destination: 'school',
      settlement_account: '1234567890',
    });
  });

  test('missing category falls back to TUITION (legacy behavior)', async () => {
    inserts.length = 0;
    await LedgerService.recordSplitSettlement(
      'sch-2',
      'stu-2',
      'pt-2',
      [{ destination: 'school', account_number: '5555555555', amount: 100 }]
    );
    assert.equal(inserts.length, 1);
    assert.equal(inserts[0].entry_category, 'TUITION');
    assert.equal(inserts[0].client_sequence, 0);
    assert.equal(inserts[0].device_id, 'payment-webhook');
  });

  test('insert failures are logged and do not abort the batch (legacy semantics)', async () => {
    inserts.length = 0;
    const originalError = console.error;
    let logged = 0;
    console.error = () => { logged += 1; };
    try {
      supabase.from = () => ({
        insert() {
          return { then: (res) => Promise.resolve({ data: null, error: { message: 'boom' } }).then(res) };
        },
      });
      await LedgerService.recordSplitSettlement(
        'sch-3', 'stu-3', 'pt-3',
        [
          { destination: 'school', account_number: '1', amount: 10 },
          { destination: 'capflux', account_number: '2', amount: 20 },
        ]
      );
      assert.equal(logged, 2, 'each failed entry logs loudly, loop continues');
    } finally {
      console.error = originalError;
      // restore scenario-level fake for other tests in this file
      supabase.from = (table) => {
        assert.equal(table, 'ledger_entries');
        const builder = {
          insert(row) { inserts.push(row); return builder; },
          then(res) { return Promise.resolve({ data: null, error: null }).then(res); },
        };
        return builder;
      };
    }
  });
});
