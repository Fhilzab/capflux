/**
 * TestGateway — deterministic test adapter for automated testing.
 *
 * NEVER available in production. Guards enforced at construction and
 * on every operation. Supports DVA creation, payment verification,
 * settlement, webhook signature validation, and error simulation.
 *
 * All data is in-memory (session-lifetime only). Thread-safe for test use.
 */
import { createHmac } from 'crypto';
import { PaymentGatewayInterface } from './PaymentGatewayInterface.js';
import type {
  DeactivateAccountResult,
  GatewayConfig,
  ProviderTransaction,
  ReconcileParams,
  SettlementSplitDetail,
  StudentPaymentAccount,
  WebhookPayload,
} from '../../types/gateway.js';
import type {
  CanonicalSettlementStatus,
  CanonicalTransactionStatus,
  SettlementStatusResult,
} from '../../types/gateway.js';
import type {
  CreateStudentAccountParams,
  DeactivateAccountParams,
  ProcessedWebhook,
} from './PaymentGatewayInterface.js';

/** Structural view of test transactions (dates are ISO strings). */
interface TestTransaction extends ProviderTransaction {
  paidOn?: string;
  createdAt?: string;
  status?: unknown;
  settlementStatus?: unknown;
  amount?: unknown;
}

export class TestGateway extends PaymentGatewayInterface {
  private readonly _dvas = new Map<string, Record<string, unknown>>();
  private readonly _transactions = new Map<string, ProviderTransaction>();
  private readonly _settlements = new Map<string, Record<string, unknown>>();
  private _counter = 0;
  private readonly _webhookSecret = 'test-webhook-secret';

  constructor() {
    super();
    if (process.env.NODE_ENV === 'production') {
      throw new Error('TestGateway is not available in production.');
    }
    this.providerName = 'test';
  }

  override getProviderName(): string {
    return this.providerName;
  }

  // ── Guard ──

  _guard(): void {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('TestGateway is not available in production.');
    }
  }

  // ── AccessToken ──
  override async getAccessToken(_gatewayConfig?: GatewayConfig): Promise<string> {
    this._guard();
    return 'test-access-token';
  }

  // ── DVA ──
  override async createStudentPaymentAccount({ student_id, student_name }: CreateStudentAccountParams): Promise<StudentPaymentAccount> {
    this._guard();
    const dvaNumber = `2000${String(this._counter++).padStart(6, '0')}`;
    const account: StudentPaymentAccount = {
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

  override async deactivatePaymentAccount({ virtual_account_number }: DeactivateAccountParams): Promise<DeactivateAccountResult> {
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
  injectDVA(virtualAccountNumber: string, { schoolId, studentId, studentName }: { schoolId: string; studentId?: string | null; studentName?: string | null }): void {
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
  injectTxn(reference: string, txn: ProviderTransaction): void {
    this._transactions.set(reference, txn);
  }

  // ── Transaction Verification ──
  override async verifyPayment(reference: string, _gatewayConfig?: GatewayConfig): Promise<ProviderTransaction> {
    this._guard();
    return this.getTransaction(reference);
  }

  override async getTransaction(reference: string, _gatewayConfig?: GatewayConfig): Promise<ProviderTransaction> {
    this._guard();
    const txn = this._transactions.get(reference);
    if (!txn) throw new Error(`Transaction ${reference} not found`);
    return txn;
  }

  override async reconcilePayments({ start_date, end_date }: ReconcileParams): Promise<ProviderTransaction[]> {
    this._guard();
    return Array.from(this._transactions.values()).filter((txn) => {
      const t = txn as TestTransaction;
      const d = t.paidOn || t.createdAt || '';
      return (!start_date || d >= start_date) && (!end_date || d <= end_date);
    });
  }

  // ── Webhook ──
  override async verifyWebhookSignature(signature: string, rawPayload: string): Promise<boolean> {
    this._guard();
    // Deterministic test: sha256 HMAC.
    // Migration fix (approved): the original implementation referenced
    // CommonJS require() inside an ES module, which threw
    // "ReferenceError: require is not defined" whenever invoked. The intent
    // (HMAC-SHA256 over the raw payload with the test secret) is preserved
    // here using a proper ESM import.
    const expected = createHmac('sha256', this._webhookSecret).update(rawPayload).digest('hex');
    return signature === expected;
  }

  override async processWebhook(payload: WebhookPayload, _gatewayConfig?: GatewayConfig): Promise<ProcessedWebhook> {
    this._guard();
    const reference = this.parseWebhookReference(payload);
    const txn = this._transactions.get(reference as string);
    return {
      reference: reference as string,
      amount: this.parseWebhookAmount(payload),
      transaction: txn || payload,
      success: !!txn || false,
    };
  }

  override parseWebhookReference(payload: WebhookPayload): string | null {
    return ((payload?.reference || payload?.transactionReference || null)) as string | null;
  }

  override parseWebhookEventId(payload: WebhookPayload): string | null {
    return ((payload?.eventId || payload?.reference || null)) as string | null;
  }

  override parseWebhookAmount(payload: WebhookPayload): number | null {
    return ((payload?.amount || payload?.amountPaid || null)) as number | null;
  }

  override parseWebhookDVA(payload: WebhookPayload): string | null {
    return ((payload?.accountNumber || payload?.virtualAccountNumber || null)) as string | null;
  }

  override parseSettlementDetails(payload: WebhookPayload): SettlementSplitDetail[] {
    return (payload?.settlementDetails || []) as SettlementSplitDetail[];
  }

  // ── Status normalization ──
  override normalizeTransactionStatus(status: unknown): CanonicalTransactionStatus {
    const map: Record<string, CanonicalTransactionStatus> = { pending: 'PENDING', processing: 'PROCESSING', success: 'SUCCESS', failed: 'FAILED', reversed: 'REVERSED' };
    return map[String(status ?? '').toLowerCase()] || 'UNKNOWN';
  }

  override normalizeSettlementStatus(status: unknown): CanonicalSettlementStatus {
    const map: Record<string, CanonicalSettlementStatus> = { pending: 'PENDING', success: 'SUCCESS', failed: 'FAILED' };
    return map[String(status ?? '').toLowerCase()] || 'UNKNOWN';
  }

  // ── Settlement ──
  override async getSettlementStatus(reference: string, _gatewayConfig?: GatewayConfig): Promise<SettlementStatusResult> {
    this._guard();
    const txn = this._transactions.get(reference) as TestTransaction | undefined;
    return {
      status: txn?.status || 'PENDING',
      settlement_status: txn?.settlementStatus || 'PENDING',
      paid_amount: txn?.amount || 0,
    };
  }

  override async listSettlements({ start_date, end_date }: ReconcileParams): Promise<Record<string, unknown>[]> {
    this._guard();
    return Array.from(this._settlements.values()).filter((s) => {
      const date = (s['date'] as string | undefined) ?? '';
      return (!start_date || date >= start_date) && (!end_date || date <= end_date);
    });
  }
}
