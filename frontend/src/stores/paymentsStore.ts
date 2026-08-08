/**
 * paymentsStore — backend-authoritative payment/DVA/settlement/reconciliation
 * state for the school dashboard.
 *
 * All financial truth comes from the backend API (which derives it from the
 * gateway + ledger). The frontend NEVER declares a payment successful; it
 * only displays what the backend reports.
 */
import { defineStore } from 'pinia';
import { apiClient } from '../shared/services/api/client';

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await apiClient.http({
    method: method as 'get' | 'post' | 'put' | 'patch' | 'delete',
    url: path,
    data: body,
  });
  return response.data as T;
}

export const usePaymentsStore = defineStore('payments', {
  state: () => ({
    loading: false,
    error: null as string | null,
    payments: [] as any[],
    paymentSummary: null as null | {
      total_payments: number;
      successful_payments: number;
      pending_payments: number;
      failed_payments: number;
      reversed_payments: number;
      today_collections_minor: number;
      month_collections_minor: number;
      total_collected_minor: number;
    },
    dvAccounts: [] as any[],
    settlements: [] as any[],
    settlementSummary: null as null | {
      total: number;
      pending: number;
      successful: number;
      failed: number;
      settled_minor: number;
    },
    reconciliation: null as null | {
      runs: any[];
      open_issues: any[];
    },
  }),

  getters: {
    totalCollectedNaira(state): number {
      return (state.paymentSummary?.total_collected_minor || 0) / 100;
    },
    todayCollectionsNaira(state): number {
      return (state.paymentSummary?.today_collections_minor || 0) / 100;
    },
    monthCollectionsNaira(state): number {
      return (state.paymentSummary?.month_collections_minor || 0) / 100;
    },
    settledNaira(state): number {
      return (state.settlementSummary?.settled_minor || 0) / 100;
    },
  },

  actions: {
    async loadPayments(studentId?: string) {
      this.loading = true;
      this.error = null;
      try {
        const path = studentId ? `/payments/student/${studentId}` : '/payments';
        const data = await request<{ success: boolean; data: any[] }>('get', path);
        this.payments = data.data || [];
      } catch (err) {
        this.error = (err as Error).message || 'Failed to load payments';
      } finally {
        this.loading = false;
      }
    },

    async loadPaymentSummary() {
      this.loading = true;
      this.error = null;
      try {
        const data = await request<{ success: boolean; data: typeof this.paymentSummary }>('get', '/payments/summary');
        this.paymentSummary = data.data;
      } catch (err) {
        this.error = (err as Error).message || 'Failed to load payment summary';
      } finally {
        this.loading = false;
      }
    },

    async loadDVAccounts() {
      this.loading = true;
      this.error = null;
      try {
        const data = await request<{ success: boolean; data: any[] }>('get', '/dva');
        this.dvAccounts = data.data || [];
      } catch (err) {
        this.error = (err as Error).message || 'Failed to load virtual accounts';
      } finally {
        this.loading = false;
      }
    },

    async provisionDVA(studentId: string) {
      this.loading = true;
      this.error = null;
      try {
        await request('post', '/dva/provision', { student_id: studentId });
        await this.loadDVAccounts();
      } catch (err) {
        this.error = (err as Error).message || 'Failed to provision virtual account';
        throw err;
      } finally {
        this.loading = false;
      }
    },

    async deactivateDVA(accountId: string) {
      this.loading = true;
      this.error = null;
      try {
        await request('post', `/dva/${accountId}/deactivate`);
        await this.loadDVAccounts();
      } catch (err) {
        this.error = (err as Error).message || 'Failed to deactivate virtual account';
        throw err;
      } finally {
        this.loading = false;
      }
    },

    async loadSettlements() {
      this.loading = true;
      this.error = null;
      try {
        const data = await request<{ success: boolean; data: any[] }>('get', '/operations/settlements');
        this.settlements = data.data || [];
      } catch (err) {
        this.error = (err as Error).message || 'Failed to load settlements';
      } finally {
        this.loading = false;
      }
    },

    async loadSettlementSummary() {
      this.loading = true;
      this.error = null;
      try {
        const data = await request<{ success: boolean; data: typeof this.settlementSummary }>('get', '/operations/settlements/summary');
        this.settlementSummary = data.data;
      } catch (err) {
        this.error = (err as Error).message || 'Failed to load settlement summary';
      } finally {
        this.loading = false;
      }
    },

    async loadReconciliation() {
      this.loading = true;
      this.error = null;
      try {
        const data = await request<{ success: boolean; data: typeof this.reconciliation }>('get', '/operations/reconciliation');
        this.reconciliation = data.data;
      } catch (err) {
        this.error = (err as Error).message || 'Failed to load reconciliation status';
      } finally {
        this.loading = false;
      }
    },

    async loadAll() {
      await Promise.allSettled([
        this.loadPayments(),
        this.loadPaymentSummary(),
        this.loadDVAccounts(),
        this.loadSettlements(),
        this.loadSettlementSummary(),
        this.loadReconciliation(),
      ]);
    },

    reset() {
      this.payments = [];
      this.paymentSummary = null;
      this.dvAccounts = [];
      this.settlements = [];
      this.settlementSummary = null;
      this.reconciliation = null;
      this.error = null;
    },
  },
});
