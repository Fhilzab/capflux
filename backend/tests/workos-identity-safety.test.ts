/**
 * WorkOS identity-safety regression suite.
 *
 * Guards the invariants of the WorkOS → CAPFLUX identity bridge without
 * touching the database (static analysis of migrations + service sources):
 *
 *   1. WorkOS user IDs ("user_...") are TEXT; CAPFLUX IDs are UUIDs — the two
 *      must never be mixed (no WorkOS ID written to a UUID column).
 *   2. user_identity_links is the ONLY authoritative mapping (no email fallback).
 *   3. Provisioning is atomic with concurrency protection + fail-closed email
 *      collision behavior (UNIQUE(email) violation re-raised, never merged).
 *   4. Webhook event IDs use the current provider-neutral format — no stale
 *      "evt_" prefix assumptions in live code.
 *   5. Webhook signature verification is mandatory (fail closed).
 *   6. user.updated fails closed for unknown identities; user.deleted preserves
 *      financial records; revoked identities cannot resurrect.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd(), '..');
const MIGRATIONS_DIR = join(ROOT, 'supabase', 'migrations');

function readMigration(name: string): string {
  return readFileSync(join(MIGRATIONS_DIR, name), 'utf-8');
}

function readSource(rel: string): string {
  return readFileSync(join(ROOT, rel), 'utf-8');
}

const webhookService = () => readSource('backend/services/WorkOSWebhookService.ts');
const webhookRoute = () => readSource('backend/routes/workos-webhook.ts');
const legacyAuthRoutes = () => readSource('backend/routes/auth.ts');

describe('WorkOS identity bridge safety', () => {
  describe('event ID format (no stale evt_ assumptions in live code)', () => {
    it('WorkOSWebhookService does not reference the legacy "evt_" prefix', () => {
      assert.ok(
        !/evt_\.\.\.|['"]evt_/.test(webhookService()),
        'live webhook service must not assume evt_-prefixed event IDs'
      );
    });

    it('webhook route does not validate event IDs against an evt_ prefix', () => {
      assert.ok(
        !/evt_/.test(webhookRoute()),
        'webhook route must not contain evt_ assumptions'
      );
    });

    it('provider-neutral event-ID constraint migration exists', () => {
      const files = readdirSync(MIGRATIONS_DIR);
      assert.ok(
        files.some((f) => /finalize.*event_id_constraint/.test(f)),
        'finalize event-ID constraint migration must exist'
      );
      const sql = readMigration(
        files.find((f) => /finalize.*event_id_constraint/.test(f)) as string
      );
      assert.match(
        sql,
        /char_length\(workos_event_id\) BETWEEN 1 AND 255/,
        'constraint must be provider-neutral length check'
      );
    });
  });

  describe('UUID / WorkOS-ID type separation', () => {
    it('legacy auth routes guard users upserts against non-UUID identities', () => {
      const src = legacyAuthRoutes();
      assert.match(
        src,
        /UUID_RE|not a CAPFLUX UUID|is not a UUID/i,
        'upsertUserRecords must refuse to write non-UUID ids into UUID columns'
      );
    });

    it('webhook service upsert uses the canonical CAPFLUX UUID (never the WorkOS ID)', () => {
      const src = webhookService();
      // The service resolves workos_user_id -> capflux_user_id via the bridge,
      // then writes ONLY the resolved UUID into users/profile rows.
      assert.match(src, /findCAPFLUXUserIdByWorkOSId/, 'resolution must go through the identity bridge');
      assert.match(src, /id: capfluxUserId/, 'users upsert must use the canonical UUID');
      assert.match(src, /user_id: capfluxUserId/, 'profile upsert must use the canonical UUID');
    });

    it('identity-links table enforces TEXT vs UUID separation at the schema level', () => {
      const sql = readMigration('202608230002_user_identity_links.sql');
      assert.match(sql, /workos_user_id\s+text NOT NULL/i, 'workos_user_id must be TEXT');
      assert.match(sql, /capflux_user_id\s+uuid NOT NULL/i, 'capflux_user_id must be UUID');
      assert.match(
        sql,
        /CHECK \(capflux_user_id::text <> workos_user_id\)/,
        'schema must forbid identical identity values across the bridge'
      );
    });
  });

  describe('no email-based identity resolution', () => {
    it('webhook service never resolves identity by email', () => {
      const src = webhookService();
      assert.ok(!/\.eq\(['"]email['"]/.test(src), 'no email equality lookup in webhook service');
      assert.ok(!/byEmail|findByEmail|lookupByEmail/i.test(src), 'no email lookup helpers in webhook service');
    });

    it('user.updated fails closed for unknown identities (no provisioning)', () => {
      const src = webhookService();
      assert.match(
        src,
        /No identity link found for WorkOS user/,
        'unknown user.updated must fail closed with an explicit error'
      );
      // handleUserUpdated must not call the provisioning RPC.
      const updatedFn = src.match(/async handleUserUpdated[\s\S]*?^\s{2}\}/m);
      assert.ok(updatedFn, 'handleUserUpdated must exist');
      assert.ok(
        !/provisionCAPFLUXUserFromWorkOS|provision_workos_user/.test(updatedFn[0]),
        'handleUserUpdated must never provision'
      );
    });
  });

  describe('atomic provisioning guarantees', () => {
    const rpcSql = () => readMigration('202608280002_atomic_workos_user_provisioning.sql');

    it('provisioning uses a deterministic advisory lock for the WorkOS identity', () => {
      assert.match(rpcSql(), /pg_advisory_xact_lock/, 'concurrent user.created must serialize per identity');
      assert.match(rpcSql(), /md5\(p_workos_user_id\)/, 'lock key must derive from the WorkOS user ID');
    });

    it('provisioning checks for an existing ACTIVE link before creating rows', () => {
      const sql = rpcSql();
      const checkPos = sql.indexOf("AND status = 'ACTIVE'");
      const insertPos = sql.indexOf('INSERT INTO public.users');
      assert.ok(checkPos !== -1 && insertPos !== -1 && checkPos < insertPos,
        'existing-identity check must precede user creation');
    });

    it('revoked identities cannot be resurrected', () => {
      assert.match(rpcSql(), /cannot be resurrected/, 'REVOKED identities must raise, not re-provision');
      assert.match(webhookService(), /cannot be resurrected/, 'service layer must also reject revoked identities');
    });

    it('email collisions fail closed (unique_violation re-raised, never merged)', () => {
      const sql = rpcSql();
      assert.match(sql, /WHEN unique_violation THEN/, 'unique violations must be handled explicitly');
      assert.match(
        sql,
        /unique constraint violation/,
        'unresolvable collisions must re-raise, not merge accounts'
      );
    });

    it('provisioning RPC is service_role-only with restricted search_path', () => {
      const sql = rpcSql();
      assert.match(sql, /SECURITY DEFINER/i, 'RPC must be SECURITY DEFINER');
      assert.match(sql, /SET search_path = 'public'/i, 'RPC must restrict search_path');
      assert.match(
        sql,
        /REVOKE ALL ON FUNCTION public\.provision_workos_user.*FROM PUBLIC, anon, authenticated/,
        'RPC must revoke client execution'
      );
      assert.match(sql, /GRANT EXECUTE.*TO service_role/, 'RPC must grant execution to service_role only');
    });
  });

  describe('webhook signature + idempotency', () => {
    it('webhook route verifies signatures with the WorkOS SDK and rejects invalid ones', () => {
      const src = webhookRoute();
      assert.match(src, /constructEvent/, 'must verify via WorkOS SDK constructEvent');
      assert.match(src, /WORKOS_WEBHOOK_SECRET/, 'must use the webhook secret');
      assert.match(src, /status\(401\)/, 'invalid/missing signature must be rejected with 401');
    });

    it('webhook route preserves the raw body for signature verification', () => {
      const indexSrc = readSource('backend/index.ts');
      assert.match(
        indexSrc,
        /express\.raw\(\{ type: 'application\/json' \}\)\s*,\s*workosWebhookRoutes/,
        'raw-body middleware must run before JSON parsing on the webhook path'
      );
    });

    it('dispatch uses durable claim/complete/fail lifecycle (retry-safe)', () => {
      const src = webhookService();
      assert.match(src, /workos_webhook_event_claim/, 'events must be claimed durably');
      assert.match(src, /workos_webhook_event_complete/, 'success must complete the event');
      assert.match(src, /workos_webhook_event_fail/, 'failure must mark retryable state, not success');
    });
  });

  describe('deletion preserves financial history', () => {
    it('user.deleted soft-deactivates and revokes the link (no financial deletes)', () => {
      const src = webhookService();
      const deletedFn = src.match(/async handleUserDeleted[\s\S]*?^\s{2}\}/m);
      assert.ok(deletedFn, 'handleUserDeleted must exist');
      assert.match(deletedFn[0], /REVOKED/, 'identity link must be revoked');
      assert.ok(
        !/DELETE FROM public\.(transactions|payments|ledger|invoices|settlements)/i.test(deletedFn[0]),
        'deletion must not remove financial records'
      );
    });
  });

  describe('identity bridge is service-controlled', () => {
    it('user_identity_links has deny-by-default RLS with no client policies', () => {
      const sql = readMigration('202608230002_user_identity_links.sql');
      assert.match(sql, /ENABLE ROW LEVEL SECURITY/, 'RLS must be enabled');
      assert.match(
        sql,
        /REVOKE ALL ON public\.user_identity_links FROM anon, authenticated/,
        'clients must be revoked'
      );
      assert.ok(!/CREATE POLICY/i.test(sql), 'no client policies by design');
    });
  });
});
