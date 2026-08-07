/**
 * auditService — shared audit-log writer.
 *
 * Records a financial/security event. Never logs NIN/BVN, full account
 * numbers, secrets, or document contents — callers pass masked/reference data
 * only.
 */
import { supabase } from '../supabaseClient.js';

export async function audit(schoolId, actorId, action, entity, entityId, metadata = {}) {
  try {
    await supabase.from('audit_logs').insert({
      school_id: schoolId,
      actor_id: actorId || null,
      action,
      entity,
      entity_id: entityId,
      metadata: JSON.stringify({ ...metadata, audited_at: new Date().toISOString() }),
    });
  } catch (err) {
    // Audit failure must never break the financial flow, but must be loud.
    console.error(`[audit] failed to record ${action}:`, err.message);
  }
}

export default audit;
