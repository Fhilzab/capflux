import { defineStore } from 'pinia';
import { paymentService } from '../shared/payments/PaymentService';
import type { Payment, Receipt, PaymentAllocation } from '../shared/payments/types';
import type { ChargeWithAmount } from '../shared/payments/PaymentEngine';

export const usePaymentStore = defineStore('payment', {
  state: () => ({
    payments: [] as Payment[],
    receipts: [] as Receipt[],
    allocations: [] as PaymentAllocation[],
    loading: false as boolean,
    initialized: false as boolean,
    error: null as string | null,
  }),
  getters: {
    paymentsByStudent: (state): Record<string, Payment[]> => {
      const map: Record<string, Payment[]> = {};
      for (const payment of state.payments) {
        if (!map[payment.studentId]) map[payment.studentId] = [];
        map[payment.studentId].push(payment);
      }
      return map;
    },
    confirmedPayments: (state): Payment[] => state.payments.filter(p => p.status === 'CONFIRMED'),
    allocatedPayments: (state): Payment[] => state.payments.filter(p => p.status === 'ALLOCATED'),
    failedPayments: (state): Payment[] => state.payments.filter(p => p.status === 'FAILED'),
    receiptsByStudent: (state): Record<string, Receipt[]> => {
      const map: Record<string, Receipt[]> = {};
      for (const receipt of state.receipts) {
        if (!map[receipt.studentId]) map[receipt.studentId] = [];
        map[receipt.studentId].push(receipt);
      }
      return map;
    },
    allocationsByPayment: (state): Record<string, PaymentAllocation[]> => {
      const map: Record<string, PaymentAllocation[]> = {};
      for (const allocation of state.allocations) {
        if (!map[allocation.paymentId]) map[allocation.paymentId] = [];
        map[allocation.paymentId].push(allocation);
      }
      return map;
    },
  },
  actions: {
    async processPayment(
      confirmInput: {
        studentId: string;
        billingProfileId: string;
        amount: number;
        currency: string;
        method: 'BANK_TRANSFER' | 'CASH' | 'POS' | 'ONLINE';
        gatewayProvider: 'PAYSTACK' | 'MONNIFY';
        providerReference: string;
        gatewayReference: string;
        gatewayMetadata?: Record<string, unknown>;
        paymentDate: string;
      },
      charges: ChargeWithAmount[],
      academicSessionId: string,
      academicTermId: string,
      termNumber: number,
    ) {
      this.loading = true;
      this.error = null;

      try {
        const result = await paymentService.processPayment(
          confirmInput,
          charges,
          academicSessionId,
          academicTermId,
          termNumber,
        );

        if (result.error) {
          this.error = result.error.message;
          return false;
        }

        if (result.data) {
          this.payments.push(result.data.payment);
          this.allocations.push(...result.data.allocations);
          this.receipts.push(result.data.receipt);
        }

        return true;
      } catch (e: any) {
        this.error = e?.message || 'Failed to process payment';
        return false;
      } finally {
        this.loading = false;
      }
    },

    clear() {
      this.payments = [];
      this.receipts = [];
      this.allocations = [];
      this.loading = false;
      this.initialized = false;
      this.error = null;
    },
  },
});