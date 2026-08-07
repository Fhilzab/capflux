/**
 * StaffFinancialStore — CAPFLUX staff review operations for financial
 * activation. Only reachable by authorized staff (SUPER_ADMIN or staff roles).
 * Never returns raw NIN/BVN or full account numbers (backend masks).
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

export const useStaffFinancialStore = defineStore('staffFinancial', {
  state: () => ({
    loading: false,
    error: null as string | null,
    kycList: [] as unknown[],
    kycDetail: null as Record<string, unknown> | null,
    settlements: [] as unknown[],
    readiness: null as Record<string, unknown> | null,
  }),

  actions: {
    async loadKycList() {
      this.loading = true;
      this.error = null;
      try {
        const data = await request<{ success: boolean; data: unknown[] }>('get', '/admin/kyc');
        this.kycList = data.data || [];
      } catch (err) {
        this.error = (err as Error).message || 'Failed to load KYC records';
      } finally {
        this.loading = false;
      }
    },

    async loadKycDetail(id: string) {
      this.loading = true;
      this.error = null;
      try {
        const data = await request<{ success: boolean; data: Record<string, unknown> }>('get', `/admin/kyc/${id}`);
        this.kycDetail = data.data;
      } catch (err) {
        this.error = (err as Error).message || 'Failed to load KYC detail';
      } finally {
        this.loading = false;
      }
    },

    async verifyKyc(id: string) {
      this.loading = true;
      this.error = null;
      try {
        await request('post', `/admin/kyc/${id}/verify`);
        await this.loadKycDetail(id);
      } catch (err) {
        this.error = (err as Error).message || 'Failed to verify KYC';
        throw err;
      } finally {
        this.loading = false;
      }
    },

    async rejectKyc(id: string, reason: string) {
      this.loading = true;
      this.error = null;
      try {
        await request('post', `/admin/kyc/${id}/reject`, { reason });
        await this.loadKycDetail(id);
      } catch (err) {
        this.error = (err as Error).message || 'Failed to reject KYC';
        throw err;
      } finally {
        this.loading = false;
      }
    },

    async requestKycReview(id: string) {
      this.loading = true;
      this.error = null;
      try {
        await request('post', `/admin/kyc/${id}/request-review`);
        await this.loadKycDetail(id);
      } catch (err) {
        this.error = (err as Error).message || 'Failed to request review';
        throw err;
      } finally {
        this.loading = false;
      }
    },

    async loadSettlements() {
      this.loading = true;
      this.error = null;
      try {
        const data = await request<{ success: boolean; data: unknown[] }>('get', '/admin/settlements');
        this.settlements = data.data || [];
      } catch (err) {
        this.error = (err as Error).message || 'Failed to load settlements';
      } finally {
        this.loading = false;
      }
    },

    async verifySettlement(id: string) {
      this.loading = true;
      this.error = null;
      try {
        await request('post', `/admin/settlements/${id}/verify`);
        await this.loadSettlements();
      } catch (err) {
        this.error = (err as Error).message || 'Failed to verify settlement';
        throw err;
      } finally {
        this.loading = false;
      }
    },

    async rejectSettlement(id: string, reason: string) {
      this.loading = true;
      this.error = null;
      try {
        await request('post', `/admin/settlements/${id}/reject`, { reason });
        await this.loadSettlements();
      } catch (err) {
        this.error = (err as Error).message || 'Failed to reject settlement';
        throw err;
      } finally {
        this.loading = false;
      }
    },

    async assignGateway(schoolId: string) {
      this.loading = true;
      this.error = null;
      try {
        await request('post', '/admin/gateway/assign', { schoolId });
      } catch (err) {
        this.error = (err as Error).message || 'Failed to assign gateway';
        throw err;
      } finally {
        this.loading = false;
      }
    },

    async activatePayments(schoolId: string) {
      this.loading = true;
      this.error = null;
      try {
        const data = await request<{ success: boolean; data: Record<string, unknown> }>(
          'post',
          '/admin/payments/activate',
          { schoolId }
        );
        return data.data;
      } catch (err) {
        this.error = (err as Error).message || 'Failed to activate payments';
        throw err;
      } finally {
        this.loading = false;
      }
    },

    async suspendPayments(schoolId: string) {
      this.loading = true;
      this.error = null;
      try {
        await request('post', '/admin/payments/suspend', { schoolId });
      } catch (err) {
        this.error = (err as Error).message || 'Failed to suspend payments';
        throw err;
      } finally {
        this.loading = false;
      }
    },

    async loadReadiness(schoolId: string) {
      this.loading = true;
      this.error = null;
      try {
        const data = await request<{ success: boolean; data: Record<string, unknown> }>(
          'get',
          `/admin/payments/readiness/${schoolId}`
        );
        this.readiness = data.data;
      } catch (err) {
        this.error = (err as Error).message || 'Failed to load readiness';
      } finally {
        this.loading = false;
      }
    },

    reset() {
      this.kycList = [];
      this.kycDetail = null;
      this.settlements = [];
      this.readiness = null;
      this.error = null;
    },
  },
});
