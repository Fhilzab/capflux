/**
 * SupabaseBillingProvider
 * Supabase-backed implementation of BillingProvider
 * Only file that directly calls supabase for billing operations
 */

import { supabase, hasSupabaseConfig } from '../services/api/supabase';
import { BillingProvider } from './BillingProvider';
import type { BillingProfile, StudentCharge, BillingSnapshot, BillingResult } from './types';
import { mapProviderError } from './BillingError';

type CreateBillingProfileInput = {
  studentId: string;
  schoolId: string;
  academicSessionId: string;
  discountRate: number;
  billingCycle: 'TERM' | 'SEMESTER' | 'SESSION';
  initializationStatus: 'PENDING' | 'ACTIVE' | 'LOCKED' | 'ARCHIVED' | 'FAILED';
};

type CreateBillingSnapshotInput = {
  feeId: string;
  feeName: string;
  feeCode: string;
  amount: number;
  currency: string;
  owner: 'SCHOOL' | 'PLATFORM';
  isMandatory: boolean;
  divisionId: string;
  academicSessionId: string;
  academicTermId: string;
  discountApplied: number;
  netAmount: number;
  billingVersion: number;
};

type CreateStudentChargeInput = {
  billingProfileId: string;
  snapshotId: string;
  studentId: string;
  academicSessionId: string;
  academicTermId: string;
  chargeSource: 'MANDATORY' | 'OPTIONAL' | 'PLATFORM';
  status: 'ACTIVE' | 'WAIVED' | 'VOID' | 'PAID' | 'PARTIALLY_PAID';
  ledgerLocked: boolean;
  paymentPlanId?: string;
};

export class SupabaseBillingProvider extends BillingProvider {
  // BillingProfile CRUD
  async createBillingProfile(input: CreateBillingProfileInput): Promise<BillingResult<BillingProfile>> {
    if (!hasSupabaseConfig) {
      return { data: null, error: { code: 'UNKNOWN', message: 'Supabase not configured' } };
    }

    try {
      const { data, error } = await (supabase.from('billing_profiles') as any)
        .insert({
          student_id: input.studentId,
          school_id: input.schoolId,
          academic_session_id: input.academicSessionId,
          discount_rate: input.discountRate,
          billing_cycle: input.billingCycle,
          initialization_status: input.initializationStatus,
        })
        .select()
        .single();

      if (error) {
        return { data: null, error: mapProviderError(error, 'BILLING_PROFILE_CREATE_FAILED') };
      }

      return { data: data as BillingProfile, error: null };
    } catch (error) {
      return { data: null, error: mapProviderError(error, 'BILLING_PROFILE_CREATE_FAILED') };
    }
  }

  async updateBillingProfile(profileId: string, updateData: Partial<BillingProfile>): Promise<BillingResult<BillingProfile>> {
    if (!hasSupabaseConfig) {
      return { data: null, error: { code: 'UNKNOWN', message: 'Supabase not configured' } };
    }

    try {
      const payload: Record<string, unknown> = {};
      if (updateData.discountRate !== undefined) payload.discount_rate = updateData.discountRate;
      if (updateData.initializationStatus !== undefined) payload.initialization_status = updateData.initializationStatus;
      if (updateData.billingCycle !== undefined) payload.billing_cycle = updateData.billingCycle;

      const { data, error } = await (supabase.from('billing_profiles') as any)
        .update(payload)
        .eq('id', profileId)
        .select()
        .single();

      if (error) {
        return { data: null, error: mapProviderError(error, 'BILLING_PROFILE_UPDATE_FAILED') };
      }

      return { data: data as BillingProfile, error: null };
    } catch (error) {
      return { data: null, error: mapProviderError(error, 'BILLING_PROFILE_UPDATE_FAILED') };
    }
  }

  async getBillingProfile(profileId: string): Promise<BillingResult<BillingProfile>> {
    if (!hasSupabaseConfig) {
      return { data: null, error: { code: 'BILLING_PROFILE_NOT_FOUND', message: 'Supabase not configured' } };
    }

    try {
      const { data, error } = await (supabase.from('billing_profiles') as any)
        .select('*')
        .eq('id', profileId)
        .single();

      if (error) {
        return { data: null, error: mapProviderError(error, 'BILLING_PROFILE_NOT_FOUND') };
      }

      return { data: data as BillingProfile, error: null };
    } catch (error) {
      return { data: null, error: mapProviderError(error, 'BILLING_PROFILE_NOT_FOUND') };
    }
  }

  async findBillingProfile(studentId: string, academicSessionId: string): Promise<BillingResult<BillingProfile | null>> {
    if (!hasSupabaseConfig) {
      return { data: null, error: null };
    }

    try {
      const { data, error } = await (supabase.from('billing_profiles') as any)
        .select('*')
        .eq('student_id', studentId)
        .eq('academic_session_id', academicSessionId)
        .maybeSingle();

      if (error) {
        return { data: null, error: mapProviderError(error, 'BILLING_PROFILE_NOT_FOUND') };
      }

      return { data: data as BillingProfile | null, error: null };
    } catch (error) {
      return { data: null, error: mapProviderError(error, 'BILLING_PROFILE_NOT_FOUND') };
    }
  }

  async listBillingProfiles(schoolId: string): Promise<BillingResult<BillingProfile[]>> {
    if (!hasSupabaseConfig) {
      return { data: [], error: null };
    }

    try {
      const { data, error } = await (supabase.from('billing_profiles') as any)
        .select('*')
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false });

      if (error) {
        return { data: null, error: mapProviderError(error, 'BILLING_PROFILE_NOT_FOUND') };
      }

      return { data: (data || []) as BillingProfile[], error: null };
    } catch (error) {
      return { data: null, error: mapProviderError(error, 'BILLING_PROFILE_NOT_FOUND') };
    }
  }

  // BillingSnapshot CRUD
  async createBillingSnapshot(input: CreateBillingSnapshotInput): Promise<BillingResult<BillingSnapshot>> {
    if (!hasSupabaseConfig) {
      return { data: null, error: { code: 'UNKNOWN', message: 'Supabase not configured' } };
    }

    try {
      const { data, error } = await (supabase.from('billing_snapshots') as any)
        .insert({
          fee_id: input.feeId,
          fee_name: input.feeName,
          fee_code: input.feeCode,
          amount: input.amount,
          currency: input.currency,
          owner: input.owner,
          is_mandatory: input.isMandatory,
          division_id: input.divisionId,
          academic_session_id: input.academicSessionId,
          academic_term_id: input.academicTermId,
          discount_applied: input.discountApplied,
          net_amount: input.netAmount,
          billing_version: input.billingVersion,
        })
        .select()
        .single();

      if (error) {
        return { data: null, error: mapProviderError(error, 'BILLING_SNAPSHOT_CREATE_FAILED') };
      }

      return { data: data as BillingSnapshot, error: null };
    } catch (error) {
      return { data: null, error: mapProviderError(error, 'BILLING_SNAPSHOT_CREATE_FAILED') };
    }
  }

  async getBillingSnapshot(snapshotId: string): Promise<BillingResult<BillingSnapshot>> {
    if (!hasSupabaseConfig) {
      return { data: null, error: { code: 'UNKNOWN', message: 'Supabase not configured' } };
    }

    try {
      const { data, error } = await (supabase.from('billing_snapshots') as any)
        .select('*')
        .eq('id', snapshotId)
        .single();

      if (error) {
        return { data: null, error: mapProviderError(error, 'UNKNOWN') };
      }

      return { data: data as BillingSnapshot, error: null };
    } catch (error) {
      return { data: null, error: mapProviderError(error, 'UNKNOWN') };
    }
  }

  // StudentCharge CRUD
  async createStudentCharge(input: CreateStudentChargeInput): Promise<BillingResult<StudentCharge>> {
    if (!hasSupabaseConfig) {
      return { data: null, error: { code: 'UNKNOWN', message: 'Supabase not configured' } };
    }

    try {
      const { data, error } = await (supabase.from('student_charges') as any)
        .insert({
          billing_profile_id: input.billingProfileId,
          snapshot_id: input.snapshotId,
          student_id: input.studentId,
          academic_session_id: input.academicSessionId,
          academic_term_id: input.academicTermId,
          charge_source: input.chargeSource,
          status: input.status,
          ledger_locked: input.ledgerLocked,
          payment_plan_id: input.paymentPlanId || null,
        })
        .select()
        .single();

      if (error) {
        return { data: null, error: mapProviderError(error, 'STUDENT_CHARGE_CREATE_FAILED') };
      }

      return { data: data as StudentCharge, error: null };
    } catch (error) {
      return { data: null, error: mapProviderError(error, 'STUDENT_CHARGE_CREATE_FAILED') };
    }
  }

  async updateStudentCharge(chargeId: string, updateData: Partial<StudentCharge>): Promise<BillingResult<StudentCharge>> {
    if (!hasSupabaseConfig) {
      return { data: null, error: { code: 'UNKNOWN', message: 'Supabase not configured' } };
    }

    try {
      const payload: Record<string, unknown> = {};
      if (updateData.status !== undefined) payload.status = updateData.status;
      if (updateData.ledgerLocked !== undefined) payload.ledger_locked = updateData.ledgerLocked;
      if (updateData.paymentPlanId !== undefined) payload.payment_plan_id = updateData.paymentPlanId;

      const { data, error } = await (supabase.from('student_charges') as any)
        .update(payload)
        .eq('id', chargeId)
        .select()
        .single();

      if (error) {
        return { data: null, error: mapProviderError(error, 'STUDENT_CHARGE_UPDATE_FAILED') };
      }

      return { data: data as StudentCharge, error: null };
    } catch (error) {
      return { data: null, error: mapProviderError(error, 'STUDENT_CHARGE_UPDATE_FAILED') };
    }
  }

  async getStudentCharge(chargeId: string): Promise<BillingResult<StudentCharge>> {
    if (!hasSupabaseConfig) {
      return { data: null, error: { code: 'STUDENT_CHARGE_NOT_FOUND', message: 'Supabase not configured' } };
    }

    try {
      const { data, error } = await (supabase.from('student_charges') as any)
        .select('*')
        .eq('id', chargeId)
        .single();

      if (error) {
        return { data: null, error: mapProviderError(error, 'STUDENT_CHARGE_NOT_FOUND') };
      }

      return { data: data as StudentCharge, error: null };
    } catch (error) {
      return { data: null, error: mapProviderError(error, 'STUDENT_CHARGE_NOT_FOUND') };
    }
  }

  async listStudentCharges(studentId: string): Promise<BillingResult<StudentCharge[]>> {
    if (!hasSupabaseConfig) {
      return { data: [], error: null };
    }

    try {
      const { data, error } = await (supabase.from('student_charges') as any)
        .select('*')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false });

      if (error) {
        return { data: null, error: mapProviderError(error, 'STUDENT_CHARGE_NOT_FOUND') };
      }

      return { data: (data || []) as StudentCharge[], error: null };
    } catch (error) {
      return { data: null, error: mapProviderError(error, 'STUDENT_CHARGE_NOT_FOUND') };
    }
  }

  async listChargesByProfile(profileId: string): Promise<BillingResult<StudentCharge[]>> {
    if (!hasSupabaseConfig) {
      return { data: [], error: null };
    }

    try {
      const { data, error } = await (supabase.from('student_charges') as any)
        .select('*')
        .eq('billing_profile_id', profileId)
        .order('created_at', { ascending: false });

      if (error) {
        return { data: null, error: mapProviderError(error, 'STUDENT_CHARGE_NOT_FOUND') };
      }

      return { data: (data || []) as StudentCharge[], error: null };
    } catch (error) {
      return { data: null, error: mapProviderError(error, 'STUDENT_CHARGE_NOT_FOUND') };
    }
  }

  async listChargesByStatus(studentId: string, status: string): Promise<BillingResult<StudentCharge[]>> {
    if (!hasSupabaseConfig) {
      return { data: [], error: null };
    }

    try {
      const { data, error } = await (supabase.from('student_charges') as any)
        .select('*')
        .eq('student_id', studentId)
        .eq('status', status)
        .order('created_at', { ascending: false });

      if (error) {
        return { data: null, error: mapProviderError(error, 'STUDENT_CHARGE_NOT_FOUND') };
      }

      return { data: (data || []) as StudentCharge[], error: null };
    } catch (error) {
      return { data: null, error: mapProviderError(error, 'STUDENT_CHARGE_NOT_FOUND') };
    }
  }

  // Future stubs
  async generateInvoice(_chargeIds: string[]): Promise<BillingResult<void>> {
    return { data: null, error: { code: 'UNKNOWN', message: 'Not implemented' } };
  }

  async recordPayment(_chargeId: string, _amount: number): Promise<BillingResult<void>> {
    return { data: null, error: { code: 'UNKNOWN', message: 'Not implemented' } };
  }

  async reverseCharge(_chargeId: string): Promise<BillingResult<void>> {
    return { data: null, error: { code: 'UNKNOWN', message: 'Not implemented' } };
  }

  async rollForwardTerm(_billingCycle: 'TERM' | 'SEMESTER' | 'SESSION'): Promise<BillingResult<void>> {
    return { data: null, error: { code: 'UNKNOWN', message: 'Not implemented' } };
  }

  async rollForwardSession(_sessionId: string): Promise<BillingResult<void>> {
    return { data: null, error: { code: 'UNKNOWN', message: 'Not implemented' } };
  }

  async rebuildStudentBilling(_studentId: string): Promise<BillingResult<void>> {
    return { data: null, error: { code: 'UNKNOWN', message: 'Not implemented' } };
  }

  async rebuildDivisionBilling(_schoolId: string, _divisionId: string): Promise<BillingResult<void>> {
    return { data: null, error: { code: 'UNKNOWN', message: 'Not implemented' } };
  }

  async rebuildSchoolBilling(_schoolId: string): Promise<BillingResult<void>> {
    return { data: null, error: { code: 'UNKNOWN', message: 'Not implemented' } };
  }

  isConfigured(): boolean {
    return hasSupabaseConfig;
  }
}