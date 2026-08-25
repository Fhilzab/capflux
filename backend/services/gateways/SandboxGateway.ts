/**
 * SandboxGateway — deterministic CAPFLUX Demo Bank adapter for sandbox
 * deployments (CAPFLUX_MODE=sandbox / PAYMENTS_PROVIDER_MODE=sandbox with a
 * `sandbox` gateway assignment).
 *
 * Behaviour mirrors TestGateway (same in-memory determinism and guards) but
 * presents production-shaped demo identifiers: 10-digit CAPFLUX Demo Bank
 * account numbers, DEMO-prefixed references and realistic account naming.
 *
 * Safety:
 *  - construction AND every operation throw if NODE_ENV === 'production';
 *  - it is only reachable when explicitly assigned via gateway_assignments;
 *  - no network egress exists anywhere in this file.
 */
import { createHmac } from 'crypto';
import { TestGateway } from './TestGateway.js';
import type {
  GatewayConfig,
  StudentPaymentAccount,
} from '../../types/gateway.js';
import type { CanonicalTransactionStatus } from '../../types/gateway.js';
import type { CreateStudentAccountParams } from './PaymentGatewayInterface.js';

export class SandboxGateway extends TestGateway {
  private readonly _demoCounter = { value: 0 };

  constructor() {
    super();
    // Double guard: parent constructor already throws; keep an explicit
    // sandbox-specific barrier so the intent is auditable.
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SandboxGateway is not available in production.');
    }
    this.providerName = 'sandbox';
  }

  override getProviderName(): string {
    return this.providerName;
  }

  /** Deterministic demo DVA numbers: 1000000001, 1000000002, … */
  nextDemoAccountNumber(): string {
    this._guard();
    this._demoCounter.value += 1;
    return `100${String(this._demoCounter.value).padStart(7, '0')}`;
  }

  /**
   * Demo-branded DVA creation: CAPFLUX Demo Bank accounts in the dedicated
   * 100xxxxxxx range. These NEVER correspond to real bank accounts.
   */
  override async createStudentPaymentAccount({ student_id, student_name }: CreateStudentAccountParams): Promise<StudentPaymentAccount> {
    this._guard();
    const dvaNumber = this.nextDemoAccountNumber();
    const account: StudentPaymentAccount = {
      provider: this.providerName,
      provider_account_id: dvaNumber,
      provider_reference: `sandbox-ref-${student_id}`,
      virtual_account_number: dvaNumber,
      account_name: `${student_name} — CAPFLUX DEMO ACADEMY`,
      bank_name: 'CAPFLUX Demo Bank',
      account_status: 'ACTIVE',
    };
    return account;
  }

  /**
   * Deterministic reference for a simulated transaction.
   * Format: DEMO-PAY-<n> (the convention used across the sandbox demo).
   */
  buildDemoReference(sequence: number): string {
    this._guard();
    return `DEMO-PAY-${String(sequence).padStart(6, '0')}`;
  }

  /** Sandbox webhook signature — HMAC-SHA256 over the raw body. */
  signSandboxWebhook(rawPayload: string): string {
    this._guard();
    return createHmac('sha256', 'test-webhook-secret').update(rawPayload).digest('hex');
  }

  override async getAccessToken(_gatewayConfig?: GatewayConfig): Promise<string> {
    this._guard();
    return 'sandbox-access-token';
  }

  override normalizeTransactionStatus(providerStatus: unknown): CanonicalTransactionStatus {
    this._guard();
    const map: Record<string, CanonicalTransactionStatus> = { pending: 'PENDING', processing: 'PROCESSING', success: 'SUCCESS', failed: 'FAILED', reversed: 'REVERSED' };
    const normalized = map[String(providerStatus).toLowerCase()];
    return normalized ?? 'UNKNOWN';
  }
}

export function isSandboxGatewayAvailable(): boolean {
  return process.env.NODE_ENV !== 'production';
}
