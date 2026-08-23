/**
 * Phase 3 regression test — LEGACY_ACCOUNT_CLAIMED audit failure is loud.
 *
 * Context: audit_logs.school_id is NOT NULL (FK to schools). The pre-auth
 * account-claim flow has no school and no authenticated actor, so its
 * LEGACY_ACCOUNT_CLAIMED audit insert can never persist against the live
 * schema. Historically that failure was swallowed silently (_err). The flow's
 * schema gap is escalated to the owner; this test pins two properties that
 * must hold regardless of that outcome:
 *   1. The endpoint still returns the GENERIC response (no enumeration leak).
 *   2. The audit write failure is logged loudly (console.error).
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import express from 'express';

import 'dotenv/config';
import { supabase } from '../supabaseClient.js';
import authService from '../services/WorkOSAuthService.js';
import authRouter from '../routes/auth.js';

const originalFrom = supabase.from;
const originalSendReset = authService.sendPasswordResetEmail;

describe('claim-account audit hardening', () => {
  let server;
  let baseUrl;
  let loudLogs;

  const app = express();
  app.use(express.json());
  app.use(authRouter);

  before(async () => {
    server = createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;

    // Legacy row already carries a workos_user_id so no WorkOS lookup/creation
    // runs. Password-reset email is stubbed at the service boundary.
    authService.sendPasswordResetEmail = async () => ({ success: true });

    supabase.from = (table) => {
      if (table === 'legacy_identity_migrations') {
        const row = { id: 'lim-1', status: 'PENDING', workos_user_id: 'user_01XYZ' };
        const b = {
          select: () => b,
          eq: () => b,
          maybeSingle: () => Promise.resolve({ data: row, error: null }),
          upsert: () => Promise.resolve({ data: null, error: null }),
        };
        return b;
      }
      if (table === 'audit_logs') {
        // Simulate the live NOT NULL violation on school_id.
        return {
          insert: () => Promise.reject(new Error('null value in column "school_id"')),
        };
      }
      throw new Error(`unexpected table ${table}`);
    };
  });

  after(() => {
    supabase.from = originalFrom;
    authService.sendPasswordResetEmail = originalSendReset;
    server.closeAllConnections?.();
    return new Promise((resolve) => server.close(resolve));
  });

  test('audit failure is logged loudly and the generic contract is preserved', async () => {
    const originalError = console.error;
    loudLogs = [];
    console.error = (...args) => { loudLogs.push(args.join(' ')); };

    try {
      const res = await fetch(`${baseUrl}/claim-account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'someone@example.com' }),
      });
      const body = await res.json();

      assert.equal(res.status, 200);
      assert.deepEqual(body, {
        success: true,
        message: 'If this account is eligible, you will receive an email with instructions.',
      });
      assert.ok(
        loudLogs.some((l) => l.includes('AUDIT WRITE FAILED') && l.includes('LEGACY_ACCOUNT_CLAIMED')),
        'expected a loud audit-failure log'
      );
    } finally {
      console.error = originalError;
    }
  });
});
