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

const PAYSTACK_ENV = (process.env.PAYSTACK_ENV || 'sandbox').toLowerCase();
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || null;
const PAYSTACK_WEBHOOK_SECRET = process.env.PAYSTACK_WEBHOOK_SECRET || null;

const BASE_URL = PAYSTACK_ENV === 'production'
  ? 'https://api.paystack.co'
  : 'https://api.paystack.co'; // Paystack uses same base, different credentials

const NOT_CONFIGURED = 'Paystack is not configured. Set PAYSTACK_SECRET_KEY.';
const BLOCKED = 'Paystack production activation is BLOCKED_PENDING_PROVIDER_ACCESS.';

export class PaystackGateway extends PaymentGatewayInterface {
  constructor() {
    super();
    this.providerName = 'paystack';
  }

  getProviderName() {
    return this.providerName;
  }

  /**
   * Whether credentials are available.
   */
  _isConfigured() {
    return !!PAYSTACK_SECRET_KEY;
  }

  /**
   * Prepare auth headers. Credentials from env only.
   */
  _authHeaders() {
    if (!this._isConfigured()) {
      throw new Error(NOT_CONFIGURED);
    }
    return {
      Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    };
  }

  // ── AccessToken (Paystack uses Bearer secret key directly) ──
  async getAccessToken() {
    if (!this._isConfigured()) throw new Error(NOT_CONFIGURED);
    // Paystack uses the secret key directly; no token exchange.
    return PAYSTACK_SECRET_KEY;
  }

  // ── DVA ──
  async createStudentPaymentAccount({ student_id, student_name, gateway_config }) {
    if (!this._isConfigured()) {
      const err = new Error(NOT_CONFIGURED);
      err.code = 'PROVIDER_NOT_CONFIGURED';
      throw err;
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

      const err = new Error('Paystack DVA creation did not return a valid account.');
      err.code = 'PROVIDER_ERROR';
      throw err;
    } catch (error) {
      // Network or sandbox API unavailable.
      if (error.code === 'PROVIDER_NOT_CONFIGURED') throw error;
      const err = new Error(`Paystack DVA creation unavailable: ${error.message}`);
      err.code = 'SANDBOX_CAPABILITY_UNAVAILABLE';
      throw err;
    }
  }

  async deactivatePaymentAccount({ virtual_account_number }) {
    if (!this._isConfigured()) {
      const err = new Error(NOT_CONFIGURED);
      err.code = 'PROVIDER_NOT_CONFIGURED';
      throw err;
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
      const err = new Error(`Paystack DVA deactivation unavailable: ${error.message}`);
      err.code = 'SANDBOX_CAPABILITY_UNAVAILABLE';
      throw err;
    }
  }

  // ── Transaction Verification ──
  async verifyPayment(reference) {
    return this.getTransaction(reference);
  }

  async getTransaction(reference) {
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
      const err = new Error(`Paystack transaction verification unavailable: ${error.message}`);
      err.code = 'SANDBOX_CAPABILITY_UNAVAILABLE';
      throw err;
    }
  }

  async reconcilePayments({ start_date, end_date }) {
    if (!this._isConfigured()) throw new Error(NOT_CONFIGURED);

    try {
      const response = await axios.get(`${BASE_URL}/transaction`, {
        headers: this._authHeaders(),
        params: { from: start_date, to: end_date, perPage: 100 },
      });

      if (response.data?.status) {
        return (response.data.data || []).filter((t) => t.status === 'success');
      }
      return [];
    } catch (error) {
      const err = new Error(`Paystack transaction listing unavailable: ${error.message}`);
      err.code = 'SANDBOX_CAPABILITY_UNAVAILABLE';
      throw err;
    }
  }

  // ── Webhook ──
  async verifyWebhookSignature(signature, rawPayload) {
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

  async processWebhook(payload) {
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

  parseWebhookReference(payload) {
    return payload?.data?.reference || payload?.reference || null;
  }

  parseWebhookEventId(payload) {
    return payload?.data?.id?.toString() || payload?.event?.toString() || null;
  }

  parseWebhookAmount(payload) {
    const raw = payload?.data?.amount || payload?.amount;
    // Paystack amounts are in kobo (minor units).
    return raw ? Number(raw) / 100 : null;
  }

  parseWebhookDVA(payload) {
    return payload?.data?.authorization?.account_number
      || payload?.account_number
      || null;
  }

  parseSettlementDetails(payload) {
    const data = payload?.data || payload;
    return [{
      destination: 'school',
      account_number: data?.authorization?.account_number || null,
      amount: data?.amount ? Number(data.amount) / 100 : null,
      status: data?.settlement_status || 'PENDING',
    }];
  }

  // ── Status normalization ──
  normalizeTransactionStatus(status) {
    const map = {
      success: 'SUCCESS', failed: 'FAILED', abandoned: 'FAILED',
      pending: 'PENDING', reversed: 'REVERSED',
    };
    return map[(status || '').toLowerCase()] || 'UNKNOWN';
  }

  normalizeSettlementStatus(status) {
    const map = { pending: 'PENDING', success: 'SUCCESS', failed: 'FAILED' };
    return map[(status || '').toLowerCase()] || 'UNKNOWN';
  }

  // ── Settlement ──
  async getSettlementStatus(reference) {
    const transaction = await this.getTransaction(reference);
    return {
      status: transaction?.status || 'PENDING',
      settlement_status: transaction?.settlement_status || 'PENDING',
      paid_amount: transaction?.amount ? Number(transaction.amount) / 100 : 0,
    };
  }

  async listSettlements({ start_date, end_date }) {
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
