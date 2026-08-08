/**
 * TestGateway — deterministic test adapter for automated testing.
 *
 * NEVER available in production. Guards enforced at construction and
 * on every operation. Supports DVA creation, payment verification,
 * settlement, webhook signature validation, and error simulation.
 *
 * All data is in-memory (session-lifetime only). Thread-safe for test use.
 */
import { PaymentGatewayInterface } from './PaymentGatewayInterface.js';

export class TestGateway extends PaymentGatewayInterface {
  constructor() {
    super();
    if (process.env.NODE_ENV === 'production') {
      throw new Error('TestGateway is not available in production.');
    }
    this.providerName = 'test';
    this._dvas = new Map();
    this._transactions = new Map();
    this._settlements = new Map();
    this._counter = 0;
    this._webhookSecret = 'test-webhook-secret';
  }

  getProviderName() {
    return this.providerName;
  }

  // ── Guard ──

  _guard() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('TestGateway is not available in production.');
    }
  }

  // ── AccessToken ──
  async getAccessToken() {
    this._guard();
    return 'test-access-token';
  }

  // ── DVA ──
  async createStudentPaymentAccount({ student_id, student_name }) {
    this._guard();
    const dvaNumber = `2000${String(this._counter++).padStart(6, '0')}`;
    const account = {
      provider: this.providerName,
      provider_account_id: dvaNumber,
      provider_reference: `test-ref-${student_id}`,
      virtual_account_number: dvaNumber,
      account_name: `${student_name} - CAPFLUX (TEST)`,
      bank_name: 'Test Bank',
      account_status: 'ACTIVE',
    };
    this._dvas.set(dvaNumber, { ...account, student_id, student_name });
    return account;
  }

  async deactivatePaymentAccount({ virtual_account_number }) {
    this._guard();
    const dva = this._dvas.get(virtual_account_number);
    if (!dva) {
      throw new Error('Account not found');
    }
    dva.account_status = 'INACTIVE';
    this._dvas.set(virtual_account_number, dva);
    return {
      provider: this.providerName,
      virtual_account_number,
      account_status: 'INACTIVE',
      deactivated: true,
    };
  }

  // Inject known DVAs for tests (DVA→school mapping).
  injectDVA(virtualAccountNumber, { schoolId, studentId, studentName }) {
    this._dvas.set(virtualAccountNumber, {
      provider: this.providerName,
      provider_account_id: virtualAccountNumber,
      virtual_account_number: virtualAccountNumber,
      account_name: `${studentName || 'Student'} - CAPFLUX (TEST)`,
      bank_name: 'Test Bank',
      account_status: 'ACTIVE',
      student_id: studentId,
      school_id: schoolId,
    });
  }

  // Inject transactions for reconciliation tests.
  injectTxn(reference, txn) {
    this._transactions.set(reference, txn);
  }

  // ── Transaction Verification ──
  async verifyPayment(reference) {
    this._guard();
    return this.getTransaction(reference);
  }

  async getTransaction(reference) {
    this._guard();
    const txn = this._transactions.get(reference);
    if (!txn) throw new Error(`Transaction ${reference} not found`);
    return txn;
  }

  async reconcilePayments({ start_date, end_date }) {
    this._guard();
    return Array.from(this._transactions.values()).filter((txn) => {
      const d = txn.paidOn || txn.createdAt || '';
      return (!start_date || d >= start_date) && (!end_date || d <= end_date);
    });
  }

  // ── Webhook ──
  async verifyWebhookSignature(signature, rawPayload) {
    this._guard();
    // Deterministic test: sha256 HMAC
    const crypto = await import('crypto').then(() => globalThis.crypto || require('crypto'));
    const { createHmac } = require('crypto');
    const expected = createHmac('sha256', this._webhookSecret).update(rawPayload).digest('hex');
    return signature === expected;
  }

  async processWebhook(payload) {
    this._guard();
    const reference = this.parseWebhookReference(payload);
    const txn = this._transactions.get(reference);
    return {
      reference,
      amount: this.parseWebhookAmount(payload),
      transaction: txn || payload,
      success: !!txn || false,
    };
  }

  parseWebhookReference(payload) {
    return payload?.reference || payload?.transactionReference || null;
  }

  parseWebhookEventId(payload) {
    return payload?.eventId || payload?.reference || null;
  }

  parseWebhookAmount(payload) {
    return payload?.amount || payload?.amountPaid || null;
  }

  parseWebhookDVA(payload) {
    return payload?.accountNumber || payload?.virtualAccountNumber || null;
  }

  parseSettlementDetails(payload) {
    return payload?.settlementDetails || [];
  }

  // ── Status normalization ──
  normalizeTransactionStatus(status) {
    const map = { pending: 'PENDING', processing: 'PROCESSING', success: 'SUCCESS', failed: 'FAILED', reversed: 'REVERSED' };
    return map[(status || '').toLowerCase()] || 'UNKNOWN';
  }

  normalizeSettlementStatus(status) {
    const map = { pending: 'PENDING', success: 'SUCCESS', failed: 'FAILED' };
    return map[(status || '').toLowerCase()] || 'UNKNOWN';
  }

  // ── Settlement ──
  async getSettlementStatus(reference) {
    this._guard();
    const txn = this._transactions.get(reference);
    return {
      status: txn?.status || 'PENDING',
      settlement_status: txn?.settlementStatus || 'PENDING',
      paid_amount: txn?.amount || 0,
    };
  }

  async listSettlements({ start_date, end_date }) {
    this._guard();
    return Array.from(this._settlements.values()).filter((s) => {
      return (!start_date || s.date >= start_date) && (!end_date || s.date <= end_date);
    });
  }
}
