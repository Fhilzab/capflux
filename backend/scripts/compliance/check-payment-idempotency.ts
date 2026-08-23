/**
 * check-payment-idempotency — verify the DB-level idempotency constraints and
 * the canonical posting path still exist. This is the automated guard for the
 * ONE payment → ONE transaction → ONE ledger effect guarantee.
 */
import { readFile, result, anyFileMatches, listFiles, type CheckResult } from './lib.js';

interface Requirement {
  id: string;
  detail: string;
  test: () => boolean;
}

export function run(): CheckResult {
  const migrations = listFiles('supabase/migrations', ['.sql']);
  const allSql = (): boolean => migrations.length > 0;

  const paymentService = readFile('backend/services/PaymentService.ts') ?? '';
  const webhookRoute = readFile('backend/routes/webhook.ts') ?? '';
  const verifier = readFile('backend/services/WebhookVerifier.ts') ?? '';

  const requirements: Requirement[] = [
    { id: 'IDEM-MIGRATIONS-PRESENT', detail: 'supabase/migrations contains SQL files', test: allSql },
    {
      id: 'IDEM-TXN-EVENT-UNIQUE',
      detail: 'uq_payment_transactions_provider_event unique index exists',
      test: () => anyFileMatches(migrations, /uq_payment_transactions_provider_event/),
    },
    {
      id: 'IDEM-TXN-IDEMPOTENCY-UNIQUE',
      detail: 'unique_transaction_idempotency_key partial unique index exists',
      test: () => anyFileMatches(migrations, /unique_transaction_idempotency_key/),
    },
    {
      id: 'IDEM-LEDGER-KEY-UNIQUE',
      detail: 'uq_ledger_idempotency_key unique index exists',
      test: () => anyFileMatches(migrations, /uq_ledger_idempotency_key/),
    },
    {
      id: 'IDEM-LEDGER-SOURCE-UNIQUE',
      detail: 'uq_ledger_source_document unique index exists',
      test: () => anyFileMatches(migrations, /uq_ledger_source_document/),
    },
    {
      id: 'IDEM-SETTLEMENT-UNIQUE',
      detail: 'uq_settlement_records_idempotency unique index exists',
      test: () => anyFileMatches(migrations, /uq_settlement_records_idempotency/),
    },
    {
      id: 'IDEM-RPC-CALLED',
      detail: 'PaymentService posts via record_verified_payment RPC',
      test: () => paymentService.includes('record_verified_payment'),
    },
    {
      id: 'IDEM-RPC-DEFINED',
      detail: 'record_verified_payment function defined in a migration',
      test: () => anyFileMatches(migrations, /CREATE (?:OR REPLACE )?FUNCTION (?:public\.)?record_verified_payment/),
    },
    {
      id: 'IDEM-RPC-DUP-BRANCH',
      detail: 'RPC handles duplicate webhook (already_processed branch in webhook route)',
      test: () => webhookRoute.includes('alreadyProcessed'),
    },
    {
      id: 'IDEM-KOBO-GUARD',
      detail: 'amountMinor positive-integer guard present in PaymentService',
      test: () => /Number\.isInteger\(amountMinor\)/.test(paymentService),
    },
    {
      id: 'VERIFY-API-BEFORE-POST',
      detail: 'WebhookVerifier performs gateway API verification before posting',
      test: () => verifier.includes('verifyWithAPI') && verifier.includes('getTransaction'),
    },
  ];

  const findings: CheckResult['findings'] = [];
  let missing = 0;
  for (const r of requirements) {
    if (!r.test()) {
      missing++;
      findings.push({ id: r.id, detail: `MISSING: ${r.detail}`, severity: 'critical' });
    }
  }

  return result(
    'check-payment-idempotency',
    'Financial integrity / idempotency structure',
    missing === 0 ? 'PASS' : 'FAIL',
    missing === 0
      ? `${requirements.length}/${requirements.length} structural integrity requirements verified.`
      : `${missing}/${requirements.length} requirements MISSING — financial integrity guarantees may have been altered. STOP and review against docs/compliance/FINANCIAL_INTEGRITY_AUDIT.md.`,
    findings
  );
}
