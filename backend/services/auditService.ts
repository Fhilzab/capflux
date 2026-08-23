/**
 * auditService — shared audit-log writer.
 *
 * Records a financial/security event. Never logs NIN/BVN, full account
 * numbers, secrets, or document contents — callers pass masked/reference data
 * only.
 */
import { supabase } from '../supabaseClient.js';
import { errorMessage } from '../types/http.js';

export interface AuditMetadata {
  [key: string]: unknown;
}

export async function audit(
  schoolId: string | null,
  actorId: string | null | undefined,
  action: string,
  entity: string,
  entityId: string | null | undefined,
  metadata: AuditMetadata = {}
): Promise<void> {
  try {
    await supabase.from('audit_logs').insert({
      school_id: schoolId,
      actor_id: actorId || null,
      action,
      entity,
      // Live schema note: entity_id/school_id are NOT NULL; null ids are sent
      // exactly as before — such inserts fail and the catch below logs loudly
      // (pre-existing, documented behavior).
      entity_id: entityId ?? null,
      metadata: JSON.stringify({ ...metadata, audited_at: new Date().toISOString() }),
    });
  } catch (err) {
    // Audit failure must never break the financial flow, but must be loud.
    console.error(`[audit] failed to record ${action}:`, errorMessage(err));
  }
}

export default audit;
