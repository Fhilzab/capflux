/**
 * PaystackGateway — Paystack payment provider adapter.
 *
 * Production activation: BLOCKED_PENDING_PROVIDER_ACCESS.
 * Sandbox capability: verifies sandbox credentials against real API
 * when available; returns SANDBOX_CAPABILITY_UNAVAILABLE otherwise.
 *
 * All credentials come from server environment (PAYSTACK_SECRET_KEY,
 * PAYSTACK_ENV), never from the database.
 */
import axios from 'axios';
import crypto from 'crypto';
import { PaymentGatewayInterface } from './PaymentGatewayInterface.js';
import type {
  CanonicalSettlementStatus,
  CanonicalTransactionStatus,
  DeactivateAccountResult,
  GatewayConfig,
  ProviderTransaction,
  ReconcileParams,
  SettlementSplitDetail,
  SettlementStatusResult,
  StudentPaymentAccount,
  WebhookPayload,
} from '../../types/gateway.js';
import type {
  CreateStudentAccountParams,
  DeactivateAccountParams,
  ProcessedWebhook,
} from './PaymentGatewayInterface.js';
import { gatewayError, type TypedGatewayError } from '../../types/gateway.js';

const PAYSTACK_ENV = (process.env.PAYSTACK_ENV || 'sandbox').toLowerCase();
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || null;
const PAYSTACK_WEBHOOK_SECRET = process.env.PAYSTACK_WEBHOOK_SECRET || null;

const BASE_URL = 'https://api.paystack.co'; // Paystack uses same base, different credentials

const NOT_CONFIGURED = 'Paystack is not configured. Set PAYSTACK_SECRET_KEY.';

/** Structural view of the Paystack webhook fields this adapter reads. */
interface PaystackWebhookPayload {
  data?: {
    reference?: unknown;
    id?: unknown;
    amount?: unknown;
    authorization?: { account_number?: unknown } | null;
    settlement_status?: unknown;
  } | null;
  reference?: unknown;
  amount?: unknown;
  account_number?: unknown;
  event?: unknown;
}

export class PaystackGateway extends PaymentGatewayInterface {
  constructor() {
    super();
    this.providerName = 'paystack';
  }

  override getProviderName(): string {
    return this.providerName;
  }

  /**
   * Whether credentials are available.
   */
  _isConfigured(): boolean {
    return !!PAYSTACK_SECRET_KEY;
  }

  /**
   * Prepare auth headers. Credentials from env only.
   */
  _authHeaders(): Record<string, string> {
    if (!this._isConfigured()) {
      throw new Error(NOT_CONFIGURED);
    }
    return {
      Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    };
  }

  // ── AccessToken (Paystack uses Bearer secret key directly) ──
  override async getAccessToken(_gatewayConfig?: GatewayConfig): Promise<string> {
    if (!this._isConfigured()) throw new Error(NOT_CONFIGURED);
    // Paystack uses the secret key directly; no token exchange.
    return PAYSTACK_SECRET_KEY as string;
  }

  // ── DVA ──
  override async createStudentPaymentAccount({ student_id, student_name }: CreateStudentAccountParams): Promise<StudentPaymentAccount> {
    if (!this._isConfigured()) {
      throw gatewayError('PROVIDER_NOT_CONFIGURED', NOT_CONFIGURED);
    }

    try {
      const response = await axios.post(
        `${BASE_URL}/dedicated_account`,
        {
          customer: student_id.substring(0, 30),
          preferred_bank: 'test-bank',
        },
        { headers: this._authHeaders() }
      );

      if (response.data?.status) {
        const data = response.data.data;
        return {
          provider: this.providerName,
          provider_account_id: data.account_number || data.id,
          provider_reference: data.reference || data.id,
          virtual_account_number: data.account_number,
          account_name: `${student_name || 'Student'} - CAPFLUX`,
          bank_name: data.bank?.name || 'Provider Bank',
          account_status: 'ACTIVE',
        };
      }

      throw gatewayError('PROVIDER_ERROR', 'Paystack DVA creation did not return a valid account.');
    } catch (error) {
      // Network or sandbox API unavailable.
      if ((error as TypedGatewayError).code === 'PROVIDER_NOT_CONFIGURED') throw error;
      throw gatewayError(
        'SANDBOX_CAPABILITY_UNAVAILABLE',
        `Paystack DVA creation unavailable: ${(error as Error).message}`
      );
    }
  }

  override async deactivatePaymentAccount({ virtual_account_number }: DeactivateAccountParams): Promise<DeactivateAccountResult> {
    if (!this._isConfigured()) {
      throw gatewayError('PROVIDER_NOT_CONFIGURED', NOT_CONFIGURED);
    }

    try {
      await axios.post(
        `${BASE_URL}/dedicated_account/${virtual_account_number}/deactivate`,
        {},
        { headers: this._authHeaders() }
      );
      return {
        provider: this.providerName,
        virtual_account_number,
        account_status: 'INACTIVE',
        deactivated: true,
      };
    } catch (error) {
      throw gatewayError(
        'SANDBOX_CAPABILITY_UNAVAILABLE',
        `Paystack DVA deactivation unavailable: ${(error as Error).message}`
      );
    }
  }

  // ── Transaction Verification ──
  override async verifyPayment(reference: string, _gatewayConfig?: GatewayConfig): Promise<ProviderTransaction> {
    return this.getTransaction(reference);
  }

  override async getTransaction(reference: string, _gatewayConfig?: GatewayConfig): Promise<ProviderTransaction> {
    if (!this._isConfigured()) throw new Error(NOT_CONFIGURED);

    try {
      const response = await axios.get(
        `${BASE_URL}/transaction/verify/${reference}`,
        { headers: this._authHeaders() }
      );

      if (response.data?.status) {
        return response.data.data;
      }
      throw new Error(`Paystack transaction ${reference} not found`);
    } catch (error) {
      throw gatewayError(
        'SANDBOX_CAPABILITY_UNAVAILABLE',
        `Paystack transaction verification unavailable: ${(error as Error).message}`
      );
    }
  }

  override async reconcilePayments({ start_date, end_date }: ReconcileParams): Promise<ProviderTransaction[]> {
    if (!this._isConfigured()) throw new Error(NOT_CONFIGURED);

    try {
      const response = await axios.get(`${BASE_URL}/transaction`, {
        headers: this._authHeaders(),
        params: { from: start_date, to: end_date, perPage: 100 },
      });

      if (response.data?.status) {
        return (response.data.data || []).filter((t: ProviderTransaction) => t.status === 'success');
      }
      return [];
    } catch (error) {
      throw gatewayError(
        'SANDBOX_CAPABILITY_UNAVAILABLE',
        `Paystack transaction listing unavailable: ${(error as Error).message}`
      );
    }
  }

  // ── Webhook ──
  override async verifyWebhookSignature(signature: string, rawPayload: string): Promise<boolean> {
    if (!PAYSTACK_WEBHOOK_SECRET) {
      if (process.env.NODE_ENV === 'production') return false;
      console.warn('[paystack] No webhook secret configured — signature verification disabled in dev');
      return process.env.NODE_ENV !== 'production';
    }

    try {
      const expected = crypto
        .createHmac('sha512', PAYSTACK_WEBHOOK_SECRET)
        .update(rawPayload)
        .digest('hex');
      return signature === expected;
    } catch {
      return false;
    }
  }

  override async processWebhook(payload: WebhookPayload, _gatewayConfig?: GatewayConfig): Promise<ProcessedWebhook> {
    const reference = this.parseWebhookReference(payload);
    if (!reference) throw new Error('No reference in webhook payload');

    const transaction = await this.getTransaction(reference);
    return {
      reference,
      amount: this.parseWebhookAmount(payload),
      transaction,
      success: true,
    };
  }

  override parseWebhookReference(payload: WebhookPayload): string | null {
    const p = payload as PaystackWebhookPayload;
    return (p?.data?.reference || p?.reference || null) as string | null;
  }

  override parseWebhookEventId(payload: WebhookPayload): string | null {
    const p = payload as PaystackWebhookPayload;
    const id = p?.data?.id;
    const evt = p?.event;
    return ((id != null ? String(id) : undefined) || (evt != null ? String(evt) : undefined) || null) as string | null;
  }

  override parseWebhookAmount(payload: WebhookPayload): number | null {
    const p = payload as PaystackWebhookPayload;
    const raw = p?.data?.amount || p?.amount;
    // Paystack amounts are in kobo (minor units).
    return raw ? Number(raw) / 100 : null;
  }

  override parseWebhookDVA(payload: WebhookPayload): string | null {
    const p = payload as PaystackWebhookPayload;
    return (p?.data?.authorization?.account_number
      || p?.account_number
      || null) as string | null;
  }

  override parseSettlementDetails(payload: WebhookPayload): SettlementSplitDetail[] {
    const p = payload as PaystackWebhookPayload;
    // Original: payload?.data || payload — fall back to the outer payload.
    const data = (p?.data || p) as NonNullable<PaystackWebhookPayload['data']>;
    return [{
      destination: 'school',
      account_number: (data?.authorization?.account_number ?? null) as string | null,
      amount: data?.amount ? Number(data.amount) / 100 : null,
      status: (data?.settlement_status ?? 'PENDING') as string,
    }];
  }

  // ── Status normalization ──
  override normalizeTransactionStatus(status: unknown): CanonicalTransactionStatus {
    const map: Record<string, CanonicalTransactionStatus> = {
      success: 'SUCCESS', failed: 'FAILED', abandoned: 'FAILED',
      pending: 'PENDING', reversed: 'REVERSED',
    };
    return map[String(status ?? '').toLowerCase()] || 'UNKNOWN';
  }

  override normalizeSettlementStatus(status: unknown): CanonicalSettlementStatus {
    const map: Record<string, CanonicalSettlementStatus> = { pending: 'PENDING', success: 'SUCCESS', failed: 'FAILED' };
    return map[String(status ?? '').toLowerCase()] || 'UNKNOWN';
  }

  // ── Settlement ──
  override async getSettlementStatus(reference: string, _gatewayConfig?: GatewayConfig): Promise<SettlementStatusResult> {
    const transaction = await this.getTransaction(reference);
    return {
      status: transaction?.status || 'PENDING',
      settlement_status: transaction?.settlement_status || 'PENDING',
      paid_amount: transaction?.amount ? Number(transaction.amount) / 100 : 0,
    };
  }

  override async listSettlements({ start_date, end_date }: ReconcileParams): Promise<Record<string, unknown>[]> {
    if (!this._isConfigured()) throw new Error(NOT_CONFIGURED);
    const txns = await this.reconcilePayments({ start_date, end_date });
    return txns.map((t) => ({
      reference: t.reference,
      amount: t.amount ? Number(t.amount) / 100 : 0,
      status: t.settlement_status || t.status,
      date: t.paid_at || t.createdAt || null,
    }));
  }
}
