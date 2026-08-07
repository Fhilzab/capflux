/**
 * GatewayAssignmentService — CAPFLUX-internal payment gateway assignment.
 *
 * Schools NEVER select a gateway and never supply credentials. CAPFLUX
 * assigns the provider server-side (rules-driven or staff-administered).
 * The assignment is idempotent and audited.
 */
import { supabase } from '../supabaseClient.js';

const DEFAULT_PROVIDER = process.env.CAPFLUX_DEFAULT_GATEWAY || 'monnify';

class GatewayAssignmentService {
  /**
   * Determine the provider to assign for a school.
   * Rules-driven: currently a single default; extend with capacity rules later.
   */
  _selectProvider() {
    return DEFAULT_PROVIDER === 'paystack' ? 'paystack' : 'monnify';
  }

  /**
   * Assign a gateway to a school (idempotent).
   * @param {Object} params
   * @param {string} params.schoolId
   * @param {string} params.assignedBy - staff user id
   * @param {string} [params.provider] - optional override (staff only)
   * @param {string} [params.notes]
   */
  async assignGateway({ schoolId, assignedBy, provider, notes }) {
    if (!schoolId) throw new Error('schoolId is required');

    const selectedProvider = provider && ['paystack', 'monnify'].includes(provider)
      ? provider
      : this._selectProvider();

    const idempotencyKey = `gateway:${schoolId}`;

    // Idempotent: existing active assignment is a success.
    const { data: existing } = await supabase
      .from('gateway_assignments')
      .select('*')
      .eq('school_id', schoolId)
      .in('status', ['ASSIGNED', 'ACTIVE'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      return {
        assignment: existing,
        alreadyAssigned: true,
      };
    }

    const { data, error } = await supabase
      .from('gateway_assignments')
      .insert({
        school_id: schoolId,
        provider: selectedProvider,
        status: 'ASSIGNED',
        assigned_by: assignedBy || null,
        notes: notes || null,
        idempotency_key: idempotencyKey,
      })
      .select()
      .single();

    if (error) {
      // Unique constraint race -> treat as already assigned.
      if (error.code === '23505') {
        const { data: raced } = await supabase
          .from('gateway_assignments')
          .select('*')
          .eq('school_id', schoolId)
          .in('status', ['ASSIGNED', 'ACTIVE'])
          .single();
        return { assignment: raced, alreadyAssigned: true };
      }
      throw error;
    }

    // Audit.
    await supabase.from('audit_logs').insert({
      school_id: schoolId,
      actor_id: assignedBy || null,
      action: 'GATEWAY_ASSIGNED',
      entity: 'gateway_assignments',
      entity_id: data.id,
      metadata: { provider: selectedProvider },
    });

    return { assignment: data, alreadyAssigned: false };
  }

  /**
   * Get the current active gateway assignment for a school.
   */
  async getAssignment(schoolId) {
    const { data, error } = await supabase
      .from('gateway_assignments')
      .select('*')
      .eq('school_id', schoolId)
      .in('status', ['ASSIGNED', 'ACTIVE'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  }
}

export { GatewayAssignmentService };
export default new GatewayAssignmentService();
