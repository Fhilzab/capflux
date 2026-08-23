/**
 * DVAService — canonical Dedicated Virtual Account provisioning.
 *
 * Lifecycle:
 *   PENDING -> PROVISIONING -> ACTIVE
 *   PROVISIONING -> FAILED
 *   ACTIVE -> DISABLED
 *
 * Idempotency:
 *   - idempotency_key on payment_accounts (unique) prevents duplicate rows.
 *   - provider + provider_account_id unique index protects against the
 *     "gateway succeeded but DB write failed" retry case by re-fetching the
 *     existing provider resource.
 *
 * Gateway selection: from gateway_assignments (CAPFLUX-internal), NOT from
 * legacy payment_gateway_config. Credentials come from server env.
 */
import { supabase } from '../supabaseClient.js';
import { GatewayFactory } from './gateways/GatewayFactory.js';
import type { PaymentGateway } from './gateways/GatewayFactory.js';
import { audit } from './auditService.js';
import { errorMessage } from '../types/http.js';
import type {
  GatewayAssignmentRow,
  PaymentAccountRow,
} from '../types/db.js';
import type { StudentPaymentAccount } from '../types/gateway.js';
import type { AppError } from '../types/http.js';

export interface ProvisionDVAParams {
  schoolId: string;
  studentId: string;
  actorId?: string | null;
  idempotencyKey?: string;
}

export interface ProvisionDVAResult {
  account: PaymentAccountRow;
  alreadyExists: boolean;
}

export interface DeactivateDVAParams {
  accountId: string;
  schoolId: string;
  actorId?: string | null;
}

class DVAService {
  /**
   * Resolve the school's active gateway assignment.
   */
  async getGatewayAssignment(schoolId: string): Promise<GatewayAssignmentRow | null> {
    const { data, error } = await supabase
      .from('gateway_assignments')
      .select('*')
      .eq('school_id', schoolId)
      .in('status', ['ASSIGNED', 'ACTIVE'])
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return (data ?? null) as GatewayAssignmentRow | null;
  }

  /**
   * Resolve a student's existing payment account (any status).
   */
  async getAccountByStudent(schoolId: string, studentId: string): Promise<PaymentAccountRow | null> {
    const { data, error } = await supabase
      .from('payment_accounts')
      .select('*')
      .eq('school_id', schoolId)
      .eq('student_id', studentId)
      .maybeSingle();
    if (error) throw error;
    return (data ?? null) as PaymentAccountRow | null;
  }

  /**
   * Resolve an account by provider reference (idempotency recovery after a
   * gateway-succeeded-but-db-failed race).
   */
  async getAccountByProviderRef(provider: string, providerAccountId: unknown): Promise<PaymentAccountRow | null> {
    const { data, error } = await supabase
      .from('payment_accounts')
      .select('*')
      .eq('provider', provider)
      .eq('provider_account_id', providerAccountId as string)
      .maybeSingle();
    if (error) throw error;
    return (data ?? null) as PaymentAccountRow | null;
  }

  /**
   * Provision a DVA for a student.
   */
  async provisionDVA({ schoolId, studentId, actorId, idempotencyKey }: ProvisionDVAParams): Promise<ProvisionDVAResult> {
    if (!schoolId || !studentId) throw new Error('schoolId and studentId are required');

    const idemKey = idempotencyKey || `dva:${schoolId}:${studentId}`;

    // 1. Existing account by idempotency key -> return it.
    const { data: byKey } = await supabase
      .from('payment_accounts')
      .select('*')
      .eq('idempotency_key', idemKey)
      .maybeSingle();
    if (byKey) return { account: byKey as PaymentAccountRow, alreadyExists: true };

    // 2. Existing account for the student -> return it.
    const existing = await this.getAccountByStudent(schoolId, studentId);
    if (existing) {
      // If an old provisioning attempt failed, allow retry by updating to PROVISIONING.
      if (existing.status === 'FAILED' || existing.status === 'PENDING') {
        await supabase
          .from('payment_accounts')
          .update({ status: 'PROVISIONING', idempotency_key: idemKey, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
        return this.#provisionExisting({ account: existing, idemKey, schoolId, studentId, actorId });
      }
      return { account: existing, alreadyExists: true };
    }

    // 3. Resolve the CAPFLUX-assigned gateway.
    const assignment = await this.getGatewayAssignment(schoolId);
    if (!assignment) {
      throw Object.assign(new Error('No active gateway assignment for this school.'), { code: 'NO_GATEWAY_ASSIGNMENT', statusCode: 403 }) as AppError;
    }
    const gateway = GatewayFactory.get(assignment.provider);
    if (!gateway) {
      throw Object.assign(new Error(`Gateway provider ${assignment.provider} is not configured.`), { code: 'GATEWAY_NOT_CONFIGURED', statusCode: 500 }) as AppError;
    }

    // 4. Create PENDING intent row.
    const { data: intent, error: intentError } = await supabase
      .from('payment_accounts')
      .insert({
        school_id: schoolId,
        student_id: studentId,
        provider: assignment.provider,
        status: 'PROVISIONING',
        idempotency_key: idemKey,
      })
      .select()
      .single();

    if (intentError) {
      // Unique violation on idempotency key -> a concurrent request won.
      if (intentError.code === '23505') {
        const { data: raced } = await supabase
          .from('payment_accounts')
          .select('*')
          .eq('idempotency_key', idemKey)
          .maybeSingle();
        if (raced) return { account: raced as PaymentAccountRow, alreadyExists: true };
      }
      throw intentError;
    }

    return this.#provisionExisting({ account: intent as PaymentAccountRow, idemKey, schoolId, studentId, actorId });
  }

  /**
   * Call the gateway for an existing (PENDING/PROVISIONING) intent and
   * transition to ACTIVE or FAILED. Recovers a provider resource if a prior
   * gateway call succeeded but the DB write failed.
   */
  async #provisionExisting({
    account,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    idemKey: _idemKey,
    schoolId,
    studentId,
    actorId,
  }: {
    account: PaymentAccountRow;
    idemKey: string;
    schoolId: string;
    studentId: string;
    actorId?: string | null;
  }): Promise<ProvisionDVAResult> {
    const assignment = await this.getGatewayAssignment(schoolId);
    const gateway: PaymentGateway | null = assignment ? GatewayFactory.get(assignment.provider) : null;
    if (!assignment || !gateway) {
      await this.#markFailed(account.id, 'No active gateway assignment.');
      throw Object.assign(new Error('No active gateway assignment for this school.'), { code: 'NO_GATEWAY_ASSIGNMENT', statusCode: 403 }) as AppError;
    }

    const { data: student } = await supabase
      .from('students')
      .select('first_name, last_name, guardian_id, guardians(primary_phone)')
      .eq('id', studentId)
      .single();

    const studentRow = student as {
      first_name?: unknown;
      last_name?: unknown;
      guardian_id?: string | null;
      guardians?: { primary_phone?: string | null } | null;
    } | null;

    try {
      // Preserve legacy template semantics verbatim (missing name parts
      // render as "undefined", exactly as in the JavaScript implementation).
      const studentName = student
        ? `${studentRow?.first_name} ${studentRow?.last_name}`
        : 'Student';
      const accountDetails: StudentPaymentAccount = await gateway.createStudentPaymentAccount({
        student_id: studentId,
        student_name: studentName,
        guardian_phone: studentRow?.guardians?.primary_phone || studentRow?.guardian_id || null,
        gateway_config: {}, // credentials come from server env
        school_id: schoolId,
      });

      // Idempotency recovery: if this provider resource already exists in our DB
      // (gateway succeeded but the previous DB write failed), reuse it.
      const existingByRef = await this.getAccountByProviderRef(assignment.provider, accountDetails.provider_account_id);
      if (existingByRef && existingByRef.id !== account.id) {
        await supabase.from('payment_accounts').delete().eq('id', account.id);
        return { account: existingByRef, alreadyExists: true };
      }

      const { data: updated, error } = await supabase
        .from('payment_accounts')
        .update({
          provider: assignment.provider,
          provider_account_id: accountDetails.provider_account_id,
          provider_reference: accountDetails.provider_reference,
          virtual_account_number: accountDetails.virtual_account_number,
          account_name: accountDetails.account_name,
          bank_name: accountDetails.bank_name,
          account_status: 'ACTIVE',
          status: 'ACTIVE',
          provisioning_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', account.id)
        .select()
        .single();

      if (error) throw error;

      const updatedRow = updated as PaymentAccountRow;

      await audit(schoolId, actorId, 'DVA_PROVISIONED', 'payment_accounts', updatedRow.id, {
        provider: assignment.provider,
        student_id: studentId,
        account_number_last4: updatedRow.virtual_account_number?.slice(-4) || null,
      });

      return { account: updatedRow, alreadyExists: false };
    } catch (err) {
      await this.#markFailed(account.id, errorMessage(err) as string);
      throw err;
    }
  }

  async #markFailed(accountId: string, message: string): Promise<void> {
    await supabase
      .from('payment_accounts')
      .update({ status: 'FAILED', provisioning_error: message, updated_at: new Date().toISOString() })
      .eq('id', accountId);
  }

  /**
   * Deactivate an ACTIVE DVA (idempotent).
   */
  async deactivateDVA({ accountId, schoolId, actorId }: DeactivateDVAParams): Promise<{ account: PaymentAccountRow; alreadyDisabled: boolean }> {
    const { data: account, error } = await supabase
      .from('payment_accounts')
      .select('*')
      .eq('id', accountId)
      .eq('school_id', schoolId)
      .single();
    if (error || !account) throw Object.assign(new Error('Payment account not found.'), { statusCode: 404 }) as AppError;
    const row = account as PaymentAccountRow;
    if (row.status === 'DISABLED') return { account: row, alreadyDisabled: true };
    if (row.status !== 'ACTIVE') {
      throw Object.assign(new Error(`Cannot disable a ${row.status} account.`), { statusCode: 400 }) as AppError;
    }

    const { data: updated, error: updateError } = await supabase
      .from('payment_accounts')
      .update({
        status: 'DISABLED',
        account_status: 'INACTIVE',
        is_primary: false,
        deactivated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', accountId)
      .select()
      .single();
    if (updateError) throw updateError;

    await audit(schoolId, actorId, 'DVA_DEACTIVATED', 'payment_accounts', accountId, {
      student_id: row.student_id,
      account_number_last4: row.virtual_account_number?.slice(-4) || null,
    });

    return { account: updated as PaymentAccountRow, alreadyDisabled: false };
  }
}

export { DVAService };
export default new DVAService();
