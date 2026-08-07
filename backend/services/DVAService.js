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
import { audit } from './auditService.js';

class DVAService {
  /**
   * Resolve the school's active gateway assignment.
   */
  async getGatewayAssignment(schoolId) {
    const { data, error } = await supabase
      .from('gateway_assignments')
      .select('*')
      .eq('school_id', schoolId)
      .in('status', ['ASSIGNED', 'ACTIVE'])
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  }

  /**
   * Resolve a student's existing payment account (any status).
   */
  async getAccountByStudent(schoolId, studentId) {
    const { data, error } = await supabase
      .from('payment_accounts')
      .select('*')
      .eq('school_id', schoolId)
      .eq('student_id', studentId)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  }

  /**
   * Resolve an account by provider reference (idempotency recovery after a
   * gateway-succeeded-but-db-failed race).
   */
  async getAccountByProviderRef(provider, providerAccountId) {
    const { data, error } = await supabase
      .from('payment_accounts')
      .select('*')
      .eq('provider', provider)
      .eq('provider_account_id', providerAccountId)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  }

  /**
   * Provision a DVA for a student.
   *
   * @param {Object} params
   * @param {string} params.schoolId
   * @param {string} params.studentId
   * @param {string} params.actorId - authenticated user id
   * @param {string} [params.idempotencyKey]
   */
  async provisionDVA({ schoolId, studentId, actorId, idempotencyKey }) {
    if (!schoolId || !studentId) throw new Error('schoolId and studentId are required');

    const idemKey = idempotencyKey || `dva:${schoolId}:${studentId}`;

    // 1. Existing account by idempotency key -> return it.
    const { data: byKey } = await supabase
      .from('payment_accounts')
      .select('*')
      .eq('idempotency_key', idemKey)
      .maybeSingle();
    if (byKey) return { account: byKey, alreadyExists: true };

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
      throw Object.assign(new Error('No active gateway assignment for this school.'), { code: 'NO_GATEWAY_ASSIGNMENT', statusCode: 403 });
    }
    const gateway = GatewayFactory.get(assignment.provider);
    if (!gateway) {
      throw Object.assign(new Error(`Gateway provider ${assignment.provider} is not configured.`), { code: 'GATEWAY_NOT_CONFIGURED', statusCode: 500 });
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
        if (raced) return { account: raced, alreadyExists: true };
      }
      throw intentError;
    }

    return this.#provisionExisting({ account: intent, idemKey, schoolId, studentId, actorId });
  }

  /**
   * Call the gateway for an existing (PENDING/PROVISIONING) intent and
   * transition to ACTIVE or FAILED. Recovers a provider resource if a prior
   * gateway call succeeded but the DB write failed.
   */
  async #provisionExisting({ account, idemKey, schoolId, studentId, actorId }) {
    const assignment = await this.getGatewayAssignment(schoolId);
    const gateway = assignment ? GatewayFactory.get(assignment.provider) : null;
    if (!assignment || !gateway) {
      await this.#markFailed(account.id, 'No active gateway assignment.');
      throw Object.assign(new Error('No active gateway assignment for this school.'), { code: 'NO_GATEWAY_ASSIGNMENT', statusCode: 403 });
    }

    const { data: student } = await supabase
      .from('students')
      .select('first_name, last_name, guardian_id, guardians(primary_phone)')
      .eq('id', studentId)
      .single();

    try {
      const accountDetails = await gateway.createStudentPaymentAccount({
        student_id: studentId,
        student_name: student ? `${student.first_name} ${student.last_name}` : 'Student',
        guardian_phone: student?.guardians?.primary_phone || student?.guardian_id || null,
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

      await audit(schoolId, actorId, 'DVA_PROVISIONED', 'payment_accounts', updated.id, {
        provider: assignment.provider,
        student_id: studentId,
        account_number_last4: updated.virtual_account_number?.slice(-4) || null,
      });

      return { account: updated, alreadyExists: false };
    } catch (err) {
      await this.#markFailed(account.id, err.message);
      throw err;
    }
  }

  async #markFailed(accountId, message) {
    await supabase
      .from('payment_accounts')
      .update({ status: 'FAILED', provisioning_error: message, updated_at: new Date().toISOString() })
      .eq('id', accountId);
  }

  /**
   * Deactivate an ACTIVE DVA (idempotent).
   */
  async deactivateDVA({ accountId, schoolId, actorId }) {
    const { data: account, error } = await supabase
      .from('payment_accounts')
      .select('*')
      .eq('id', accountId)
      .eq('school_id', schoolId)
      .single();
    if (error || !account) throw Object.assign(new Error('Payment account not found.'), { statusCode: 404 });
    if (account.status === 'DISABLED') return { account, alreadyDisabled: true };
    if (account.status !== 'ACTIVE') {
      throw Object.assign(new Error(`Cannot disable a ${account.status} account.`), { statusCode: 400 });
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
      student_id: account.student_id,
      account_number_last4: account.virtual_account_number?.slice(-4) || null,
    });

    return { account: updated, alreadyDisabled: false };
  }
}

export { DVAService };
export default new DVAService();
