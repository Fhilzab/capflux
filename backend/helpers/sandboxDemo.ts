/**
 * Sandbox demo helpers for financial routes.
 *
 * Demo users have no real database rows. Financial routes must never query
 * Supabase for demo sessions — they return hardcoded empty/zero data that
 * matches the expected API response shape.
 *
 * This follows the same pattern established in context.ts (lines 164-297).
 */
import type { Request } from 'express';

/** True when the request was authenticated via a sandbox demo session. */
export function isDemoRequest(req: Request): boolean {
  return (req as { isDemo?: boolean }).isDemo === true;
}

/** Empty payments list response for demo users. */
export function demoPaymentsList() {
  return { success: true, data: [] };
}

/** Empty payment summary for demo users. */
export function demoPaymentSummary() {
  return {
    success: true,
    data: {
      total_payments: 0,
      successful_payments: 0,
      pending_payments: 0,
      failed_payments: 0,
      reversed_payments: 0,
      today_collections_minor: 0,
      month_collections_minor: 0,
      total_collected_minor: 0,
    },
  };
}

/** Empty DVA/payment-accounts list for demo users. */
export function demoDvaList() {
  return { success: true, data: [] };
}

/** Empty settlements list for demo users. */
export function demoSettlementsList() {
  return { success: true, data: [] };
}

/** Empty settlement summary for demo users. */
export function demoSettlementSummary() {
  return {
    success: true,
    data: {
      total: 0,
      pending: 0,
      successful: 0,
      failed: 0,
      settled_minor: 0,
    },
  };
}

/** Empty reconciliation status for demo users. */
export function demoReconciliationStatus() {
  return {
    success: true,
    data: {
      runs: [],
      open_issues: [],
    },
  };
}
