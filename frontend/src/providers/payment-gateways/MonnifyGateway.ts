/**
 * Monnify Gateway Adapter
 *
 * Infrastructure layer — Capflux domain never knows Monnify exists.
 * Only this file calls Monnify's SDK or API.
 */

import { PaymentGatewayProvider } from '../../shared/payments/PaymentGatewayProvider';
import type { PaymentResult } from '../../shared/payments/types';

export class MonnifyGateway extends PaymentGatewayProvider {
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
    // TODO: Implement Monnify payment verification
    return {
      data: null,
      error: { code: 'PROVIDER_NOT_CONFIGURED', message: 'Monnify gateway not configured' },
    };
  }

  async generateVirtualAccount(data: {
    schoolId: string;
    studentId: string;
    studentName: string;
    email: string;
  }): Promise<PaymentResult<{
    accountNumber: string;
    accountName: string;
    bankName: string;
    providerCustomerId: string;
  }>> {
    // TODO: Implement DVA generation via Monnify
    return {
      data: null,
      error: { code: 'PROVIDER_NOT_CONFIGURED', message: 'Monnify gateway not configured' },
    };
  }

  async getVirtualAccount(studentId: string): Promise<PaymentResult<{
    accountNumber: string;
    accountName: string;
    bankName: string;
    providerCustomerId: string;
    status: string;
  } | null>> {
    return {
      data: null,
      error: { code: 'PROVIDER_NOT_CONFIGURED', message: 'Monnify gateway not configured' },
    };
  }

  async validateWebhook(payload: unknown): Promise<PaymentResult<{
    providerReference: string;
    event: string;
    status: string;
  }>> {
    // TODO: Implement Monnify webhook signature validation
    return {
      data: null,
      error: { code: 'PROVIDER_NOT_CONFIGURED', message: 'Monnify gateway not configured' },
    };
  }

  async suspendAccount(_studentId: string): Promise<PaymentResult<void>> {
    return { data: null, error: { code: 'UNKNOWN', message: 'Not implemented' } };
  }

  async reactivateAccount(_studentId: string): Promise<PaymentResult<void>> {
    return { data: null, error: { code: 'UNKNOWN', message: 'Not implemented' } };
  }

  async regenerateAccount(_studentId: string): Promise<PaymentResult<void>> {
    return { data: null, error: { code: 'UNKNOWN', message: 'Not implemented' } };
  }

  async syncAccountStatus(_studentId: string): Promise<PaymentResult<void>> {
    return { data: null, error: { code: 'UNKNOWN', message: 'Not implemented' } };
  }

  isConfigured(): boolean {
    return false;
  }
}