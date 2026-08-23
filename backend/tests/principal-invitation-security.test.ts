/**
 * Compliance regression test — principal invitation response hygiene.
 *
 * Control: TENANT-005 / COMP-003 (docs/compliance/SECURITY_CONTROL_MATRIX.md).
 *
 * Pins one property of the idempotent-reuse branch of
 * POST /api/kyc/principal-invitation:
 *   The stored token_hash must NEVER be returned to the caller. The route's
 *   own contract comment says "Never expose token_hash"; a prior version
 *   leaked it in the reuse branch. This test fails if the field returns.
 *
 * Note (documented gap, not covered here): acceptance binding to the invited
 * email and least-privilege role remain open remediation items under COMP-003
 * awaiting owner sign-off — see docs/compliance/COMPLIANCE_REMEDIATION_BACKLOG.md.
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import express from 'express';

import 'dotenv/config';
import { supabase } from '../supabaseClient.js';
import kycRouter from '../routes/kyc.js';

interface PatchableAuth {
  auth: {
    getUser: (token: string) => Promise<{
      data: { user: { id: string; email?: string } | null };
      error: null;
    }>;
  };
}

const AUTH_TOKEN = 'test-bearer-token';
const APP_USER_ID = '11111111-1111-4111-8111-111111111111';
const SCHOOL_ID = '22222222-2222-4222-8222-222222222222';
const STORED_HASH = 'a'.repeat(64);

const originalFrom = supabase.from;
const originalAuth = (supabase as unknown as { auth: unknown }).auth;

interface ServerWithSockets extends ReturnType<typeof createServer> {
  closeAllConnections?: () => void;
}

/**
 * A universal PostgREST-style builder double: infinitely chainable, awaitable
 * (resolves { data: final, error: null }), with explicit single/maybeSingle.
 */
function chain(final: unknown): {
  select: () => ReturnType<typeof chain>;
  eq: () => ReturnType<typeof chain>;
  in: () => ReturnType<typeof chain>;
  order: () => ReturnType<typeof chain>;
  limit: () => ReturnType<typeof chain>;
  update: () => ReturnType<typeof chain>;
  insert: () => ReturnType<typeof chain>;
  maybeSingle: () => Promise<{ data: unknown; error: null }>;
  single: () => Promise<{ data: unknown; error: null }>;
  then: (resolve: (v: { data: unknown; error: null }) => void) => void;
} {
  const b = {
    select: () => b,
    eq: () => b,
    in: () => b,
    order: () => b,
    limit: () => b,
    update: () => b,
    insert: () => b,
    maybeSingle: () => Promise.resolve({ data: final, error: null as null }),
    single: () => Promise.resolve({ data: final, error: null as null }),
    then: (resolve: (v: { data: unknown; error: null }) => void) => resolve({ data: final, error: null }),
  };
  return b;
}

describe('principal invitation security', () => {
  let server: ServerWithSockets;
  let baseUrl: string;

  const app = express();
  app.use(express.json());
  app.use(kycRouter);

  before(async () => {
    server = createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}`;

    // Authenticated principal for requireAuthSupabase.
    const patchable = supabase as unknown as PatchableAuth;
    patchable.auth = {
      getUser: async () => ({
        data: { user: { id: APP_USER_ID, email: 'owner@example.test' } },
        error: null,
      }),
    };

    supabase.from = ((table: string) => {
      if (table === 'users') return chain({ id: APP_USER_ID, email: 'owner@example.test' });
      if (table === 'school_members') {
        const b = {
          select: () => b,
          eq: () => b,
          single: () => Promise.resolve({ data: { school_id: SCHOOL_ID }, error: null }),
        };
        return b;
      }
      if (table === 'schools') return chain({ status: 'ACTIVE' });
      if (table === 'school_shareholders') {
        // The route destructures { count } from the awaited builder.
        const b = {
          select: () => b,
          eq: () => Promise.resolve({ count: 1, error: null }),
        };
        return b;
      }
      if (table === 'principal_invitations') {
        return chain({
          id: 'inv-1',
          status: 'PENDING',
          expires_at: new Date(Date.now() + 86_400_000).toISOString(),
          token_hash: STORED_HASH,
        });
      }
      // audit_logs etc.
      return chain(null);
    }) as typeof supabase.from;
  });

  after(() => {
    supabase.from = originalFrom;
    (supabase as unknown as { auth: unknown }).auth = originalAuth;
    server.closeAllConnections?.();
    server.close();
  });

  test('idempotent-reuse response never exposes the stored token_hash', async () => {
    const res = await fetch(`${baseUrl}/principal-invitation`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${AUTH_TOKEN}`,
      },
      body: JSON.stringify({ email: 'principal@example.test' }),
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as { success?: boolean; data?: Record<string, unknown> };
    assert.equal(body.success, true);
    assert.equal(body.data?.existing, true);
    assert.ok(typeof body.data?.token === 'string');
    assert.equal(
      Object.prototype.hasOwnProperty.call(body.data, 'tokenHash'),
      false,
      'token_hash must never be returned by the invitation endpoint'
    );
    assert.equal(
      JSON.stringify(body.data ?? {}).includes(STORED_HASH),
      false,
      'stored hash value must not appear anywhere in the response payload'
    );
  });
});
