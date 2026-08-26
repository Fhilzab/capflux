/**
 * SandboxGateway — the deterministic payment provider for sandbox mode.
 *
 * Implements the SAME frontend PaymentGatewayProvider contract as live
 * gateways would, backed entirely by the in-browser API simulator. It can
 * never reach a real PSP:
 *  - construction outside sandbox mode throws (fail closed);
 *  - it refuses to bind to live provider names;
 *  - every operation resolves against `capflux_sandbox_db` / SandboxApiServer.
 *
 * References follow the DEMO-PAY-NNNNNN convention required by the demo
 * scripts; virtual accounts are CAPFLUX Demo Bank accounts in the 100xxxxxxx
 * range — never real bank identifiers.
 */

import { runtimeEnvironment } from '../../shared/environment/runtimeEnvironment';
import {
  PaymentGatewayProvider,
} from '../../shared/payments/PaymentGatewayProvider';
import type { PaymentResult } from '../../shared/payments/types';
import { assertNotLiveProviderName, assertSandboxMode } from '../runtime/sandboxGuard';
import { sandboxRuntime } from '../runtime/sandboxRuntime';

export type SimulatedOutcome = 'SUCCESS' | 'FAILED' | 'PENDING' | 'REVERSED';

export interface SimulatePaymentInput {
  studentId: string;
  amountMinor: number;
  outcome: SimulatedOutcome;
  /** Reverse an existing SUCCESS payment by reference (outcome=REVERSED). */
  targetReference?: string;
  reason?: string;
}

interface SimulationResponse {
  data?: {
    outcome: SimulatedOutcome;
    reference: string;
    ledger_posted: boolean;
    transaction: Record<string, unknown>;
  };
  error?: string;
  success?: boolean;
}

/** Direct API-simulator call shared by control panel and gateway. */
export async function simulatePaymentViaApi(input: SimulatePaymentInput): Promise<SimulationResponse['data']> {
  const { apiClient } = await import('../../shared/services/api/client');
  const response = await apiClient.http.post<SimulationResponse>('/sandbox/gateway/simulate-payment', input);
  return response.data.data;
}

export class SandboxGateway extends PaymentGatewayProvider {
  private readonly assignedProvider: string;

  constructor(assignedProvider = 'sandbox') {
    super();
    assertSandboxMode(runtimeEnvironment.isSandbox, 'SandboxGateway');
    assertNotLiveProviderName(assignedProvider);
    this.assignedProvider = assignedProvider;
  }

  getProviderName(): string {
    return this.assignedProvider;
  }

  async verifyPayment(providerReference: string): Promise<PaymentResult<{
    verified: boolean;
    amount: number;
    currency: string;
    gatewayReference: string;
    payerName?: string;
    payerBank?: string;
    paymentDate: string;
    metadata?: Record<string, unknown>;
  }>> {
    const { getSandboxDb } = await import('../sandboxDb');
    const db = getSandboxDb();
    const txn = await db.payment_transactions.where('reference').equals(providerReference).first() as Record<string, unknown> | undefined;
    if (!txn) {
      return { data: null, error: { code: 'UNKNOWN', message: `Unknown reference ${providerReference}` } };
    }
    if (txn.status !== 'SUCCESS') {
      return {
        data: null,
        error: { code: 'VERIFICATION_FAILED', message: `Transaction is ${String(txn.status)}` },
      };
    }
    return {
      data: {
        verified: true,
        amount: Number(txn.amount_minor ?? 0),
        currency: String(txn.currency ?? 'NGN'),
        gatewayReference: String(txn.gateway_txn_ref ?? ''),
        payerName: 'Demo Parent',
        payerBank: 'CAPFLUX Demo Bank',
        paymentDate: String(txn.paid_at ?? txn.created_at ?? ''),
        metadata: { sandbox: true },
      },
      error: null,
    };
  }

  async generateVirtualAccount(data: {
    schoolId: string;
    studentId: string;
    studentName: string;
    email: string;
  }): Promise<PaymentResult<{ accountNumber: string; accountName: string; bankName: string; providerCustomerId: string }>> {
    void data;
    // DVAs are provisioned through POST /dva/provision so the same masking +
    // idempotency + audit rules apply; direct generation is not exposed.
    return {
      data: null,
      error: { code: 'PROVIDER_NOT_CONFIGURED', message: 'Provision DVAs through POST /dva/provision' },
    };
  }

  async getVirtualAccount(studentId: string): Promise<PaymentResult<{
    accountNumber: string;
    accountName: string;
    bankName: string;
    providerCustomerId: string;
    status: string;
  } | null>> {
    const { getSandboxDb } = await import('../sandboxDb');
    const db = getSandboxDb();
    const row = await db.payment_accounts.where('student_id').equals(studentId).first() as Record<string, unknown> | undefined;
    if (!row) return { data: null, error: null };
    const full = String(row.virtual_account_number ?? '');
    return {
      data: {
        accountNumber: `******${full.slice(-4)}`,
        accountName: String(row.account_name ?? ''),
        bankName: String(row.bank_name ?? 'CAPFLUX Demo Bank'),
        providerCustomerId: String(row.provider_account_id ?? ''),
        status: String(row.account_status ?? 'ACTIVE'),
      },
      error: null,
    };
  }

  async validateWebhook(payload: unknown): Promise<PaymentResult<{ providerReference: string; event: string; status: string }>> {
    const body = payload as { reference?: string; event?: string; status?: string };
    if (!body?.reference) {
      return { data: null, error: { code: 'VALIDATION_ERROR', message: 'Missing reference in simulated webhook' } };
    }
    return ok({ providerReference: body.reference, event: body.event ?? 'charge.success', status: body.status ?? 'SUCCESS' });
  }

  isConfigured(): boolean {
    return true;
  }

  /**
   * High-level demo helpers used by the control panel. Scenario switches
   * (PAYMENT_FAILED / PAYMENT_PENDING) influence server-side outcomes.
   */
  async simulateSuccessfulPayment(input: Omit<SimulatePaymentInput, 'outcome'>): Promise<SimulationResponse['data']> {
    if (!sandboxRuntime.isOnline()) {
      throw new Error('Sandbox is offline — reconnect to simulate payments.');
    }
    return simulatePaymentViaApi({ ...input, outcome: 'SUCCESS' });
  }

  simulateFailedPayment(input: Omit<SimulatePaymentInput, 'outcome'>): Promise<SimulationResponse['data']> {
    return simulatePaymentViaApi({ ...input, outcome: 'FAILED' });
  }

  simulatePendingPayment(input: Omit<SimulatePaymentInput, 'outcome'>): Promise<SimulationResponse['data']> {
    return simulatePaymentViaApi({ ...input, outcome: 'PENDING' });
  }

  async simulateReversedPayment(input: Omit<SimulatePaymentInput, 'outcome'> & { targetReference: string }): Promise<SimulationResponse['data']> {
    return simulatePaymentViaApi({ ...input, outcome: 'REVERSED' });
  }
}

function ok<T>(data: T): { data: T; error: null } {
  return { data, error: null };
}

let instance: SandboxGateway | null = null;

export function getSandboxGateway(): SandboxGateway {
  assertSandboxMode(runtimeEnvironment.isSandbox, 'SandboxGateway');
  if (!instance) instance = new SandboxGateway();
  return instance;
}
