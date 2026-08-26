/**
 * GatewayAssignmentService — CAPFLUX-internal payment gateway assignment.
 *
 * Schools NEVER select a gateway and never supply credentials. CAPFLUX
 * assigns the provider server-side (rules-driven or staff-administered).
 * The assignment is idempotent and audited.
 */
import { supabase } from '../supabaseClient.js';
import type { GatewayAssignmentRow } from '../types/db.js';

const DEFAULT_PROVIDER = process.env.CAPFLUX_DEFAULT_GATEWAY || 'monnify';

export interface AssignGatewayParams {
  schoolId: string;
  assignedBy?: string | null;
  provider?: string;
  notes?: string | null;
}

export interface AssignGatewayResult {
  assignment: GatewayAssignmentRow | null;
  alreadyAssigned: boolean;
}

class GatewayAssignmentService {
  /**
   * Determine the provider to assign for a school.
   * Rules-driven: currently a single default; extend with capacity rules later.
   */
  _selectProvider(): string {
    return DEFAULT_PROVIDER === 'paystack' ? 'paystack' : 'monnify';
  }

  /**
   * Assign a gateway to a school (idempotent).
   */
  async assignGateway({ schoolId, assignedBy, provider, notes }: AssignGatewayParams): Promise<AssignGatewayResult> {
    if (!schoolId) throw new Error('schoolId is required');

    const selectedProvider = provider && ['paystack', 'monnify', 'sandbox'].includes(provider)
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
        assignment: existing as GatewayAssignmentRow,
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
        return { assignment: (raced ?? null) as GatewayAssignmentRow | null, alreadyAssigned: true };
      }
      throw error;
    }

    // Audit.
    await supabase.from('audit_logs').insert({
      school_id: schoolId,
      actor_id: assignedBy || null,
      action: 'GATEWAY_ASSIGNED',
      entity: 'gateway_assignments',
      entity_id: (data as GatewayAssignmentRow).id,
      metadata: { provider: selectedProvider },
    });

    return { assignment: data as GatewayAssignmentRow, alreadyAssigned: false };
  }

  /**
   * Get the current active gateway assignment for a school.
   */
  async getAssignment(schoolId: string): Promise<GatewayAssignmentRow | null> {
    const { data, error } = await supabase
      .from('gateway_assignments')
      .select('*')
      .eq('school_id', schoolId)
      .in('status', ['ASSIGNED', 'ACTIVE'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return (data ?? null) as GatewayAssignmentRow | null;
  }
}

export { GatewayAssignmentService };
export default new GatewayAssignmentService();
