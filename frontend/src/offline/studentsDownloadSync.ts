/**
 * Students-domain download synchronization.
 *
 * Pulls the academic/enrollment/guardian domain into Dexie so a freshly
 * authenticated device can operate fully offline. Dependency order follows
 * the domain graph:
 *
 *   academic_sessions/terms → divisions(sections) → levels
 *     → students → guardians → student_guardians → student_enrollments
 *
 * Incremental: per-table cursors (max updated_at) are persisted in the
 * existing app_settings table and used as .gt() filters on subsequent runs.
 * Structure tables (sessions/terms/divisions/levels) converge via daily full
 * refresh; transactional tables (students/guardians/links/enrollments)
 * only ever upsert by id — local rows are never deleted by the pull.
 */
import { supabase, hasSupabaseConfig } from '../shared/services/api/supabase';

const PAGE_SIZE = 500;
const CURSOR_KEY = 'sync_cursors_students_domain';
const FULL_REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000; // daily full refresh

/** Tables pulled in dependency order. */
const TABLES = [
  'academic_sessions',
  'academic_terms',
  'school_divisions',
  'academic_levels',
  'students',
  'guardians',
  'student_guardians',
  'student_enrollments',
] as const;

interface SyncCursors {
  /** Per-table max updated_at already pulled. */
  [table: string]: string | undefined;
}

async function loadCursors(): Promise<SyncCursors> {
  const { db } = await import('./localDb');
  const row = await db.app_settings.get(CURSOR_KEY);
  return ((row?.value as SyncCursors) ?? {});
}

async function saveCursors(cursors: SyncCursors): Promise<void> {
  const { db } = await import('./localDb');
  await db.app_settings.put({
    school_id: CURSOR_KEY,
    value: cursors,
    source: 'SERVER',
    version: 1,
    updated_at: new Date().toISOString(),
  } as any);
}

export async function downloadStudentsDomainData(schoolId: string): Promise<{
  ok: boolean;
  pulled: Record<string, number>;
}> {
  const pulled: Record<string, number> = {};
  if (!hasSupabaseConfig) {
    return { ok: false, pulled };
  }

  const { useAuthStore } = await import('../stores/authStore');
  if (!useAuthStore().session) {
    return { ok: false, pulled };
  }

  const { db } = await import('./localDb');

  let cursors = await loadCursors();
  const lastFull = (cursors._lastFullRefresh as string | undefined) || '';
  const fullRefreshDue =
    !lastFull || Date.now() - new Date(lastFull).getTime() > FULL_REFRESH_INTERVAL_MS;

  for (const table of TABLES) {
    try {
      let query = supabase.from(table).select('*').eq('school_id', schoolId);
      if (!fullRefreshDue && cursors[table]) {
        query = query.gt('updated_at', cursors[table]);
      }

      let from = 0;
      let total = 0;
      let maxUpdatedAt: string | undefined = cursors[table];
      for (;;) {
        const { data, error } = await query.range(from, from + PAGE_SIZE - 1);
        if (error) throw error;
        const rows = (data ?? []) as Array<Record<string, any>>;
        total += rows.length;

        if (rows.length > 0) {
          const stamped = rows.map((r) => ({
            ...r,
            source: 'SERVER' as const,
            version: 1,
            updated_at: r.updated_at || new Date().toISOString(),
          }));
          await (db as any)[table].bulkPut(stamped);
          maxUpdatedAt = rows.reduce(
            (acc, r) => (r.updated_at && r.updated_at > acc ? r.updated_at : acc),
            maxUpdatedAt || ''
          );
        }

        if (rows.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }

      cursors[table] = maxUpdatedAt;
      pulled[table] = total;
    } catch (e) {
      console.error(`Download-sync failed for ${table}:`, e);
      // Prior cursor retained — pull resumes safely on the next run.
    }
  }

  if (fullRefreshDue) cursors._lastFullRefresh = new Date().toISOString();
  await saveCursors(cursors);

  return { ok: true, pulled };
}

let pollTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Periodic incremental pull (default every 5 min — cursors make runs cheap).
 * Also re-runs on the browser `online` event. Fire-and-forget by design.
 */
export function startStudentsDomainDownloadSync(intervalMs = 300000): void {
  if (pollTimer) return;
  pollTimer = setInterval(async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    const { useSchoolStore } = await import('../stores/schoolStore');
    const schoolId = useSchoolStore().currentSchoolId;
    if (!schoolId) return;
    try {
      await downloadStudentsDomainData(schoolId);
    } catch (e) {
      console.error('Students-domain periodic download failed:', e);
    }
  }, intervalMs);

  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
      (async () => {
        const { useSchoolStore } = await import('../stores/schoolStore');
        const schoolId = useSchoolStore().currentSchoolId;
        if (!schoolId) return;
        try {
          await downloadStudentsDomainData(schoolId);
        } catch {
          /* logged inside */
        }
      })();
    });
  }
}
