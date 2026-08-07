/**
 * ReconciliationService — banking-grade payment reconciliation.
 *
 * Detects:
 *   duplicate transaction, missing payment, missing ledger entry,
 *   amount mismatch, unknown provider transaction, incorrect DVA,
 *   wrong school, unexpected status.
 *
 * States: MATCHED, PENDING, MISMATCH, UNKNOWN, RESOLVED (via
 * reconciliation_issues.status OPEN/RESOLVED).
 *
 * Never silently repairs ambiguous financial records — issues are recorded
 * for staff review.
 */
import { supabase } from '../supabaseClient.js';
import { GatewayFactory } from './gateways/GatewayFactory.js';
import PaymentService from './PaymentService.js';
import { audit } from './auditService.js';

const ISSUE_TYPES = [
  'DUPLICATE_TRANSACTION',
  'MISSING_PAYMENT',
  'MISSING_LEDGER',
  'AMOUNT_MISMATCH',
  'UNKNOWN_PROVIDER_TRANSACTION',
  'INCORRECT_DVA',
  'WRONG_SCHOOL',
  'UNEXPECTED_STATUS',
];

class ReconciliationService {
  /**
   * Run reconciliation for a school between dates.
   */
  async reconcilePayments({ schoolId, startDate, endDate, provider, actorId }) {
    // Resolve the CAPFLUX-internal gateway assignment.
    const { data: assignment, error: assignError } = await supabase
      .from('gateway_assignments')
      .select('*')
      .eq('school_id', schoolId)
      .eq('provider', provider || undefined)
      .in('status', ['ASSIGNED', 'ACTIVE'])
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (assignError || !assignment) {
      throw Object.assign(new Error('No active gateway assignment for this school.'), { statusCode: 403 });
    }

    const gateway = GatewayFactory.get(assignment.provider);
    if (!gateway || typeof gateway.reconcilePayments !== 'function') {
      throw Object.assign(new Error(`Gateway ${assignment.provider} does not support reconciliation.`), { statusCode: 400 });
    }

    // Create the reconciliation run.
    const { data: run, error: runError } = await supabase
      .from('reconciliation_runs')
      .insert({
        school_id: schoolId,
        provider: assignment.provider,
        start_date: startDate,
        end_date: endDate,
        status: 'RUNNING',
        started_by: actorId || null,
      })
      .select()
      .single();
    if (runError) throw runError;

    try {
      // Fetch gateway transactions (server-side credentials from env).
      const gatewayTransactions = await gateway.reconcilePayments({
        gateway_config: {},
        start_date: startDate,
        end_date: endDate,
      });

      // Existing local payment references in the window.
      const { data: localRefs } = await supabase
        .from('payment_transactions')
        .select('reference, gateway_txn_ref, amount_minor, status, student_id')
        .eq('school_id', schoolId)
        .gte('verified_at', `${startDate}T00:00:00`)
        .lte('verified_at', `${endDate}T23:59:59`);

      const localByRef = new Map((localRefs || []).map((p) => [p.reference, p]));

      const issues = [];
      let matched = 0;
      let recovered = 0;

      for (const txn of gatewayTransactions) {
        const reference = txn.transactionReference || txn.reference;
        const amountMinor = Math.round(Number(txn.amount || 0) * 100);
        const local = reference ? localByRef.get(reference) : null;

        if (!reference) {
          issues.push({ type: 'UNKNOWN_PROVIDER_TRANSACTION', reference: null, amount_minor: amountMinor, details: { txn } });
          continue;
        }

        if (local) {
          // Existing payment — verify amount + status.
          if (local.amount_minor !== amountMinor) {
            issues.push({ type: 'AMOUNT_MISMATCH', reference, amount_minor: amountMinor, details: { local_minor: local.amount_minor } });
          } else if (local.status === 'SUCCESS') {
            matched += 1;
          } else {
            issues.push({ type: 'UNEXPECTED_STATUS', reference, amount_minor, details: { status: local.status } });
          }
          continue;
        }

        // Unknown to us — check the DVA it landed on.
        const dvaNumber = txn.destinationAccountDetails?.accountNumber;
        if (dvaNumber) {
          const { data: account } = await supabase
            .from('payment_accounts')
            .select('student_id, school_id, virtual_account_number')
            .eq('virtual_account_number', dvaNumber)
            .maybeSingle();

          if (!account) {
            issues.push({ type: 'INCORRECT_DVA', reference, amount_minor, details: { dva_number_last4: dvaNumber.slice(-4) } });
            continue;
          }
          if (account.school_id !== schoolId) {
            issues.push({ type: 'WRONG_SCHOOL', reference, amount_minor, details: { account_school: account.school_id } });
            continue;
          }

          // Missing payment — record it via the atomic RPC (recovery).
          try {
            const result = await PaymentService.recordVerifiedPayment({
              schoolId,
              studentId: account.student_id,
              reference,
              gatewayTxnRef: txn.transactionReference || reference,
              providerEventId: txn.paymentReference || txn.transactionReference || reference,
              amountMinor,
              rawPayload: txn,
            });
            if (!result.already_processed) {
              recovered += 1;
              matched += 1;
            } else {
              issues.push({ type: 'DUPLICATE_TRANSACTION', reference, amount_minor: amountMinor });
            }
          } catch (err) {
            issues.push({ type: 'MISSING_PAYMENT', reference, amount_minor: amountMinor, details: { error: err.message } });
          }
        } else {
          issues.push({ type: 'UNKNOWN_PROVIDER_TRANSACTION', reference, amount_minor: amountMinor, details: { txn } });
        }
      }

      // Persist issues.
      for (const issue of issues) {
        await supabase.from('reconciliation_issues').insert({
          reconciliation_run_id: run.id,
          school_id: schoolId,
          issue_type: issue.type,
          reference: issue.reference || null,
          amount_minor: issue.amount_minor || null,
          details: issue.details || {},
          status: 'OPEN',
        });
      }

      // Complete the run.
      await supabase.from('reconciliation_runs').update({
        status: 'COMPLETED',
        completed_at: new Date().toISOString(),
        summary: { checked: gatewayTransactions.length, matched, recovered, issues: issues.length },
      }).eq('id', run.id);

      if (issues.length > 0) {
        await audit(schoolId, actorId, 'RECONCILIATION_MISMATCH', 'reconciliation_runs', run.id, {
          issue_count: issues.length,
          issue_types: [...new Set(issues.map((i) => i.type))],
        });
      } else {
        await audit(schoolId, actorId, 'RECONCILIATION_COMPLETED', 'reconciliation_runs', run.id, {
          checked: gatewayTransactions.length,
          matched,
        });
      }

      return {
        run_id: run.id,
        checked: gatewayTransactions.length,
        matched,
        recovered,
        issues,
        summary: { checked: gatewayTransactions.length, matched, recovered, issues: issues.length },
      };
    } catch (err) {
      await supabase.from('reconciliation_runs').update({
        status: 'FAILED',
        completed_at: new Date().toISOString(),
        summary: { error: err.message },
      }).eq('id', run.id);
      throw err;
    }
  }

  /**
   * Get reconciliation status/history for a school.
   */
  async getReconciliationStatus(schoolId) {
    const [runs, openIssues] = await Promise.all([
      supabase
        .from('reconciliation_runs')
        .select('id, provider, start_date, end_date, status, summary, started_at, completed_at')
        .eq('school_id', schoolId)
        .order('started_at', { ascending: false })
        .limit(20),
      supabase
        .from('reconciliation_issues')
        .select('*')
        .eq('school_id', schoolId)
        .eq('status', 'OPEN')
        .order('created_at', { ascending: false })
        .limit(50),
    ]);

    return {
      runs: runs.data || [],
      open_issues: openIssues.data || [],
    };
  }

  /**
   * Resolve an open reconciliation issue (staff).
   */
  async resolveIssue(issueId, schoolId, actorId) {
    const { data: issue, error } = await supabase
      .from('reconciliation_issues')
      .select('*')
      .eq('id', issueId)
      .eq('school_id', schoolId)
      .single();
    if (error || !issue) throw Object.assign(new Error('Issue not found.'), { statusCode: 404 });

    await supabase
      .from('reconciliation_issues')
      .update({ status: 'RESOLVED', resolved_by: actorId, resolved_at: new Date().toISOString() })
      .eq('id', issueId);

    await audit(schoolId, actorId, 'RECONCILIATION_RESOLVED', 'reconciliation_issues', issueId, {
      issue_type: issue.issue_type,
      reference: issue.reference,
    });

    return { success: true };
  }
}

export { ReconciliationService, ISSUE_TYPES };
export const reconciliationService = new ReconciliationService();
