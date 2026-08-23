/**
 * gateway — types shared by the payment provider contract and its adapters.
 *
 * Webhook payloads and provider transactions are EXTERNAL, untrusted data.
 * They are modeled as loose records; adapters read known fields defensively,
 * exactly as the original JavaScript did (truthy checks + optional chains).
 */

export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };
export type WebhookPayload = Record<string, unknown>;

/** Legacy per-school fallback config. Canonical path passes `{}` — credentials come from server env. */
export interface GatewayConfig {
  api_key?: string;
  secret_key?: string;
  submerchant_code?: string;
  [key: string]: unknown;
}

/** Result of provisioning a DVA / payment account (canonical adapter contract). */
export interface StudentPaymentAccount {
  provider: string;
  provider_account_id: string;
  provider_reference: string;
  virtual_account_number: string;
  account_name: string;
  bank_name: string;
  account_status: AccountStatusTag;
}

export type AccountStatusTag = 'ACTIVE' | 'INACTIVE';

export interface DeactivateAccountResult {
  provider: string;
  virtual_account_number: string;
  account_status: AccountStatusTag;
  deactivated: boolean;
}

export interface ReconcileParams {
  gateway_config?: GatewayConfig;
  start_date?: string;
  end_date?: string;
}

/** Loose view of a provider transaction (external, untrusted data). */
export type ProviderTransaction = Record<string, unknown>;

export type SettlementStatusResult = Record<string, unknown>;

/** Canonical transaction status after normalization. */
export type CanonicalTransactionStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'SUCCESS'
  | 'FAILED'
  | 'REVERSED'
  | 'UNKNOWN';

/** Canonical settlement status after normalization. */
export type CanonicalSettlementStatus =
  | 'PENDING'
  | 'SUCCESS'
  | 'FAILED'
  | 'UNKNOWN';

export interface SettlementSplitDetail {
  destination?: string;
  account_number?: string | null;
  bank_name?: string;
  amount?: number | null;
  category?: string;
  status?: string | null;
  [key: string]: unknown;
}

// ── Provider errors ──────────────────────────────────────────────────────

/** Canonical gateway adapter error codes (established runtime surface). */
export type GatewayErrorCode =
  | 'PROVIDER_NOT_CONFIGURED'
  | 'PROVIDER_ERROR'
  | 'SANDBOX_CAPABILITY_UNAVAILABLE';

export interface TypedGatewayError extends Error {
  readonly code: GatewayErrorCode;
}

/**
 * Build a gateway error with the exact runtime shape the adapters have always
 * thrown (an Error with an attached `code` property).
 */
export function gatewayError(code: GatewayErrorCode, message: string): TypedGatewayError {
  const err = new Error(message) as Error & { code?: GatewayErrorCode };
  err.code = code;
  return err as TypedGatewayError;
}
